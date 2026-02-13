"""
Magento 2 Health Check implementation.

Monitors Magento 2 installations for:
- Recent orders by day
- Magento version (current vs latest)
- Security patches and vulnerabilities
- Database size
- Large folders
- var/ directory breakdown

Database credentials are automatically extracted from app/etc/env.php
if not provided in the configuration.
"""

import json
import os
import re
import time
import logging
import requests
import traceback
import subprocess
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from ..base import BaseCheck, CheckResult, CheckStatus
from ..registry import CheckRegistry

logger = logging.getLogger(__name__)


def parse_magento_env_php(env_php_path: str) -> Dict[str, Any]:
    """
    Parse Magento's app/etc/env.php file to extract database credentials.

    Args:
        env_php_path: Path to the env.php file

    Returns:
        Dictionary with db credentials (host, dbname, username, password, port)
        or empty dict if parsing fails
    """
    if not os.path.isfile(env_php_path):
        logger.warning(f"env.php not found at: {env_php_path}")
        return {}

    try:
        logger.info(f"Reading env.php from: {env_php_path}")
        with open(env_php_path, 'r', encoding='utf-8') as f:
            content = f.read()

        logger.debug(f"env.php file size: {len(content)} bytes")

        # Extract database configuration using regex
        # The structure is: 'db' => ['connection' => ['default' => [credentials...]]]
        # We need to find the db connection block first, then extract credentials from it
        db_config = {}

        # First, try to find the 'db' => [...] section and extract the connection block
        # Look for 'connection' => [ ... 'default' => [ ... ] ]
        # This regex finds the default connection block content
        db_connection_match = re.search(
            r"'db'\s*=>\s*\[.*?'connection'\s*=>\s*\[.*?'default'\s*=>\s*\[(.*?)\]\s*\]",
            content,
            re.DOTALL
        )

        if db_connection_match:
            db_block = db_connection_match.group(1)
            logger.debug(f"Found db connection block ({len(db_block)} chars)")
        else:
            # Fallback: try to find block containing 'dbname' (unique to db config)
            # Find text around 'dbname' keyword
            dbname_pos = content.find("'dbname'")
            if dbname_pos == -1:
                dbname_pos = content.find('"dbname"')

            if dbname_pos != -1:
                # Extract ~500 chars around dbname as the db block
                start = max(0, dbname_pos - 200)
                end = min(len(content), dbname_pos + 300)
                db_block = content[start:end]
                logger.debug(f"Using fallback: extracted {len(db_block)} chars around 'dbname'")
            else:
                # Last resort: use entire content (old behavior)
                db_block = content
                logger.warning("Could not isolate db connection block, using entire file")

        # Now extract credentials from the db_block only
        # Extract host
        host_match = re.search(r"'host'\s*=>\s*'([^']+)'", db_block)
        if not host_match:
            host_match = re.search(r'"host"\s*=>\s*"([^"]+)"', db_block)
        if host_match:
            db_config['host'] = host_match.group(1)
            logger.debug(f"Found host: {host_match.group(1)}")

        # Extract dbname
        dbname_match = re.search(r"'dbname'\s*=>\s*'([^']+)'", db_block)
        if not dbname_match:
            dbname_match = re.search(r'"dbname"\s*=>\s*"([^"]+)"', db_block)
        if dbname_match:
            db_config['dbname'] = dbname_match.group(1)
            logger.debug(f"Found dbname: {dbname_match.group(1)}")

        # Extract username
        username_match = re.search(r"'username'\s*=>\s*'([^']+)'", db_block)
        if not username_match:
            username_match = re.search(r'"username"\s*=>\s*"([^"]+)"', db_block)
        if username_match:
            db_config['username'] = username_match.group(1)
            logger.debug(f"Found username: {username_match.group(1)}")

        # Extract password - handle empty passwords and special characters
        password_match = re.search(r"'password'\s*=>\s*'([^']*)'", db_block)
        if password_match:
            db_config['password'] = password_match.group(1)
            logger.debug(f"Found password in env.php (single quotes, length: {len(password_match.group(1))})")
        else:
            # Try double quotes
            password_match = re.search(r'"password"\s*=>\s*"([^"]*)"', db_block)
            if password_match:
                db_config['password'] = password_match.group(1)
                logger.debug(f"Found password in env.php (double quotes, length: {len(password_match.group(1))})")
            else:
                logger.warning("Password field not found in env.php - connection will fail")

        # Extract port (optional, defaults to 3306)
        port_match = re.search(r"'port'\s*=>\s*'?(\d+)'?", db_block)
        if port_match:
            db_config['port'] = int(port_match.group(1))

        # Handle host:port format (e.g., 'host' => 'localhost:3307')
        # But don't split IPv6 addresses like '::1' or '2001:db8::1'
        if 'host' in db_config and ':' in db_config['host']:
            host = db_config['host']
            # Only split if there's exactly one colon (host:port format, not IPv6)
            # IPv6 addresses have multiple colons or start with ':'
            if host.count(':') == 1 and not host.startswith(':'):
                host_parts = host.split(':')
                db_config['host'] = host_parts[0]
                if len(host_parts) > 1 and host_parts[1].isdigit():
                    db_config['port'] = int(host_parts[1])

        if db_config:
            logger.info(f"Successfully parsed env.php - found db: {db_config.get('dbname')}, user: {db_config.get('username')}, host: {db_config.get('host')}")

        return db_config

    except Exception as e:
        logger.error(f"Error parsing env.php: {e}")
        return {}

# Known Magento 2 versions - latest stable versions
# Update this list periodically
MAGENTO_VERSIONS = {
    "2.4.7": {"release_date": "2024-04-09", "security_patches": []},
    "2.4.6": {"release_date": "2023-03-14", "security_patches": ["p1", "p2", "p3", "p4", "p5", "p6"]},
    "2.4.5": {"release_date": "2022-08-09", "security_patches": ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]},
    "2.4.4": {"release_date": "2022-04-12", "security_patches": ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"]},
    "2.4.3": {"release_date": "2021-08-10", "security_patches": ["p1", "p2", "p3"]},
    "2.4.2": {"release_date": "2021-02-09", "security_patches": ["p1", "p2"]},
    "2.4.1": {"release_date": "2020-10-15", "security_patches": ["p1"]},
    "2.4.0": {"release_date": "2020-07-28", "security_patches": ["p1"]},
}

LATEST_MAGENTO_VERSION = "2.4.7"


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


@CheckRegistry.register('MAGENTO_HEALTH')
class MagentoHealthCheck(BaseCheck):
    """
    Comprehensive Magento 2 health monitoring check.

    Gathers:
    1. Recent orders by day
    2. Magento version status
    3. Security patches and vulnerabilities
    4. Database size
    5. Top 5 large folders
    6. var/ directory breakdown
    """

    @property
    def name(self) -> str:
        return "Magento 2 Health"

    @property
    def category(self) -> str:
        return "cms"

    def execute(self) -> CheckResult:
        """Execute all Magento health checks."""
        start_time = time.time()

        try:
            magento_root = self.config.get('magento_root')
            if not magento_root:
                return CheckResult(
                    status=CheckStatus.ERROR,
                    score=0,
                    message="magento_root path is required",
                    duration=time.time() - start_time
                )

            if not os.path.isdir(magento_root):
                return CheckResult(
                    status=CheckStatus.ERROR,
                    score=0,
                    message=f"Magento root directory not found: {magento_root}",
                    duration=time.time() - start_time
                )

            # Gather all check results
            details: Dict[str, Any] = {
                "magento_root": magento_root,
                "checked_at": datetime.utcnow().isoformat(),
            }

            issues: List[str] = []
            warnings: List[str] = []

            # 1. Check orders (if DB credentials provided)
            if self.config.get('check_orders', True):
                orders_result = self._check_orders()
                details['orders'] = orders_result
                if orders_result.get('error'):
                    warnings.append(f"Orders check failed: {orders_result['error']}")
                elif orders_result.get('warning'):
                    warnings.append(orders_result['warning'])

            # 1b. Check customer count
            if self.config.get('check_customers', True):
                customers_result = self._check_customers()
                details['customers'] = customers_result

            # 2. Check version
            if self.config.get('check_version', True):
                version_result = self._check_version(magento_root)
                details['version'] = version_result
                if version_result.get('is_outdated'):
                    if version_result.get('versions_behind', 0) >= 2:
                        issues.append(f"Magento version is critically outdated: {version_result.get('current_version')} (latest: {version_result.get('latest_version')})")
                    else:
                        warnings.append(f"Magento version is outdated: {version_result.get('current_version')} (latest: {version_result.get('latest_version')})")

            # 3. Check security
            if self.config.get('check_security', True):
                security_result = self._check_security(magento_root)
                details['security'] = security_result
                if security_result.get('risk_level') == 'critical':
                    issues.append("Critical security vulnerabilities detected")
                elif security_result.get('risk_level') == 'high':
                    warnings.append("Security issues detected")

            # 4. Check database size
            if self.config.get('check_database_size', True):
                db_result = self._check_database_size()
                details['database'] = db_result
                if db_result.get('error'):
                    warnings.append(f"Database check failed: {db_result['error']}")
                else:
                    warning_gb = self.config.get('database_size_warning_gb', 10)
                    size_gb = db_result.get('database_size_bytes', 0) / (1024**3)
                    if size_gb > warning_gb:
                        warnings.append(f"Database size ({size_gb:.1f} GB) exceeds warning threshold ({warning_gb} GB)")

            # 5. Check large folders
            if self.config.get('check_large_folders', True):
                folders_result = self._check_large_folders(magento_root)
                details['large_folders'] = folders_result

            # 6. Check var/ directory
            if self.config.get('check_var_directory', True):
                var_result = self._check_var_directory(magento_root)
                details['var_breakdown'] = var_result
                if var_result.get('total_var_size'):
                    warning_gb = self.config.get('var_size_warning_gb', 5)
                    var_size_gb = var_result['total_var_size_bytes'] / (1024**3)
                    if var_size_gb > warning_gb:
                        warnings.append(f"var/ directory size ({var_size_gb:.1f} GB) exceeds warning threshold ({warning_gb} GB)")

            # 7. Check cache status
            if self.config.get('check_cache_status', True):
                cache_result = self._check_cache_status()
                details['cache'] = cache_result
                if cache_result.get('error'):
                    warnings.append(f"Cache status check failed: {cache_result['error']}")
                elif cache_result.get('disabled_count', 0) > 0:
                    warnings.append(f"{cache_result['disabled_count']} cache type(s) disabled")

            # 8. Check indexer status
            if self.config.get('check_indexer_status', True):
                indexer_result = self._check_indexer_status()
                details['indexers'] = indexer_result
                if indexer_result.get('error'):
                    warnings.append(f"Indexer status check failed: {indexer_result['error']}")
                elif indexer_result.get('invalid_count', 0) > 0:
                    warnings.append(f"{indexer_result['invalid_count']} indexer(s) require reindex")

            # 9. Check developer mode
            if self.config.get('check_developer_mode', True):
                dev_mode_result = self._check_developer_mode(magento_root)
                details['developer_mode'] = dev_mode_result
                if dev_mode_result.get('is_developer'):
                    issues.append("Developer mode is enabled on production site")
                elif dev_mode_result.get('warning'):
                    warnings.append(dev_mode_result['warning'])

            # 10. Check log files for rotation issues
            if self.config.get('check_log_files', True):
                log_files_result = self._check_log_files(magento_root)
                details['log_files'] = log_files_result
                if log_files_result.get('critical_count', 0) > 0:
                    issues.append(f"{log_files_result['critical_count']} log file(s) exceed 50MB - rotation needed")
                elif log_files_result.get('warning_count', 0) > 0:
                    warnings.append(f"{log_files_result['warning_count']} log file(s) exceed 20MB - consider rotation")

            # 11. Check composer security audit for patches/vulnerabilities
            if self.config.get('check_patches', True):
                patches_result = self._check_composer_audit(magento_root)
                details['patches'] = patches_result
                if patches_result.get('status') == 'critical':
                    vuln_count = patches_result.get('total_vulnerabilities', 0)
                    issues.append(f"{vuln_count} security vulnerability/ies found - patches required")
                elif patches_result.get('status') == 'warning':
                    vuln_count = patches_result.get('total_vulnerabilities', 0)
                    warnings.append(f"{vuln_count} medium-severity vulnerability/ies found")
                elif patches_result.get('skipped'):
                    warnings.append(f"Security audit skipped: {patches_result.get('error', 'timeout')}")

            # Determine overall status and score
            if issues:
                status = CheckStatus.CRITICAL
                score = 30
                message = f"Critical issues found: {'; '.join(issues)}"
            elif warnings:
                status = CheckStatus.WARNING
                score = 70
                message = f"Warnings: {'; '.join(warnings)}"
            else:
                status = CheckStatus.PASSED
                score = 100
                message = "All Magento health checks passed"

            details['issues'] = issues
            details['warnings'] = warnings

            return CheckResult(
                status=status,
                score=score,
                message=message,
                details=details,
                duration=time.time() - start_time
            )

        except Exception as e:
            logger.exception("Magento health check failed")
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Check failed: {str(e)}",
                duration=time.time() - start_time
            )

    def _get_db_credentials(self) -> Dict[str, Any]:
        """
        Get database credentials from config or env.php.

        Priority:
        1. Explicitly provided config values
        2. Values from app/etc/env.php

        Returns:
            Dict with host, port, dbname, username, password
        """
        # Try to get credentials from env.php first
        magento_root = self.config.get('magento_root', '')
        env_php_path = os.path.join(magento_root, 'app', 'etc', 'env.php')
        env_credentials = parse_magento_env_php(env_php_path)

        # Use config values if provided, otherwise fall back to env.php values
        credentials = {
            'host': self.config.get('db_host') or env_credentials.get('host', 'localhost'),
            'port': self.config.get('db_port') or env_credentials.get('port', 3306),
            'dbname': self.config.get('db_name') or env_credentials.get('dbname'),
            'username': self.config.get('db_user') or env_credentials.get('username'),
            'password': self.config.get('db_password') if self.config.get('db_password') is not None else env_credentials.get('password'),
        }

        return credentials

    def _get_db_connection(self):
        """
        Get MySQL database connection.

        Credentials are obtained from config or automatically from env.php.

        Returns database connection or None if connection fails.
        """
        try:
            import mysql.connector
        except ImportError:
            logger.error("mysql-connector-python not installed")
            return None

        credentials = self._get_db_credentials()

        db_host = credentials.get('host', 'localhost')
        db_port = credentials.get('port', 3306)
        db_name = credentials.get('dbname')
        db_user = credentials.get('username')
        db_password = credentials.get('password')

        # Log credentials for debugging (mask password)
        logger.debug(f"DB Connection attempt - Host: {db_host}, Port: {db_port}, DB: {db_name}, User: {db_user}, Password: {'***' if db_password else 'NOT SET'}")

        if not db_name or not db_user:
            logger.warning(f"Database credentials not available - DB: {db_name}, User: {db_user} (neither provided in config nor found in env.php)")
            return None

        # Password can be empty string (though not recommended)
        if db_password is None:
            logger.warning("Database password not found in config or env.php")
            return None

        # Try TCP connection first
        try:
            logger.debug(f"Attempting TCP connection to {db_host}:{db_port}")
            conn = mysql.connector.connect(
                host=db_host,
                port=db_port,
                database=db_name,
                user=db_user,
                password=db_password,
                connect_timeout=30
            )
            logger.info(f"Successfully connected to database via TCP: {db_name}@{db_host}:{db_port}")
            return conn
        except mysql.connector.Error as e:
            logger.warning(f"TCP connection failed (Error {e.errno}: {e.msg}), trying Unix socket...")

            # If TCP fails and host is localhost/127.0.0.1/::1, try Unix socket
            if db_host in ['localhost', '127.0.0.1', '::1']:
                common_sockets = [
                    '/var/run/mysqld/mysqld.sock',
                    '/tmp/mysql.sock',
                    '/var/lib/mysql/mysql.sock'
                ]

                for socket_path in common_sockets:
                    if not os.path.exists(socket_path):
                        continue

                    try:
                        logger.debug(f"Attempting Unix socket connection: {socket_path}")
                        conn = mysql.connector.connect(
                            unix_socket=socket_path,
                            database=db_name,
                            user=db_user,
                            password=db_password,
                            connect_timeout=30
                        )
                        logger.info(f"Successfully connected to database via Unix socket: {socket_path}")
                        return conn
                    except mysql.connector.Error as sock_err:
                        logger.debug(f"Socket {socket_path} failed: {sock_err.msg}")
                        continue

            logger.error(f"All connection attempts failed - Last error code: {e.errno}, Message: {e.msg}")
            return None
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return None

    def _check_orders(self) -> Dict[str, Any]:
        """Check recent orders from database."""
        conn = self._get_db_connection()
        if not conn:
            return {"error": "Database connection not available"}

        try:
            cursor = conn.cursor(dictionary=True)
            days_to_check = self.config.get('orders_days_to_check', 7)

            # Get table prefix from env.php
            magento_root = self.config.get('magento_root', '')
            env_php_path = os.path.join(magento_root, 'app', 'etc', 'env.php')

            # Try to get table prefix from env.php
            table_prefix = ''
            try:
                with open(env_php_path, 'r') as f:
                    content = f.read()
                    prefix_match = re.search(r"'table_prefix'\s*=>\s*'([^']*)'", content)
                    if prefix_match:
                        table_prefix = prefix_match.group(1)
                        logger.debug(f"Found table prefix: '{table_prefix}'")
            except Exception as e:
                logger.debug(f"Could not read table prefix from env.php: {e}")

            # First, check if there are ANY orders in the table
            check_query = f"SELECT COUNT(*) as total FROM {table_prefix}sales_order"
            logger.info(f"Checking total orders with query: {check_query}")
            cursor.execute(check_query)
            total_check = cursor.fetchone()
            total_in_db = total_check.get('total', 0) if total_check else 0
            logger.info(f"Total orders in database: {total_in_db}")

            # If no orders at all, return early
            if total_in_db == 0:
                cursor.close()
                conn.close()
                return {
                    "orders_by_day": [],
                    "total_orders_period": 0,
                    "total_revenue_period": 0,
                    "average_orders_per_day": 0,
                    "days_checked": days_to_check,
                    "total_orders_in_database": 0,
                    "info": "No orders found in sales_order table"
                }

            # Check the date range of existing orders
            date_range_query = f"""
                SELECT
                    MIN(created_at) as oldest_order,
                    MAX(created_at) as newest_order,
                    CURDATE() as today,
                    DATE_SUB(CURDATE(), INTERVAL %s DAY) as cutoff_date
                FROM {table_prefix}sales_order
            """
            cursor.execute(date_range_query, (days_to_check,))
            date_range = cursor.fetchone()
            logger.info(f"Order date range: oldest={date_range.get('oldest_order')}, newest={date_range.get('newest_order')}, today={date_range.get('today')}, cutoff={date_range.get('cutoff_date')}")

            # Query orders grouped by day
            query = f"""
                SELECT
                    DATE(created_at) as order_date,
                    COUNT(*) as order_count,
                    SUM(grand_total) as total_revenue
                FROM {table_prefix}sales_order
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
                GROUP BY DATE(created_at)
                ORDER BY order_date DESC
            """

            logger.info(f"Executing orders query for last {days_to_check} days")
            logger.debug(f"Full query: {query % days_to_check}")
            cursor.execute(query, (days_to_check,))
            rows = cursor.fetchall()
            logger.info(f"Query returned {len(rows)} rows")

            if len(rows) == 0:
                logger.warning(f"No orders in last {days_to_check} days. Check date_range above to see if orders are older.")

            orders_by_day = []
            total_orders = 0
            total_revenue = 0

            for row in rows:
                # Handle both uppercase and lowercase column names
                order_date_val = row.get('order_date') or row.get('ORDER_DATE')
                order_count_val = row.get('order_count') or row.get('ORDER_COUNT', 0)
                total_revenue_val = row.get('total_revenue') or row.get('TOTAL_REVENUE')

                order_date = order_date_val.strftime('%Y-%m-%d') if order_date_val else None
                count = int(order_count_val)
                revenue = float(total_revenue_val) if total_revenue_val else 0

                logger.debug(f"Order row: date={order_date}, count={count}, revenue={revenue}")

                orders_by_day.append({
                    "date": order_date,
                    "count": count,
                    "revenue": round(revenue, 2)
                })
                total_orders += count
                total_revenue += revenue

            avg_orders_per_day = total_orders / days_to_check if days_to_check > 0 else 0

            result = {
                "orders_by_day": orders_by_day,
                "total_orders_period": total_orders,
                "total_revenue_period": round(total_revenue, 2),
                "average_orders_per_day": round(avg_orders_per_day, 1),
                "days_checked": days_to_check,
                "total_orders_in_database": total_in_db
            }

            # Add info message if no orders in period but orders exist in DB
            if total_orders == 0 and total_in_db > 0:
                result['info'] = f"No orders in the last {days_to_check} days, but {total_in_db} orders exist in database (older orders)"

            # Check warning threshold
            warning_threshold = self.config.get('orders_warning_threshold')
            if warning_threshold and avg_orders_per_day < warning_threshold:
                result['warning'] = f"Average daily orders ({avg_orders_per_day:.1f}) below threshold ({warning_threshold})"

            cursor.close()
            conn.close()

            return result

        except Exception as e:
            logger.error(f"Orders check failed: {e}")
            if conn:
                conn.close()
            return {"error": str(e)}

    def _check_customers(self) -> Dict[str, Any]:
        """Check customer counts from database."""
        conn = self._get_db_connection()
        if not conn:
            return {"error": "Database connection not available"}

        try:
            cursor = conn.cursor(dictionary=True)

            # Get table prefix from env.php
            magento_root = self.config.get('magento_root', '')
            env_php_path = os.path.join(magento_root, 'app', 'etc', 'env.php')

            # Try to get table prefix from env.php
            table_prefix = ''
            try:
                with open(env_php_path, 'r') as f:
                    content = f.read()
                    prefix_match = re.search(r"'table_prefix'\s*=>\s*'([^']*)'", content)
                    if prefix_match:
                        table_prefix = prefix_match.group(1)
            except Exception as e:
                logger.debug(f"Could not read table prefix from env.php: {e}")

            # Get total customer count
            total_query = f"SELECT COUNT(*) as total FROM {table_prefix}customer_entity"
            cursor.execute(total_query)
            total_result = cursor.fetchone()
            total_customers = total_result.get('total', 0) if total_result else 0

            # Get customers registered in last 7 days
            recent_7d_query = f"""
                SELECT COUNT(*) as count
                FROM {table_prefix}customer_entity
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            """
            cursor.execute(recent_7d_query)
            recent_7d_result = cursor.fetchone()
            customers_7d = recent_7d_result.get('count', 0) if recent_7d_result else 0

            # Get customers registered in last 30 days
            recent_30d_query = f"""
                SELECT COUNT(*) as count
                FROM {table_prefix}customer_entity
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            """
            cursor.execute(recent_30d_query)
            recent_30d_result = cursor.fetchone()
            customers_30d = recent_30d_result.get('count', 0) if recent_30d_result else 0

            # Get customer count by group (if customer_group table exists)
            customers_by_group = []
            try:
                group_query = f"""
                    SELECT
                        cg.customer_group_code as group_name,
                        COUNT(ce.entity_id) as count
                    FROM {table_prefix}customer_entity ce
                    JOIN {table_prefix}customer_group cg ON ce.group_id = cg.customer_group_id
                    GROUP BY ce.group_id, cg.customer_group_code
                    ORDER BY count DESC
                """
                cursor.execute(group_query)
                for row in cursor.fetchall():
                    customers_by_group.append({
                        "group": row.get('group_name', 'Unknown'),
                        "count": int(row.get('count', 0))
                    })
            except Exception as e:
                logger.debug(f"Could not get customers by group: {e}")

            cursor.close()
            conn.close()

            return {
                "total": int(total_customers),
                "last_7_days": int(customers_7d),
                "last_30_days": int(customers_30d),
                "by_group": customers_by_group
            }

        except Exception as e:
            logger.error(f"Customers check failed: {e}")
            if conn:
                conn.close()
            return {"error": str(e)}

    def _check_version(self, magento_root: str) -> Dict[str, Any]:
        """Check Magento version from composer.json and compare with latest from Packagist."""
        composer_json_path = os.path.join(magento_root, 'composer.json')
        composer_lock_path = os.path.join(magento_root, 'composer.lock')

        current_version = None
        edition = "community"

        # Try composer.lock first (more accurate)
        if os.path.isfile(composer_lock_path):
            try:
                with open(composer_lock_path, 'r') as f:
                    lock_data = json.load(f)
                    for package in lock_data.get('packages', []):
                        if package.get('name') == 'magento/product-community-edition':
                            current_version = package.get('version', '').lstrip('v')
                            edition = "community"
                            break
                        if package.get('name') == 'magento/product-enterprise-edition':
                            current_version = package.get('version', '').lstrip('v')
                            edition = "enterprise"
                            break
            except Exception as e:
                logger.warning(f"Error reading composer.lock: {e}")

        # Fall back to composer.json
        if not current_version and os.path.isfile(composer_json_path):
            try:
                with open(composer_json_path, 'r') as f:
                    composer_data = json.load(f)
                    require = composer_data.get('require', {})
                    if 'magento/product-enterprise-edition' in require:
                        version_str = require.get('magento/product-enterprise-edition', '')
                        edition = "enterprise"
                    else:
                        version_str = require.get('magento/product-community-edition', '')
                        edition = "community"
                    # Parse version constraint (e.g., "2.4.6" or "^2.4.6")
                    current_version = version_str.lstrip('^~>=<').split(',')[0].strip()
            except Exception as e:
                logger.warning(f"Error reading composer.json: {e}")

        if not current_version:
            return {
                "current_version": "unknown",
                "latest_version": LATEST_MAGENTO_VERSION,
                "is_outdated": True,
                "edition": edition,
                "error": "Could not determine Magento version"
            }

        # Fetch latest version from Packagist API
        latest_version = self._fetch_latest_magento_version()
        if not latest_version:
            # Fall back to hardcoded version if API fails
            latest_version = LATEST_MAGENTO_VERSION
            logger.info(f"Using hardcoded latest version: {latest_version}")

        # Compare versions
        is_outdated = current_version != latest_version
        update_available = None

        # Determine if update is available and what version
        if is_outdated:
            try:
                current_parts = [int(x) for x in current_version.split('.')]
                latest_parts = [int(x) for x in latest_version.split('.')]

                # Only compare within same major.minor (patch updates)
                if current_parts[0] == latest_parts[0] and current_parts[1] == latest_parts[1]:
                    if current_parts[2] < latest_parts[2]:
                        update_available = latest_version
                elif current_parts[0] == latest_parts[0] and current_parts[1] < latest_parts[1]:
                    # Minor version update available
                    update_available = latest_version
                elif current_parts[0] < latest_parts[0]:
                    # Major version update available
                    update_available = latest_version
            except (ValueError, IndexError) as e:
                logger.warning(f"Error comparing versions: {e}")
                update_available = latest_version

        # Calculate versions behind (using hardcoded list for reference)
        versions_behind = 0
        version_list = list(MAGENTO_VERSIONS.keys())
        if current_version in version_list:
            current_idx = version_list.index(current_version)
            versions_behind = current_idx
        elif is_outdated:
            versions_behind = 1  # At least one version behind

        return {
            "current_version": current_version,
            "latest_version": latest_version,
            "is_outdated": is_outdated,
            "update_available": update_available,
            "versions_behind": versions_behind,
            "edition": edition
        }

    def _check_security(self, magento_root: str) -> Dict[str, Any]:
        """Check security status from database and filesystem."""
        result = {
            "vulnerabilities": {},
            "risk_level": "low"
        }

        conn = self._get_db_connection()
        if conn:
            try:
                cursor = conn.cursor(dictionary=True)

                # Check brute force protection (admin lockout settings)
                cursor.execute("""
                    SELECT path, value FROM core_config_data
                    WHERE path IN (
                        'admin/captcha/enable',
                        'admin/security/lockout_failures',
                        'admin/security/lockout_threshold',
                        'admin/security/password_lifetime'
                    )
                """)

                security_settings = {row['path']: row['value'] for row in cursor.fetchall()}

                brute_force_protection = (
                    security_settings.get('admin/captcha/enable') == '1' or
                    int(security_settings.get('admin/security/lockout_failures', '0') or '0') > 0
                )

                result['vulnerabilities']['brute_force_protection'] = brute_force_protection

                cursor.close()
                conn.close()

            except Exception as e:
                logger.error(f"Security check failed: {e}")
                result['error'] = str(e)
                if conn:
                    conn.close()

        # Check if admin URL is customized (read from env.php)
        admin_custom_url = False
        admin_frontend_name = 'admin'
        try:
            env_php_path = os.path.join(magento_root, 'app', 'etc', 'env.php')
            if os.path.exists(env_php_path):
                with open(env_php_path, 'r') as f:
                    content = f.read()
                    # Look for 'backend' => ['frontName' => 'admin_14ecus']
                    frontend_match = re.search(r"'frontName'\s*=>\s*'([^']+)'", content)
                    if frontend_match:
                        admin_frontend_name = frontend_match.group(1)
                        admin_custom_url = admin_frontend_name != 'admin'
                        logger.debug(f"Found admin frontName: '{admin_frontend_name}', customized: {admin_custom_url}")
                    else:
                        logger.debug("No frontName found in env.php, using default 'admin'")
        except Exception as e:
            logger.debug(f"Could not read frontName from env.php: {e}")

        result['vulnerabilities']['admin_url_customized'] = admin_custom_url
        result['vulnerabilities']['admin_frontend_name'] = admin_frontend_name

        # Check for common security issues in filesystem
        var_cache_exposed = os.path.exists(os.path.join(magento_root, 'pub', 'var'))
        result['vulnerabilities']['cache_leak'] = var_cache_exposed

        # Determine risk level
        vulns = result['vulnerabilities']
        if vulns.get('cache_leak'):
            result['risk_level'] = 'critical'
        elif not vulns.get('brute_force_protection', True) or not vulns.get('admin_url_customized', True):
            result['risk_level'] = 'high'
        elif not vulns.get('admin_url_customized', True):
            result['risk_level'] = 'medium'

        return result

    def _check_database_size(self) -> Dict[str, Any]:
        """Check database sizes from information_schema - all databases and Magento tables."""
        conn = self._get_db_connection()
        if not conn:
            return {"error": "Database connection not available"}

        try:
            cursor = conn.cursor(dictionary=True)
            credentials = self._get_db_credentials()
            db_name = credentials.get('dbname')

            # Get ALL database sizes
            logger.debug("Querying all database sizes")
            cursor.execute("""
                SELECT
                    table_schema as database_name,
                    SUM(data_length + index_length) as total_size
                FROM information_schema.TABLES
                WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
                GROUP BY table_schema
                ORDER BY total_size DESC
            """)

            all_databases = []
            magento_db_size = 0
            for row in cursor.fetchall():
                database_name = row.get('database_name') or row.get('DATABASE_NAME', 'unknown')
                db_size_val = row.get('total_size') or row.get('TOTAL_SIZE', 0)
                try:
                    db_size = int(float(db_size_val)) if db_size_val else 0
                except (ValueError, TypeError):
                    db_size = 0

                all_databases.append({
                    "database": database_name,
                    "size": format_bytes(db_size),
                    "size_bytes": db_size,
                    "is_magento": database_name == db_name
                })

                # Track Magento database size
                if database_name == db_name:
                    magento_db_size = db_size

            logger.debug(f"Found {len(all_databases)} databases")

            # Get largest tables in Magento database
            cursor.execute("""
                SELECT
                    TABLE_NAME,
                    data_length + index_length as size
                FROM information_schema.TABLES
                WHERE table_schema = %s
                ORDER BY size DESC
                LIMIT 10
            """, (db_name,))

            largest_tables = []
            for row in cursor.fetchall():
                table_name = row.get('TABLE_NAME') or row.get('table_name', 'unknown')
                table_size = row.get('size', 0)
                largest_tables.append({
                    "table": table_name,
                    "size": format_bytes(int(table_size)),
                    "size_bytes": int(table_size)
                })

            cursor.close()
            conn.close()

            return {
                "magento_database": db_name,
                "magento_database_size_bytes": magento_db_size,
                "magento_database_size_human": format_bytes(magento_db_size),
                "all_databases": all_databases,
                "largest_tables": largest_tables
            }

        except Exception as e:
            logger.error(f"Database size check failed: {e}")
            if conn:
                conn.close()
            return {"error": str(e)}

    def _check_large_folders(self, magento_root: str) -> Dict[str, Any]:
        """Check for large folders and largest individual files in Magento installation."""
        # Common large directories in Magento
        folders_to_check = [
            'pub/media',
            'pub/media/catalog/product',
            'pub/static',
            'var',
            'var/log',
            'var/cache',
            'var/page_cache',
            'generated',
            'generated/code',
            'vendor',
        ]

        folder_sizes = []
        total_size = 0

        for folder in folders_to_check:
            folder_path = os.path.join(magento_root, folder)
            if os.path.isdir(folder_path):
                size, file_count = get_directory_size(folder_path)
                folder_sizes.append({
                    "path": folder,
                    "size": format_bytes(size),
                    "size_bytes": size,
                    "files": file_count
                })
                # Only add to total for top-level directories
                if folder.count('/') == 0 or folder in ['pub/media', 'pub/static']:
                    total_size += size

        # Sort by size and take top 5
        folder_sizes.sort(key=lambda x: x['size_bytes'], reverse=True)

        # Find top 10 largest individual files
        largest_files = self._find_largest_files(magento_root, limit=10)

        return {
            "large_folders": folder_sizes[:5],
            "all_folders": folder_sizes,
            "largest_files": largest_files,
            "total_magento_size": format_bytes(total_size),
            "total_magento_size_bytes": total_size
        }

    def _find_largest_files(self, magento_root: str, limit: int = 10) -> list:
        """Find the largest individual files in Magento installation."""
        try:
            import heapq

            # Directories to scan for large files
            scan_dirs = [
                'pub/media',
                'var/log',
                'var/report',
                'var/export',
                'var/import',
                'var/backups',
            ]

            file_heap = []  # Use heap to efficiently track top N files

            for scan_dir in scan_dirs:
                dir_path = os.path.join(magento_root, scan_dir)
                if not os.path.isdir(dir_path):
                    continue

                logger.debug(f"Scanning {scan_dir} for large files...")

                # Walk through directory
                for root, dirs, files in os.walk(dir_path):
                    # Skip hidden directories and cache
                    dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['cache', 'tmp']]

                    for filename in files:
                        try:
                            file_path = os.path.join(root, filename)
                            # Skip symlinks
                            if os.path.islink(file_path):
                                continue

                            file_size = os.path.getsize(file_path)

                            # Only track files >= 1MB
                            if file_size >= 1024 * 1024:
                                # Store negative size for min heap (to get largest)
                                # Keep relative path from magento root
                                relative_path = os.path.relpath(file_path, magento_root)

                                if len(file_heap) < limit:
                                    heapq.heappush(file_heap, (file_size, relative_path))
                                elif file_size > file_heap[0][0]:
                                    heapq.heapreplace(file_heap, (file_size, relative_path))

                        except (OSError, PermissionError) as e:
                            # Skip files we can't access
                            logger.debug(f"Skipping file {filename}: {e}")
                            continue

            # Convert heap to sorted list (largest first)
            largest_files = [
                {
                    "path": path,
                    "size": format_bytes(size),
                    "size_bytes": size
                }
                for size, path in sorted(file_heap, reverse=True)
            ]

            logger.debug(f"Found {len(largest_files)} large files")
            return largest_files

        except Exception as e:
            logger.error(f"Failed to find largest files: {e}")
            return []

    def _check_var_directory(self, magento_root: str) -> Dict[str, Any]:
        """Check var/ directory breakdown."""
        var_path = os.path.join(magento_root, 'var')

        if not os.path.isdir(var_path):
            return {"error": "var/ directory not found"}

        # Subdirectories to check
        subdirs = ['cache', 'page_cache', 'session', 'log', 'report', 'tmp', 'export', 'import', 'view_preprocessed']

        breakdown = {}
        total_size = 0

        for subdir in subdirs:
            subdir_path = os.path.join(var_path, subdir)
            if os.path.isdir(subdir_path):
                size, file_count = get_directory_size(subdir_path)
                breakdown[subdir] = {
                    "size": format_bytes(size),
                    "size_bytes": size,
                    "files": file_count
                }
                total_size += size

        return {
            "var_breakdown": breakdown,
            "total_var_size": format_bytes(total_size),
            "total_var_size_bytes": total_size
        }

    def _check_cache_status(self) -> Dict[str, Any]:
        """Check Magento cache status from app/etc/env.php file.

        In Magento 2, cache configuration is stored in env.php under 'cache_types' key,
        not in the database like Magento 1.
        """
        magento_root = self.config.get('magento_root', '')
        env_php_path = os.path.join(magento_root, 'app', 'etc', 'env.php')

        if not os.path.isfile(env_php_path):
            return {"error": f"env.php not found at: {env_php_path}"}

        try:
            with open(env_php_path, 'r', encoding='utf-8') as f:
                content = f.read()

            logger.info(f"Reading cache status from: {env_php_path}")

            # Cache type labels (human-readable names)
            cache_labels = {
                'config': 'Configuration',
                'layout': 'Layouts',
                'block_html': 'Blocks HTML output',
                'collections': 'Collections Data',
                'reflection': 'Reflection Data',
                'db_ddl': 'Database DDL operations',
                'compiled_config': 'Compiled Config',
                'eav': 'EAV types and attributes',
                'customer_notification': 'Customer Notification',
                'config_integration': 'Integrations Configuration',
                'config_integration_api': 'Integrations API Configuration',
                'full_page': 'Page Cache (FPC)',
                'config_webservice': 'Web Services Configuration',
                'translate': 'Translations',
                'vertex': 'Vertex',
                'target_rule': 'Target Rule',
                'amasty_shopby': 'Amasty Shopby',
                'google_product': 'Google Product Feed',
            }

            cache_types = []
            enabled_count = 0
            disabled_count = 0

            # Parse cache_types from env.php
            # Format: 'cache_types' => ['config' => 1, 'layout' => 1, ...]
            # Find the cache_types array section
            cache_types_match = re.search(
                r"'cache_types'\s*=>\s*\[\s*(.*?)\s*\]",
                content,
                re.DOTALL
            )

            if cache_types_match:
                cache_section = cache_types_match.group(1)
                logger.debug(f"Found cache_types section: {cache_section[:200]}...")

                # Extract individual cache type entries: 'cache_id' => 0|1
                cache_entries = re.findall(
                    r"'([^']+)'\s*=>\s*(\d+)",
                    cache_section
                )

                logger.info(f"Found {len(cache_entries)} cache types in env.php")

                for cache_id, status_val in cache_entries:
                    is_enabled = int(status_val) == 1

                    if is_enabled:
                        enabled_count += 1
                    else:
                        disabled_count += 1

                    cache_types.append({
                        "id": cache_id,
                        "label": cache_labels.get(cache_id, cache_id.replace('_', ' ').title()),
                        "status": "ENABLED" if is_enabled else "DISABLED"
                    })
            else:
                logger.warning("Could not find 'cache_types' section in env.php")
                return {"error": "cache_types section not found in env.php"}

            return {
                "cache_types": cache_types,
                "total": len(cache_types),
                "enabled_count": enabled_count,
                "disabled_count": disabled_count,
                "all_enabled": disabled_count == 0
            }

        except Exception as e:
            import traceback
            logger.error(f"Cache status check failed: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {"error": str(e)}

    def _check_indexer_status(self) -> Dict[str, Any]:
        """Check Magento indexer status from indexer_state table."""
        conn = self._get_db_connection()
        if not conn:
            return {"error": "Database connection not available"}

        try:
            cursor = conn.cursor(dictionary=True)

            # Get table prefix
            magento_root = self.config.get('magento_root', '')
            env_php_path = os.path.join(magento_root, 'app', 'etc', 'env.php')
            table_prefix = ''
            try:
                with open(env_php_path, 'r') as f:
                    content = f.read()
                    prefix_match = re.search(r"'table_prefix'\s*=>\s*'([^']*)'", content)
                    if prefix_match:
                        table_prefix = prefix_match.group(1)
            except Exception:
                pass

            # Query indexer state
            # status: valid, working, invalid
            # mode: scheduled, real_time (Update on Save)
            query = f"""
                SELECT indexer_id, status, updated
                FROM {table_prefix}indexer_state
                ORDER BY indexer_id ASC
            """

            logger.debug(f"Querying indexer status: {query}")
            cursor.execute(query)
            rows = cursor.fetchall()

            # Also get indexer mode from mview_state (if available)
            mode_query = f"""
                SELECT view_id, mode
                FROM {table_prefix}mview_state
            """
            indexer_modes = {}
            try:
                cursor.execute(mode_query)
                mode_rows = cursor.fetchall()
                for row in mode_rows:
                    view_id = row.get('view_id') or row.get('VIEW_ID', '')
                    mode = row.get('mode') or row.get('MODE', 'enabled')
                    indexer_modes[view_id] = mode
            except Exception as e:
                logger.debug(f"Could not query mview_state: {e}")

            indexers = []
            valid_count = 0
            invalid_count = 0
            working_count = 0

            # Indexer labels (human-readable names)
            indexer_labels = {
                'design_config_grid': 'Design Config Grid',
                'customer_grid': 'Customer Grid',
                'catalog_category_product': 'Category Products',
                'catalog_product_category': 'Product Categories',
                'catalogrule_rule': 'Catalog Rule Product',
                'catalog_product_attribute': 'Product EAV',
                'cataloginventory_stock': 'Stock',
                'inventory': 'Inventory',
                'catalogrule_product': 'Catalog Product Rule',
                'catalog_product_price': 'Product Price',
                'catalogsearch_fulltext': 'Catalog Search',
                'targetrule_product_rule': 'Target Rule Product',
                'targetrule_rule_product': 'Target Rule Rule',
                'salesrule_rule': 'Sales Rule',
            }

            # Status mapping for display
            status_display = {
                'valid': 'READY',
                'invalid': 'REINDEX REQUIRED',
                'working': 'PROCESSING'
            }

            for row in rows:
                indexer_id = row.get('indexer_id') or row.get('INDEXER_ID', '')
                status = row.get('status') or row.get('STATUS', 'valid')
                updated = row.get('updated') or row.get('UPDATED')

                # Get mode (default to "Update on Save" if not in mview_state)
                mode = indexer_modes.get(indexer_id, 'real_time')
                mode_display = 'Update by Schedule' if mode == 'enabled' else 'Update on Save'

                if status == 'valid':
                    valid_count += 1
                elif status == 'invalid':
                    invalid_count += 1
                elif status == 'working':
                    working_count += 1

                # Format updated timestamp
                updated_str = None
                if updated:
                    if hasattr(updated, 'strftime'):
                        updated_str = updated.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        updated_str = str(updated)

                indexers.append({
                    "id": indexer_id,
                    "label": indexer_labels.get(indexer_id, indexer_id.replace('_', ' ').title()),
                    "status": status_display.get(status, status.upper()),
                    "status_code": status,
                    "mode": mode_display,
                    "updated": updated_str
                })

            cursor.close()
            conn.close()

            return {
                "indexers": indexers,
                "total": len(indexers),
                "valid_count": valid_count,
                "invalid_count": invalid_count,
                "working_count": working_count,
                "all_valid": invalid_count == 0 and working_count == 0,
                "reindex_required": invalid_count > 0
            }

        except Exception as e:
            logger.error(f"Indexer status check failed: {e}")
            if conn:
                conn.close()
            return {"error": str(e)}

    def _check_developer_mode(self, magento_root: str) -> Dict[str, Any]:
        """
        Check if Magento is running in developer mode.

        Reads MAGE_MODE from app/etc/env.php.
        Modes: developer, production, default

        Production mode is recommended for live sites.
        Developer mode should NOT be used in production.
        """
        result = {
            "mode": "unknown",
            "is_production": False,
            "is_developer": False,
            "warning": None
        }

        try:
            env_php_path = os.path.join(magento_root, 'app', 'etc', 'env.php')
            if not os.path.exists(env_php_path):
                result['error'] = "env.php not found"
                return result

            with open(env_php_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Look for MAGE_MODE - can be in different formats:
            # 'MAGE_MODE' => 'developer'
            # 'MAGE_MODE' => 'production'
            # 'MAGE_MODE' => 'default'
            mode_match = re.search(r"'MAGE_MODE'\s*=>\s*'([^']+)'", content)
            if not mode_match:
                mode_match = re.search(r'"MAGE_MODE"\s*=>\s*"([^"]+)"', content)

            if mode_match:
                mode = mode_match.group(1).lower()
                result['mode'] = mode
                result['is_production'] = mode == 'production'
                result['is_developer'] = mode == 'developer'

                if mode == 'developer':
                    result['warning'] = "Developer mode is enabled - NOT recommended for production"
                elif mode == 'default':
                    result['warning'] = "Default mode is enabled - Production mode recommended"

                logger.debug(f"Magento mode: {mode}")
            else:
                # MAGE_MODE not set - defaults to 'default' mode
                result['mode'] = 'default (not set)'
                result['warning'] = "MAGE_MODE not configured - defaults to 'default' mode"
                logger.debug("MAGE_MODE not found in env.php")

        except Exception as e:
            logger.error(f"Developer mode check failed: {e}")
            result['error'] = str(e)

        return result

    def _fetch_latest_magento_version(self) -> Optional[str]:
        """
        Fetch the latest Magento 2 version from Packagist API.

        Returns the latest stable version string or None on failure.
        """
        try:
            # Packagist API for magento/product-community-edition
            url = "https://repo.packagist.org/p2/magento/product-community-edition.json"

            logger.debug(f"Fetching latest Magento version from Packagist: {url}")
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            data = response.json()
            packages = data.get('packages', {}).get('magento/product-community-edition', [])

            if not packages:
                logger.warning("No packages found in Packagist response")
                return None

            # Find the latest stable version (not dev, alpha, beta, RC)
            stable_versions = []
            for pkg in packages:
                version = pkg.get('version', '')
                # Skip dev, alpha, beta, RC versions
                if any(x in version.lower() for x in ['dev', 'alpha', 'beta', 'rc', '-p']):
                    continue
                # Clean version string
                clean_version = version.lstrip('v')
                # Must match pattern like 2.4.7
                if re.match(r'^\d+\.\d+\.\d+$', clean_version):
                    stable_versions.append(clean_version)

            if stable_versions:
                # Sort versions and get the latest
                stable_versions.sort(key=lambda v: [int(x) for x in v.split('.')], reverse=True)
                latest = stable_versions[0]
                logger.info(f"Latest stable Magento version from Packagist: {latest}")
                return latest

            logger.warning("No stable versions found in Packagist response")
            return None

        except requests.RequestException as e:
            logger.warning(f"Failed to fetch from Packagist: {e}")
            return None
        except Exception as e:
            logger.error(f"Error parsing Packagist response: {e}")
            return None

    def _check_log_files(self, magento_root: str) -> Dict[str, Any]:
        """
        Check Magento log file sizes for rotation warnings.

        Thresholds:
        - < 20MB: Normal (green)
        - 20-50MB: Warning (yellow)
        - > 50MB: Critical (red)

        Checks:
        - var/log/system.log
        - var/log/exception.log
        - var/log/debug.log
        - var/log/cron.log
        - var/log/support_report.log
        """
        WARNING_THRESHOLD_MB = 20
        CRITICAL_THRESHOLD_MB = 50

        log_files_to_check = [
            'var/log/system.log',
            'var/log/exception.log',
            'var/log/debug.log',
            'var/log/cron.log',
            'var/log/support_report.log',
        ]

        result = {
            "log_files": [],
            "total_size_bytes": 0,
            "total_size_human": "0 B",
            "warning_count": 0,
            "critical_count": 0,
            "needs_rotation": False
        }

        try:
            for log_path in log_files_to_check:
                full_path = os.path.join(magento_root, log_path)
                filename = os.path.basename(log_path)

                if os.path.exists(full_path):
                    try:
                        size_bytes = os.path.getsize(full_path)
                        size_mb = size_bytes / (1024 * 1024)

                        # Determine status
                        if size_mb >= CRITICAL_THRESHOLD_MB:
                            status = 'critical'
                            result['critical_count'] += 1
                            result['needs_rotation'] = True
                        elif size_mb >= WARNING_THRESHOLD_MB:
                            status = 'warning'
                            result['warning_count'] += 1
                            result['needs_rotation'] = True
                        else:
                            status = 'ok'

                        result['log_files'].append({
                            "name": filename,
                            "path": log_path,
                            "size_bytes": size_bytes,
                            "size_human": format_bytes(size_bytes),
                            "size_mb": round(size_mb, 2),
                            "status": status
                        })

                        result['total_size_bytes'] += size_bytes

                    except (OSError, PermissionError) as e:
                        logger.warning(f"Cannot read log file {full_path}: {e}")
                        result['log_files'].append({
                            "name": filename,
                            "path": log_path,
                            "error": str(e),
                            "status": 'error'
                        })
                else:
                    # File doesn't exist - that's ok, just skip
                    pass

            result['total_size_human'] = format_bytes(result['total_size_bytes'])

            # Also check for any other large log files in var/log
            var_log_path = os.path.join(magento_root, 'var', 'log')
            if os.path.isdir(var_log_path):
                try:
                    for filename in os.listdir(var_log_path):
                        if not filename.endswith('.log'):
                            continue
                        # Skip files we already checked
                        if filename in ['system.log', 'exception.log', 'debug.log', 'cron.log', 'support_report.log']:
                            continue

                        full_path = os.path.join(var_log_path, filename)
                        if os.path.isfile(full_path):
                            try:
                                size_bytes = os.path.getsize(full_path)
                                size_mb = size_bytes / (1024 * 1024)

                                # Only add if it's at least warning level
                                if size_mb >= WARNING_THRESHOLD_MB:
                                    if size_mb >= CRITICAL_THRESHOLD_MB:
                                        status = 'critical'
                                        result['critical_count'] += 1
                                    else:
                                        status = 'warning'
                                        result['warning_count'] += 1

                                    result['needs_rotation'] = True
                                    result['log_files'].append({
                                        "name": filename,
                                        "path": f"var/log/{filename}",
                                        "size_bytes": size_bytes,
                                        "size_human": format_bytes(size_bytes),
                                        "size_mb": round(size_mb, 2),
                                        "status": status
                                    })
                                    result['total_size_bytes'] += size_bytes

                            except (OSError, PermissionError):
                                pass
                except (OSError, PermissionError) as e:
                    logger.warning(f"Cannot list var/log directory: {e}")

            # Update total size human readable
            result['total_size_human'] = format_bytes(result['total_size_bytes'])

            # Sort by size descending
            result['log_files'].sort(key=lambda x: x.get('size_bytes', 0), reverse=True)

        except Exception as e:
            logger.error(f"Log files check failed: {e}")
            result['error'] = str(e)

        return result

    def _check_composer_audit(self, magento_root: str) -> Dict[str, Any]:
        """
        Run composer audit to check for known security vulnerabilities.

        Uses `composer audit --format=json` to get structured vulnerability data.
        Tries system composer first, then looks for local composer.phar.

        Timeout: 30 seconds max.

        Returns:
            Dict with vulnerability count, severity breakdown, and package details.
        """
        TIMEOUT_SECONDS = 30

        result = {
            "status": "unknown",
            "total_vulnerabilities": 0,
            "critical_count": 0,
            "high_count": 0,
            "medium_count": 0,
            "low_count": 0,
            "vulnerabilities": [],  # List of {package, severity, cve, title}
            "skipped": False,
            "error": None
        }

        try:
            # Find composer executable
            composer_cmd = None

            # Option 1: Check if composer is in PATH
            composer_path = shutil.which('composer')
            if composer_path:
                composer_cmd = [composer_path]
                logger.debug(f"Found composer in PATH: {composer_path}")
            else:
                # Option 2: Check for local composer.phar in Magento root
                local_composer = os.path.join(magento_root, 'composer.phar')
                if os.path.isfile(local_composer):
                    composer_cmd = ['php', local_composer]
                    logger.debug(f"Found local composer.phar: {local_composer}")
                else:
                    # Option 3: Check common locations
                    common_paths = [
                        '/usr/local/bin/composer',
                        '/usr/bin/composer',
                        os.path.expanduser('~/.composer/composer.phar'),
                        os.path.expanduser('~/composer.phar'),
                    ]
                    for path in common_paths:
                        if os.path.isfile(path):
                            if path.endswith('.phar'):
                                composer_cmd = ['php', path]
                            else:
                                composer_cmd = [path]
                            logger.debug(f"Found composer at: {path}")
                            break

            if not composer_cmd:
                result['status'] = 'skipped'
                result['skipped'] = True
                result['error'] = "Composer not found"
                logger.warning("Composer not found - skipping security audit")
                return result

            # Run composer audit
            cmd = composer_cmd + ['audit', '--format=json', '--no-interaction']
            logger.info(f"Running composer audit: {' '.join(cmd)}")

            try:
                proc = subprocess.run(
                    cmd,
                    cwd=magento_root,
                    capture_output=True,
                    text=True,
                    timeout=TIMEOUT_SECONDS
                )

                # composer audit returns exit code 1 if vulnerabilities found, 0 if clean
                # Both are valid responses we can parse

                if proc.returncode not in [0, 1]:
                    # Actual error
                    result['status'] = 'error'
                    result['error'] = proc.stderr or f"Composer audit failed with exit code {proc.returncode}"
                    logger.error(f"Composer audit error: {result['error']}")
                    return result

                # Parse JSON output
                try:
                    audit_data = json.loads(proc.stdout) if proc.stdout else {}
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse composer audit JSON: {e}")
                    result['status'] = 'error'
                    result['error'] = "Failed to parse audit results"
                    return result

                # Process advisories
                # Format: {"advisories": {"package/name": [{"advisoryId": "...", "severity": "...", ...}]}}
                advisories = audit_data.get('advisories', {})

                for package_name, package_advisories in advisories.items():
                    for advisory in package_advisories:
                        severity = advisory.get('severity', 'unknown').lower()
                        cve = advisory.get('cve') or advisory.get('advisoryId', 'N/A')
                        title = advisory.get('title', 'Unknown vulnerability')
                        affected_versions = advisory.get('affectedVersions', '')

                        # Count by severity
                        if severity == 'critical':
                            result['critical_count'] += 1
                        elif severity == 'high':
                            result['high_count'] += 1
                        elif severity == 'medium':
                            result['medium_count'] += 1
                        else:
                            result['low_count'] += 1

                        result['vulnerabilities'].append({
                            "package": package_name,
                            "severity": severity,
                            "cve": cve,
                            "title": title,
                            "affected_versions": affected_versions
                        })

                result['total_vulnerabilities'] = len(result['vulnerabilities'])

                # Determine overall status
                if result['total_vulnerabilities'] == 0:
                    result['status'] = 'secure'
                elif result['critical_count'] > 0 or result['high_count'] > 0:
                    result['status'] = 'critical'
                elif result['medium_count'] > 0:
                    result['status'] = 'warning'
                else:
                    result['status'] = 'info'

                logger.info(f"Composer audit complete: {result['total_vulnerabilities']} vulnerabilities found")

            except subprocess.TimeoutExpired:
                result['status'] = 'skipped'
                result['skipped'] = True
                result['error'] = "Check timed out (>30s)"
                logger.warning("Composer audit timed out")

        except Exception as e:
            logger.error(f"Composer audit check failed: {e}")
            result['status'] = 'error'
            result['error'] = str(e)

        return result
