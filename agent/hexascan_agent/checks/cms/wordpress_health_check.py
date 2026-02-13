"""
WordPress Health Check implementation.

Monitors WordPress installations for:
- WordPress version (current vs latest)
- Installed plugins (active/inactive)
- Active theme
- Database size and tables
- Disk usage (uploads, plugins, themes, cache)
- Security settings (WP_DEBUG, DISALLOW_FILE_EDIT)
- Content statistics (posts, pages, comments)
- WooCommerce data (if active): orders, products

Database credentials are automatically extracted from wp-config.php.
"""

import json
import os
import re
import time
import logging
import heapq
from decimal import Decimal
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from ..base import BaseCheck, CheckResult, CheckStatus
from ..registry import CheckRegistry

logger = logging.getLogger(__name__)


def convert_decimal(obj: Any) -> Any:
    """Convert Decimal objects to float/int for JSON serialization."""
    if isinstance(obj, Decimal):
        # Convert to int if it's a whole number, otherwise float
        if obj == obj.to_integral_value():
            return int(obj)
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimal(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_decimal(item) for item in obj)
    return obj


def parse_wp_config(wp_config_path: str) -> Dict[str, Any]:
    """
    Parse WordPress wp-config.php file to extract database credentials and settings.

    Args:
        wp_config_path: Path to the wp-config.php file

    Returns:
        Dictionary with db credentials and WP settings
    """
    if not os.path.isfile(wp_config_path):
        logger.warning(f"wp-config.php not found at: {wp_config_path}")
        return {}

    try:
        logger.info(f"Reading wp-config.php from: {wp_config_path}")
        with open(wp_config_path, 'r', encoding='utf-8') as f:
            content = f.read()

        logger.debug(f"wp-config.php file size: {len(content)} bytes")

        config = {}

        # Extract define() constants
        # Format: define( 'DB_NAME', 'database_name' );
        define_pattern = r"define\s*\(\s*['\"](\w+)['\"]\s*,\s*['\"]([^'\"]*)['\"]"
        defines = re.findall(define_pattern, content)

        for name, value in defines:
            config[name] = value
            if name in ['DB_NAME', 'DB_USER', 'DB_HOST']:
                logger.debug(f"Found {name}: {value}")
            elif name == 'DB_PASSWORD':
                logger.debug(f"Found DB_PASSWORD (length: {len(value)})")

        # Extract table prefix
        # Format: $table_prefix = 'wp_';
        prefix_match = re.search(r"\$table_prefix\s*=\s*['\"]([^'\"]+)['\"]", content)
        if prefix_match:
            config['table_prefix'] = prefix_match.group(1)
            logger.debug(f"Found table_prefix: {config['table_prefix']}")
        else:
            config['table_prefix'] = 'wp_'  # Default
            logger.debug("Using default table_prefix: wp_")

        # Extract boolean defines (WP_DEBUG, DISALLOW_FILE_EDIT, etc.)
        bool_pattern = r"define\s*\(\s*['\"](\w+)['\"]\s*,\s*(true|false|TRUE|FALSE)\s*\)"
        bool_defines = re.findall(bool_pattern, content)
        for name, value in bool_defines:
            config[name] = value.lower() == 'true'
            logger.debug(f"Found boolean {name}: {config[name]}")

        if config:
            logger.info(f"Successfully parsed wp-config.php - db: {config.get('DB_NAME')}, user: {config.get('DB_USER')}, host: {config.get('DB_HOST')}")

        return config

    except Exception as e:
        logger.error(f"Error parsing wp-config.php: {e}")
        return {}


# Known WordPress versions - latest stable versions
# Update this list periodically
WORDPRESS_VERSIONS = {
    "6.7": {"release_date": "2024-11-12"},
    "6.6": {"release_date": "2024-07-16"},
    "6.5": {"release_date": "2024-04-02"},
    "6.4": {"release_date": "2023-11-07"},
    "6.3": {"release_date": "2023-08-08"},
    "6.2": {"release_date": "2023-03-29"},
    "6.1": {"release_date": "2022-11-01"},
    "6.0": {"release_date": "2022-05-24"},
    "5.9": {"release_date": "2022-01-25"},
}

LATEST_WORDPRESS_VERSION = "6.7"


def format_bytes(bytes_val: int) -> str:
    """Format bytes to human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.2f} PB"


def get_directory_size(path: str) -> Tuple[int, int]:
    """
    Get directory size and file count.

    Returns:
        Tuple of (size_in_bytes, file_count)
    """
    total_size = 0
    file_count = 0

    try:
        for dirpath, dirnames, filenames in os.walk(path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                try:
                    if not os.path.islink(filepath):
                        total_size += os.path.getsize(filepath)
                        file_count += 1
                except (OSError, PermissionError):
                    pass
    except (OSError, PermissionError) as e:
        logger.warning(f"Error scanning directory {path}: {e}")

    return total_size, file_count


@CheckRegistry.register('WORDPRESS_HEALTH')
class WordPressHealthCheck(BaseCheck):
    """
    WordPress Health Check implementation.

    Gathers comprehensive health data from a WordPress installation including
    version, plugins, themes, database metrics, disk usage, security settings,
    and WooCommerce data if active.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize the WordPress health check."""
        super().__init__(config)
        self.wordpress_root = config.get('wordpress_root', '')
        self.wp_config = {}
        self.db_connection = None

    @property
    def name(self) -> str:
        return "WordPress Health"

    @property
    def category(self) -> str:
        return "cms"

    def execute(self) -> CheckResult:
        """Execute the WordPress health check."""
        start_time = time.time()

        if not self.wordpress_root:
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message="WordPress root path not configured",
                details={"error": "wordpress_root is required in check configuration"}
            )

        if not os.path.isdir(self.wordpress_root):
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"WordPress root not found: {self.wordpress_root}",
                details={"error": f"Directory does not exist: {self.wordpress_root}"}
            )

        # Parse wp-config.php
        wp_config_path = os.path.join(self.wordpress_root, 'wp-config.php')
        self.wp_config = parse_wp_config(wp_config_path)

        if not self.wp_config.get('DB_NAME'):
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message="Could not parse wp-config.php",
                details={"error": "Failed to extract database configuration from wp-config.php"}
            )

        # Initialize results
        results = {
            "wordpress_root": self.wordpress_root,
            "check_time": datetime.utcnow().isoformat(),
        }
        issues = []
        warnings = []

        try:
            # Import MySQL connector
            try:
                import mysql.connector
            except ImportError:
                return CheckResult(
                    status=CheckStatus.ERROR,
                    score=0,
                    message="mysql-connector-python not installed",
                    details={"error": "Please install mysql-connector-python: pip install mysql-connector-python"}
                )

            # Connect to database
            db_host = self.wp_config.get('DB_HOST', 'localhost')
            db_port = 3306

            # Handle host:port format
            if ':' in db_host and db_host.count(':') == 1:
                host_parts = db_host.split(':')
                db_host = host_parts[0]
                if host_parts[1].isdigit():
                    db_port = int(host_parts[1])

            logger.info(f"Connecting to MySQL: {db_host}:{db_port}, database: {self.wp_config.get('DB_NAME')}")

            self.db_connection = mysql.connector.connect(
                host=db_host,
                port=db_port,
                user=self.wp_config.get('DB_USER'),
                password=self.wp_config.get('DB_PASSWORD', ''),
                database=self.wp_config.get('DB_NAME'),
                connection_timeout=30
            )

            # Run all checks
            if self.config.get('check_version', True):
                version_result = self._check_version()
                results['version'] = version_result
                if version_result.get('is_outdated'):
                    if version_result.get('versions_behind', 0) >= 2:
                        issues.append(f"WordPress severely outdated: {version_result.get('current_version')} (latest: {LATEST_WORDPRESS_VERSION})")
                    else:
                        warnings.append(f"WordPress update available: {version_result.get('current_version')} -> {LATEST_WORDPRESS_VERSION}")

            if self.config.get('check_plugins', True):
                plugins_result = self._check_plugins()
                results['plugins'] = plugins_result

            if self.config.get('check_theme', True):
                theme_result = self._check_theme()
                results['theme'] = theme_result

            if self.config.get('check_database_size', True):
                db_result = self._check_database_size()
                results['database'] = db_result

            if self.config.get('check_disk_usage', True):
                disk_result = self._check_disk_usage()
                results['disk'] = disk_result
                results['large_folders'] = disk_result.get('large_folders', {})
                results['largest_files'] = disk_result.get('largest_files', [])

            if self.config.get('check_security', True):
                security_result = self._check_security()
                results['security'] = security_result
                if security_result.get('debug_enabled'):
                    warnings.append("WP_DEBUG is enabled in production")
                if not security_result.get('file_edit_disabled'):
                    warnings.append("File editing is enabled (DISALLOW_FILE_EDIT not set)")

            if self.config.get('check_content_stats', True):
                content_result = self._check_content_stats()
                results['content'] = content_result

            # Check cache status
            if self.config.get('check_cache', True):
                cache_result = self._check_cache()
                results['cache'] = cache_result

            # Check for WooCommerce and gather data if active
            if self._is_woocommerce_active():
                woo_result = self._check_woocommerce()
                results['woocommerce'] = woo_result

            # Determine status
            if issues:
                status = CheckStatus.CRITICAL
                score = 30
                message = "; ".join(issues[:2])
            elif warnings:
                status = CheckStatus.WARNING
                score = 70
                message = "; ".join(warnings[:2])
            else:
                status = CheckStatus.PASSED
                score = 100
                message = f"WordPress {results.get('version', {}).get('current_version', 'unknown')} healthy"

            results['issues'] = issues
            results['warnings'] = warnings
            results['duration_ms'] = int((time.time() - start_time) * 1000)

            return CheckResult(
                status=status,
                score=score,
                message=message,
                details=results
            )

        except mysql.connector.Error as e:
            logger.error(f"MySQL error: {e}")
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Database connection failed: {e.msg if hasattr(e, 'msg') else str(e)}",
                details={"error": str(e), "error_code": e.errno if hasattr(e, 'errno') else None}
            )
        except Exception as e:
            logger.error(f"WordPress health check error: {e}", exc_info=True)
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Check failed: {str(e)}",
                details={"error": str(e)}
            )
        finally:
            if self.db_connection:
                try:
                    self.db_connection.close()
                except:
                    pass

    def _check_version(self) -> Dict[str, Any]:
        """Check WordPress version."""
        result = {
            "current_version": None,
            "latest_version": LATEST_WORDPRESS_VERSION,
            "is_outdated": False,
            "versions_behind": 0
        }

        try:
            # Try to read version from wp-includes/version.php
            version_file = os.path.join(self.wordpress_root, 'wp-includes', 'version.php')
            if os.path.isfile(version_file):
                with open(version_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Extract $wp_version = '6.4.2';
                version_match = re.search(r"\$wp_version\s*=\s*['\"]([^'\"]+)['\"]", content)
                if version_match:
                    result['current_version'] = version_match.group(1)
                    logger.info(f"WordPress version from file: {result['current_version']}")

            # Fallback: try database
            if not result['current_version']:
                cursor = self.db_connection.cursor(dictionary=True)
                prefix = self.wp_config.get('table_prefix', 'wp_')
                cursor.execute(f"SELECT option_value FROM {prefix}options WHERE option_name = 'siteurl' LIMIT 1")
                # Version not directly in options, but we have the file method

            # Calculate if outdated
            if result['current_version']:
                current_major = '.'.join(result['current_version'].split('.')[:2])
                latest_major = '.'.join(LATEST_WORDPRESS_VERSION.split('.')[:2])

                version_list = list(WORDPRESS_VERSIONS.keys())
                if current_major in version_list and latest_major in version_list:
                    current_idx = version_list.index(current_major)
                    latest_idx = version_list.index(latest_major)
                    result['versions_behind'] = current_idx - latest_idx
                    result['is_outdated'] = result['versions_behind'] > 0

        except Exception as e:
            logger.error(f"Error checking WordPress version: {e}")
            result['error'] = str(e)

        return result

    def _check_plugins(self) -> Dict[str, Any]:
        """Check installed plugins."""
        result = {
            "total": 0,
            "active": 0,
            "inactive": 0,
            "list": []
        }

        try:
            cursor = self.db_connection.cursor(dictionary=True)
            prefix = self.wp_config.get('table_prefix', 'wp_')

            # Get active plugins from database
            cursor.execute(f"SELECT option_value FROM {prefix}options WHERE option_name = 'active_plugins' LIMIT 1")
            row = cursor.fetchone()

            active_plugins = []
            if row and row.get('option_value'):
                try:
                    # WordPress stores as PHP serialized array, we need to parse it
                    active_plugins = self._parse_php_serialized_array(row['option_value'])
                except Exception as e:
                    logger.warning(f"Could not parse active_plugins: {e}")

            # Scan plugins directory
            plugins_dir = os.path.join(self.wordpress_root, 'wp-content', 'plugins')
            if os.path.isdir(plugins_dir):
                for item in os.listdir(plugins_dir):
                    item_path = os.path.join(plugins_dir, item)

                    # Skip files, only process directories
                    if not os.path.isdir(item_path):
                        # Single-file plugins
                        if item.endswith('.php'):
                            plugin_info = self._get_plugin_info_from_file(item_path)
                            if plugin_info:
                                plugin_info['slug'] = item.replace('.php', '')
                                plugin_info['active'] = item in active_plugins or any(item in ap for ap in active_plugins)
                                result['list'].append(plugin_info)
                        continue

                    # Look for main plugin file
                    main_file = os.path.join(item_path, f"{item}.php")
                    if not os.path.isfile(main_file):
                        # Try to find any PHP file with Plugin Name header
                        for php_file in os.listdir(item_path):
                            if php_file.endswith('.php'):
                                test_path = os.path.join(item_path, php_file)
                                if self._is_plugin_file(test_path):
                                    main_file = test_path
                                    break

                    if os.path.isfile(main_file):
                        plugin_info = self._get_plugin_info_from_file(main_file)
                        if plugin_info:
                            plugin_info['slug'] = item
                            # Check if active
                            plugin_info['active'] = any(item in ap for ap in active_plugins)
                            result['list'].append(plugin_info)

            result['total'] = len(result['list'])
            result['active'] = sum(1 for p in result['list'] if p.get('active'))
            result['inactive'] = result['total'] - result['active']

            # Sort by active status, then by name
            result['list'].sort(key=lambda x: (not x.get('active', False), x.get('name', '').lower()))

        except Exception as e:
            logger.error(f"Error checking plugins: {e}")
            result['error'] = str(e)

        return result

    def _get_plugin_info_from_file(self, filepath: str) -> Optional[Dict[str, Any]]:
        """Extract plugin information from plugin file header."""
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read(8192)  # Read first 8KB

            info = {}

            # Plugin Name: ...
            name_match = re.search(r'Plugin Name:\s*(.+)', content)
            if name_match:
                info['name'] = name_match.group(1).strip()
            else:
                return None  # Not a valid plugin file

            # Version: ...
            version_match = re.search(r'Version:\s*(.+)', content)
            if version_match:
                info['version'] = version_match.group(1).strip()

            # Author: ...
            author_match = re.search(r'Author:\s*(.+)', content)
            if author_match:
                info['author'] = author_match.group(1).strip()

            # Description: ...
            desc_match = re.search(r'Description:\s*(.+)', content)
            if desc_match:
                info['description'] = desc_match.group(1).strip()[:200]  # Truncate

            return info

        except Exception as e:
            logger.debug(f"Could not read plugin file {filepath}: {e}")
            return None

    def _is_plugin_file(self, filepath: str) -> bool:
        """Check if a PHP file is a WordPress plugin."""
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read(4096)
            return 'Plugin Name:' in content
        except:
            return False

    def _parse_php_serialized_array(self, serialized: str) -> List[str]:
        """Parse a PHP serialized array (simple version for string arrays)."""
        # PHP serialized format: a:2:{i:0;s:19:"akismet/akismet.php";i:1;s:9:"hello.php";}
        result = []
        try:
            # Find all string values in the serialized data
            pattern = r's:(\d+):"([^"]+)"'
            matches = re.findall(pattern, serialized)
            for length, value in matches:
                if '/' in value or value.endswith('.php'):
                    result.append(value)
        except Exception as e:
            logger.debug(f"Error parsing PHP serialized array: {e}")
        return result

    def _check_theme(self) -> Dict[str, Any]:
        """Check active theme."""
        result = {
            "name": None,
            "version": None,
            "is_child_theme": False,
            "parent_theme": None,
            "directory_size": None
        }

        try:
            cursor = self.db_connection.cursor(dictionary=True)
            prefix = self.wp_config.get('table_prefix', 'wp_')

            # Get current theme
            cursor.execute(f"""
                SELECT option_name, option_value
                FROM {prefix}options
                WHERE option_name IN ('template', 'stylesheet', 'current_theme')
            """)

            options = {}
            for row in cursor.fetchall():
                options[row['option_name']] = row['option_value']

            template = options.get('template')  # Parent theme
            stylesheet = options.get('stylesheet')  # Current theme (could be child)

            result['is_child_theme'] = template != stylesheet if template and stylesheet else False

            if result['is_child_theme']:
                result['parent_theme'] = template

            # Read theme info from style.css
            theme_dir = os.path.join(self.wordpress_root, 'wp-content', 'themes', stylesheet or template or '')
            style_css = os.path.join(theme_dir, 'style.css')

            if os.path.isfile(style_css):
                with open(style_css, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read(4096)

                # Theme Name: ...
                name_match = re.search(r'Theme Name:\s*(.+)', content)
                if name_match:
                    result['name'] = name_match.group(1).strip()

                # Version: ...
                version_match = re.search(r'Version:\s*(.+)', content)
                if version_match:
                    result['version'] = version_match.group(1).strip()

            # Get theme directory size
            if os.path.isdir(theme_dir):
                size, _ = get_directory_size(theme_dir)
                result['directory_size'] = format_bytes(size)
                result['directory_size_bytes'] = size

        except Exception as e:
            logger.error(f"Error checking theme: {e}")
            result['error'] = str(e)

        return result

    def _check_database_size(self) -> Dict[str, Any]:
        """Check database size and largest tables."""
        result = {
            "wordpress_database": self.wp_config.get('DB_NAME'),
            "wordpress_database_size_bytes": 0,
            "wordpress_database_size_human": "0 B",
            "all_databases": [],
            "largest_tables": []
        }

        try:
            cursor = self.db_connection.cursor(dictionary=True)
            wp_db = self.wp_config.get('DB_NAME')

            # Get all databases
            cursor.execute("""
                SELECT
                    table_schema AS db_name,
                    SUM(data_length + index_length) AS size_bytes
                FROM information_schema.TABLES
                WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
                GROUP BY table_schema
                ORDER BY size_bytes DESC
            """)

            for row in cursor.fetchall():
                db_name = row.get('db_name') or row.get('DB_NAME')
                size_bytes = int(row.get('size_bytes') or row.get('SIZE_BYTES') or 0)

                db_info = {
                    "database": db_name,
                    "size": format_bytes(size_bytes),
                    "size_bytes": size_bytes,
                    "is_wordpress": db_name == wp_db
                }
                result['all_databases'].append(db_info)

                if db_name == wp_db:
                    result['wordpress_database_size_bytes'] = size_bytes
                    result['wordpress_database_size_human'] = format_bytes(size_bytes)

            # Get largest tables in WordPress database
            cursor.execute(f"""
                SELECT
                    table_name,
                    data_length + index_length AS size_bytes,
                    table_rows
                FROM information_schema.TABLES
                WHERE table_schema = %s
                ORDER BY size_bytes DESC
                LIMIT 10
            """, (wp_db,))

            for row in cursor.fetchall():
                table_name = row.get('table_name') or row.get('TABLE_NAME')
                size_bytes = int(row.get('size_bytes') or row.get('SIZE_BYTES') or 0)
                table_rows = row.get('table_rows') or row.get('TABLE_ROWS') or 0

                result['largest_tables'].append({
                    "table": table_name,
                    "size": format_bytes(size_bytes),
                    "size_bytes": size_bytes,
                    "rows": table_rows
                })

        except Exception as e:
            logger.error(f"Error checking database size: {e}")
            result['error'] = str(e)

        return convert_decimal(result)

    def _check_disk_usage(self) -> Dict[str, Any]:
        """Check disk usage for WordPress directories."""
        result = {
            "large_folders": {},
            "largest_files": [],
            "total_wordpress_size": 0
        }

        directories = [
            ('uploads', 'wp-content/uploads'),
            ('plugins', 'wp-content/plugins'),
            ('themes', 'wp-content/themes'),
            ('cache', 'wp-content/cache'),
            ('backups', 'wp-content/backups'),
            ('upgrade', 'wp-content/upgrade'),
        ]

        total_size = 0

        for name, rel_path in directories:
            dir_path = os.path.join(self.wordpress_root, rel_path)
            if os.path.isdir(dir_path):
                size, file_count = get_directory_size(dir_path)
                result['large_folders'][name] = {
                    "path": rel_path,
                    "size": format_bytes(size),
                    "size_bytes": size,
                    "files": file_count
                }
                total_size += size

        # Get WordPress core size
        core_dirs = ['wp-admin', 'wp-includes']
        for core_dir in core_dirs:
            dir_path = os.path.join(self.wordpress_root, core_dir)
            if os.path.isdir(dir_path):
                size, _ = get_directory_size(dir_path)
                total_size += size

        result['total_wordpress_size'] = total_size
        result['total_wordpress_size_human'] = format_bytes(total_size)

        # Find largest files
        result['largest_files'] = self._find_largest_files()

        return result

    def _find_largest_files(self, top_n: int = 10, min_size_mb: float = 1.0) -> List[Dict[str, Any]]:
        """Find the largest files in WordPress installation."""
        min_size_bytes = int(min_size_mb * 1024 * 1024)
        largest = []

        scan_dirs = [
            'wp-content/uploads',
            'wp-content/backups',
            'wp-content/cache',
        ]

        for rel_dir in scan_dirs:
            dir_path = os.path.join(self.wordpress_root, rel_dir)
            if not os.path.isdir(dir_path):
                continue

            try:
                for root, dirs, files in os.walk(dir_path):
                    # Skip hidden directories
                    dirs[:] = [d for d in dirs if not d.startswith('.')]

                    for filename in files:
                        if filename.startswith('.'):
                            continue

                        filepath = os.path.join(root, filename)
                        try:
                            if os.path.islink(filepath):
                                continue
                            size = os.path.getsize(filepath)
                            if size >= min_size_bytes:
                                rel_path = os.path.relpath(filepath, self.wordpress_root)

                                if len(largest) < top_n:
                                    heapq.heappush(largest, (size, rel_path))
                                elif size > largest[0][0]:
                                    heapq.heapreplace(largest, (size, rel_path))
                        except (OSError, PermissionError):
                            pass
            except (OSError, PermissionError) as e:
                logger.warning(f"Error scanning {dir_path}: {e}")

        # Sort by size descending
        result = []
        for size, path in sorted(largest, reverse=True):
            result.append({
                "path": path,
                "size": format_bytes(size),
                "size_bytes": size
            })

        return result

    def _check_security(self) -> Dict[str, Any]:
        """Check WordPress security settings."""
        result = {
            "debug_enabled": self.wp_config.get('WP_DEBUG', False),
            "debug_log_enabled": self.wp_config.get('WP_DEBUG_LOG', False),
            "debug_display": self.wp_config.get('WP_DEBUG_DISPLAY', True),
            "file_edit_disabled": self.wp_config.get('DISALLOW_FILE_EDIT', False),
            "file_mods_disabled": self.wp_config.get('DISALLOW_FILE_MODS', False),
            "debug_log_size": None,
            "risk_level": "low",
            "issues": [],
            "recommendations": []
        }

        risks = 0

        # Check debug.log file
        debug_log = os.path.join(self.wordpress_root, 'wp-content', 'debug.log')
        if os.path.isfile(debug_log):
            try:
                size = os.path.getsize(debug_log)
                result['debug_log_size'] = format_bytes(size)
                result['debug_log_size_bytes'] = size
                if size > 100 * 1024 * 1024:  # > 100MB
                    result['issues'].append("Debug log is very large (>100MB)")
                    risks += 2
                elif size > 10 * 1024 * 1024:  # > 10MB
                    result['issues'].append("Debug log is large (>10MB)")
                    risks += 1
            except:
                pass

        # Debug mode check
        if result['debug_enabled']:
            result['issues'].append("WP_DEBUG is enabled")
            result['recommendations'].append("Disable WP_DEBUG in production")
            risks += 1

        if result['debug_display']:
            result['issues'].append("WP_DEBUG_DISPLAY is enabled")
            result['recommendations'].append("Set WP_DEBUG_DISPLAY to false")
            risks += 1

        # File editing check
        if not result['file_edit_disabled']:
            result['issues'].append("File editing enabled in admin")
            result['recommendations'].append("Add define('DISALLOW_FILE_EDIT', true) to wp-config.php")
            risks += 1

        # Check wp-config.php permissions
        wp_config_path = os.path.join(self.wordpress_root, 'wp-config.php')
        if os.path.isfile(wp_config_path):
            try:
                import stat
                mode = os.stat(wp_config_path).st_mode
                perms = stat.filemode(mode)
                result['wp_config_permissions'] = perms
                # Check if world-readable (last 3 chars should be ---)
                if mode & stat.S_IROTH:
                    result['issues'].append("wp-config.php is world-readable")
                    result['recommendations'].append("Set wp-config.php permissions to 640 or 600")
                    risks += 1
            except:
                pass

        # Check .htaccess exists (Apache security)
        htaccess_path = os.path.join(self.wordpress_root, '.htaccess')
        result['htaccess_exists'] = os.path.isfile(htaccess_path)

        # Check if wp-content/uploads has PHP execution blocked
        uploads_htaccess = os.path.join(self.wordpress_root, 'wp-content', 'uploads', '.htaccess')
        result['uploads_protected'] = False
        if os.path.isfile(uploads_htaccess):
            try:
                with open(uploads_htaccess, 'r') as f:
                    content = f.read().lower()
                    if 'php' in content and ('deny' in content or 'none' in content):
                        result['uploads_protected'] = True
            except:
                pass
        if not result['uploads_protected']:
            result['recommendations'].append("Block PHP execution in wp-content/uploads")

        # Check XML-RPC status (via plugin or .htaccess)
        result['xmlrpc_file_exists'] = os.path.isfile(os.path.join(self.wordpress_root, 'xmlrpc.php'))
        if result['xmlrpc_file_exists']:
            result['recommendations'].append("Consider disabling XML-RPC if not needed")

        # Check for security plugins
        result['security_plugins'] = []
        security_plugin_slugs = [
            'wordfence', 'sucuri-scanner', 'all-in-one-wp-security-and-firewall',
            'ithemes-security', 'better-wp-security', 'wp-security-audit-log',
            'defender-security', 'security-ninja', 'bulletproof-security'
        ]
        plugins_dir = os.path.join(self.wordpress_root, 'wp-content', 'plugins')
        if os.path.isdir(plugins_dir):
            for plugin in os.listdir(plugins_dir):
                if any(sec in plugin.lower() for sec in security_plugin_slugs):
                    result['security_plugins'].append(plugin)

        if not result['security_plugins']:
            result['recommendations'].append("Consider installing a security plugin")

        # Check database table prefix
        prefix = self.wp_config.get('table_prefix', 'wp_')
        result['table_prefix'] = prefix
        if prefix == 'wp_':
            result['recommendations'].append("Consider changing default table prefix 'wp_'")

        # Determine overall risk level
        if risks >= 4:
            result['risk_level'] = "high"
        elif risks >= 2:
            result['risk_level'] = "medium"
        else:
            result['risk_level'] = "low"

        result['risk_score'] = risks

        return result

    def _check_cache(self) -> Dict[str, Any]:
        """Check WordPress caching status and plugins."""
        result = {
            "is_enabled": False,
            "plugin": None,
            "plugin_name": None,
            "cache_type": None,
            "cache_directory_size": None,
            "cache_directory_size_bytes": 0,
            "details": {}
        }

        # Known caching plugins and their identifiers
        cache_plugins = {
            'wp-super-cache': {
                'name': 'WP Super Cache',
                'config_file': 'wp-content/wp-cache-config.php',
                'cache_dir': 'wp-content/cache/supercache',
                'option_name': 'wpsupercache_settings'
            },
            'w3-total-cache': {
                'name': 'W3 Total Cache',
                'config_file': 'wp-content/w3tc-config',
                'cache_dir': 'wp-content/cache',
                'option_name': 'w3tc_config_master'
            },
            'wp-rocket': {
                'name': 'WP Rocket',
                'config_file': 'wp-content/wp-rocket-config',
                'cache_dir': 'wp-content/cache/wp-rocket',
                'option_name': 'wp_rocket_settings'
            },
            'litespeed-cache': {
                'name': 'LiteSpeed Cache',
                'cache_dir': 'wp-content/cache/litespeed',
                'option_name': 'litespeed.conf'
            },
            'wp-fastest-cache': {
                'name': 'WP Fastest Cache',
                'cache_dir': 'wp-content/cache/all',
                'option_name': 'WpFastestCache'
            },
            'autoptimize': {
                'name': 'Autoptimize',
                'cache_dir': 'wp-content/cache/autoptimize',
                'option_name': 'autoptimize_css'
            },
            'cache-enabler': {
                'name': 'Cache Enabler',
                'cache_dir': 'wp-content/cache/cache-enabler',
                'option_name': 'cache_enabler'
            },
            'hummingbird-performance': {
                'name': 'Hummingbird',
                'cache_dir': 'wp-content/cache/hummingbird',
                'option_name': 'wphb-caching-page_cache'
            },
            'breeze': {
                'name': 'Breeze (Cloudways)',
                'cache_dir': 'wp-content/cache/breeze',
                'option_name': 'breeze_basic_settings'
            },
            'sg-cachepress': {
                'name': 'SG Optimizer (SiteGround)',
                'cache_dir': 'wp-content/cache',
                'option_name': 'siteground_optimizer_supercacher_permissions'
            }
        }

        try:
            # Check plugins directory for installed cache plugins
            plugins_dir = os.path.join(self.wordpress_root, 'wp-content', 'plugins')
            detected_plugins = []

            if os.path.isdir(plugins_dir):
                for plugin_slug, info in cache_plugins.items():
                    plugin_path = os.path.join(plugins_dir, plugin_slug)
                    if os.path.isdir(plugin_path):
                        detected_plugins.append({
                            'slug': plugin_slug,
                            'name': info['name'],
                            'info': info
                        })

            result['detected_plugins'] = [p['name'] for p in detected_plugins]

            # Check if any cache plugin is active
            cursor = self.db_connection.cursor(dictionary=True)
            prefix = self.wp_config.get('table_prefix', 'wp_')
            cursor.execute(f"SELECT option_value FROM {prefix}options WHERE option_name = 'active_plugins' LIMIT 1")
            row = cursor.fetchone()

            active_plugins_str = row.get('option_value', '') if row else ''

            for plugin in detected_plugins:
                if plugin['slug'] in active_plugins_str:
                    result['is_enabled'] = True
                    result['plugin'] = plugin['slug']
                    result['plugin_name'] = plugin['name']

                    # Check cache directory
                    cache_dir = os.path.join(self.wordpress_root, plugin['info'].get('cache_dir', 'wp-content/cache'))
                    if os.path.isdir(cache_dir):
                        size, file_count = get_directory_size(cache_dir)
                        result['cache_directory_size'] = format_bytes(size)
                        result['cache_directory_size_bytes'] = size
                        result['details']['cache_files'] = file_count

                    # Try to get cache settings from database
                    option_name = plugin['info'].get('option_name')
                    if option_name:
                        cursor.execute(f"SELECT option_value FROM {prefix}options WHERE option_name = %s LIMIT 1", (option_name,))
                        settings_row = cursor.fetchone()
                        if settings_row:
                            result['details']['settings_found'] = True

                    break

            # Even if no plugin detected, check for generic cache directory
            if not result['is_enabled']:
                cache_dir = os.path.join(self.wordpress_root, 'wp-content', 'cache')
                if os.path.isdir(cache_dir):
                    size, file_count = get_directory_size(cache_dir)
                    if size > 0:
                        result['cache_directory_size'] = format_bytes(size)
                        result['cache_directory_size_bytes'] = size
                        result['details']['cache_files'] = file_count
                        result['details']['cache_dir_exists'] = True

            # Check for WP_CACHE constant
            result['wp_cache_enabled'] = self.wp_config.get('WP_CACHE', False)
            if result['wp_cache_enabled'] and not result['is_enabled']:
                result['is_enabled'] = True
                result['cache_type'] = 'wp_cache_constant'

            # Determine cache type
            if result['plugin']:
                result['cache_type'] = 'plugin'
            elif result['wp_cache_enabled']:
                result['cache_type'] = 'constant'

            # Check for object cache
            object_cache_file = os.path.join(self.wordpress_root, 'wp-content', 'object-cache.php')
            result['object_cache_enabled'] = os.path.isfile(object_cache_file)
            if result['object_cache_enabled']:
                # Try to detect which object cache
                try:
                    with open(object_cache_file, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read(4096)
                        if 'redis' in content.lower():
                            result['object_cache_type'] = 'Redis'
                        elif 'memcache' in content.lower():
                            result['object_cache_type'] = 'Memcached'
                        elif 'apcu' in content.lower():
                            result['object_cache_type'] = 'APCu'
                        else:
                            result['object_cache_type'] = 'Unknown'
                except:
                    result['object_cache_type'] = 'Unknown'

        except Exception as e:
            logger.error(f"Error checking cache: {e}")
            result['error'] = str(e)

        return result

    def _check_content_stats(self) -> Dict[str, Any]:
        """Check content statistics."""
        result = {
            "posts": {"total": 0, "published": 0},
            "pages": {"total": 0, "published": 0},
            "comments": {"total": 0, "approved": 0, "pending": 0, "spam": 0},
            "recent_posts": 0
        }

        try:
            cursor = self.db_connection.cursor(dictionary=True)
            prefix = self.wp_config.get('table_prefix', 'wp_')

            # Posts count
            cursor.execute(f"""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN post_status = 'publish' THEN 1 ELSE 0 END) as published
                FROM {prefix}posts
                WHERE post_type = 'post'
            """)
            row = cursor.fetchone()
            if row:
                result['posts']['total'] = row.get('total', 0)
                result['posts']['published'] = row.get('published', 0)

            # Pages count
            cursor.execute(f"""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN post_status = 'publish' THEN 1 ELSE 0 END) as published
                FROM {prefix}posts
                WHERE post_type = 'page'
            """)
            row = cursor.fetchone()
            if row:
                result['pages']['total'] = row.get('total', 0)
                result['pages']['published'] = row.get('published', 0)

            # Comments count
            cursor.execute(f"""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN comment_approved = '1' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN comment_approved = '0' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN comment_approved = 'spam' THEN 1 ELSE 0 END) as spam
                FROM {prefix}comments
            """)
            row = cursor.fetchone()
            if row:
                result['comments']['total'] = row.get('total', 0)
                result['comments']['approved'] = row.get('approved', 0)
                result['comments']['pending'] = row.get('pending', 0)
                result['comments']['spam'] = row.get('spam', 0)

            # Recent posts (last 7 days)
            cursor.execute(f"""
                SELECT COUNT(*) as count
                FROM {prefix}posts
                WHERE post_type = 'post'
                AND post_status = 'publish'
                AND post_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            """)
            row = cursor.fetchone()
            if row:
                result['recent_posts'] = row.get('count', 0)

        except Exception as e:
            logger.error(f"Error checking content stats: {e}")
            result['error'] = str(e)

        return convert_decimal(result)

    def _is_woocommerce_active(self) -> bool:
        """Check if WooCommerce plugin is active."""
        try:
            cursor = self.db_connection.cursor(dictionary=True)
            prefix = self.wp_config.get('table_prefix', 'wp_')

            cursor.execute(f"SELECT option_value FROM {prefix}options WHERE option_name = 'active_plugins' LIMIT 1")
            row = cursor.fetchone()

            if row and row.get('option_value'):
                return 'woocommerce/woocommerce.php' in row['option_value']

            return False
        except:
            return False

    def _check_woocommerce(self) -> Dict[str, Any]:
        """Check WooCommerce specific data."""
        result = {
            "is_active": True,
            "orders": {
                "total": 0,
                "recent_7_days": 0,
                "by_status": {}
            },
            "products": {
                "total": 0,
                "published": 0,
                "out_of_stock": 0
            },
            "customers": 0
        }

        try:
            cursor = self.db_connection.cursor(dictionary=True)
            prefix = self.wp_config.get('table_prefix', 'wp_')

            # WooCommerce stores orders as custom post types 'shop_order'
            # In WooCommerce 8.x+, orders may be in custom tables (wc_orders)

            # Try new WooCommerce tables first (HPOS - High Performance Order Storage)
            try:
                cursor.execute(f"SHOW TABLES LIKE '{prefix}wc_orders'")
                has_hpos = cursor.fetchone() is not None
            except:
                has_hpos = False

            if has_hpos:
                # New WooCommerce HPOS tables
                cursor.execute(f"""
                    SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN date_created_gmt >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as recent
                    FROM {prefix}wc_orders
                """)
                row = cursor.fetchone()
                if row:
                    result['orders']['total'] = row.get('total', 0)
                    result['orders']['recent_7_days'] = row.get('recent', 0)

                # Orders by status
                cursor.execute(f"""
                    SELECT status, COUNT(*) as count
                    FROM {prefix}wc_orders
                    GROUP BY status
                """)
                for row in cursor.fetchall():
                    status = row.get('status', 'unknown')
                    result['orders']['by_status'][status] = row.get('count', 0)

            else:
                # Legacy: orders stored as posts
                cursor.execute(f"""
                    SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN post_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as recent
                    FROM {prefix}posts
                    WHERE post_type = 'shop_order'
                """)
                row = cursor.fetchone()
                if row:
                    result['orders']['total'] = row.get('total', 0)
                    result['orders']['recent_7_days'] = row.get('recent', 0)

                # Orders by status
                cursor.execute(f"""
                    SELECT post_status as status, COUNT(*) as count
                    FROM {prefix}posts
                    WHERE post_type = 'shop_order'
                    GROUP BY post_status
                """)
                for row in cursor.fetchall():
                    status = row.get('status', 'unknown').replace('wc-', '')
                    result['orders']['by_status'][status] = row.get('count', 0)

            # Products count
            cursor.execute(f"""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN post_status = 'publish' THEN 1 ELSE 0 END) as published
                FROM {prefix}posts
                WHERE post_type = 'product'
            """)
            row = cursor.fetchone()
            if row:
                result['products']['total'] = row.get('total', 0)
                result['products']['published'] = row.get('published', 0)

            # Out of stock products
            cursor.execute(f"""
                SELECT COUNT(DISTINCT p.ID) as count
                FROM {prefix}posts p
                JOIN {prefix}postmeta pm ON p.ID = pm.post_id
                WHERE p.post_type = 'product'
                AND p.post_status = 'publish'
                AND pm.meta_key = '_stock_status'
                AND pm.meta_value = 'outofstock'
            """)
            row = cursor.fetchone()
            if row:
                result['products']['out_of_stock'] = row.get('count', 0)

            # Customer count (users with customer role)
            cursor.execute(f"""
                SELECT COUNT(*) as count
                FROM {prefix}users u
                JOIN {prefix}usermeta um ON u.ID = um.user_id
                WHERE um.meta_key = '{prefix}capabilities'
                AND um.meta_value LIKE '%customer%'
            """)
            row = cursor.fetchone()
            if row:
                result['customers'] = row.get('count', 0)

        except Exception as e:
            logger.error(f"Error checking WooCommerce: {e}")
            result['error'] = str(e)

        return convert_decimal(result)
