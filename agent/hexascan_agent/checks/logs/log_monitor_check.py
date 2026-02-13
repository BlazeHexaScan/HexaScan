"""
Log monitoring check implementation.

Supports two modes:
1. Pattern matching mode: Scans logs for error patterns (default)
2. Raw display mode: Returns last N lines from log files for display
"""

import logging
import os
import re
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..base import BaseCheck, CheckResult, CheckStatus
from ..registry import CheckRegistry

logger = logging.getLogger(__name__)


@dataclass
class LogPattern:
    """A pattern to match in log files."""

    pattern: str
    level: str  # 'warning', 'critical', 'info'
    description: str = ""
    compiled: Optional[re.Pattern] = field(default=None, repr=False)

    def __post_init__(self):
        """Compile the regex pattern."""
        try:
            self.compiled = re.compile(self.pattern, re.IGNORECASE)
        except re.error as e:
            logger.error(f"Invalid regex pattern '{self.pattern}': {e}")
            self.compiled = None


@dataclass
class LogMatch:
    """A match found in a log file."""

    file_path: str
    line_number: int
    line: str
    pattern: str
    level: str


# Default patterns for common issues
DEFAULT_PATTERNS = [
    # Critical patterns
    LogPattern(
        pattern=r'(fatal|panic|emergency)',
        level='critical',
        description='Fatal/panic errors',
    ),
    LogPattern(
        pattern=r'out of memory',
        level='critical',
        description='Out of memory errors',
    ),
    LogPattern(
        pattern=r'segmentation fault',
        level='critical',
        description='Segmentation faults',
    ),
    LogPattern(
        pattern=r'disk full|no space left',
        level='critical',
        description='Disk space issues',
    ),
    # Warning patterns
    LogPattern(
        pattern=r'(error|exception|failed|failure)',
        level='warning',
        description='General errors',
    ),
    LogPattern(
        pattern=r'permission denied',
        level='warning',
        description='Permission issues',
    ),
    LogPattern(
        pattern=r'connection refused|connection timed out',
        level='warning',
        description='Connection issues',
    ),
    LogPattern(
        pattern=r'(deprecated|obsolete)',
        level='info',
        description='Deprecation warnings',
    ),
]


@CheckRegistry.register('LOG_MONITORING')
class LogMonitorCheck(BaseCheck):
    """
    Check log files for errors and patterns.

    Configuration options:
        mode: 'pattern' (default) or 'display' - pattern matching vs raw display
        paths: List of log file paths or directories to monitor
        patterns: List of pattern configurations (optional, uses defaults if not provided)
        max_lines: Maximum lines to read per file (default: 300 for display, 1000 for pattern)
        max_file_size_mb: Skip files larger than this (default: 100)
        include_extensions: File extensions to include (default: ['.log', '.txt'])

        For display mode:
        magento_root: Path to Magento installation (auto-configures Magento logs)
        wordpress_root: Path to WordPress installation (auto-configures WordPress logs)
        include_system_logs: Whether to include system logs (default: True)
    """

    DEFAULT_MAX_LINES = 1000
    DEFAULT_MAX_LINES_DISPLAY = 300
    DEFAULT_MAX_FILE_SIZE_MB = 100
    DEFAULT_INCLUDE_EXTENSIONS = ['.log', '.txt', '']
    DEFAULT_TIME_WINDOW_HOURS = 24

    # Common Magento log files
    MAGENTO_LOG_FILES = [
        'var/log/exception.log',
        'var/log/system.log',
        'var/log/debug.log',
    ]

    # Common WordPress log files
    WORDPRESS_LOG_FILES = [
        'wp-content/debug.log',
        'wp-content/uploads/wc-logs',  # WooCommerce logs directory
        'error_log',  # Common PHP error log in root
    ]

    # Common system log files
    SYSTEM_LOG_FILES = [
        '/var/log/syslog',
        '/var/log/messages',
        '/var/log/apache2/error.log',
        '/var/log/nginx/error.log',
        '/var/log/php-fpm/error.log',
        '/var/log/php8.1-fpm.log',
        '/var/log/mysql/error.log',
    ]

    @property
    def name(self) -> str:
        return "Log Monitoring"

    @property
    def category(self) -> str:
        return "logs"

    def execute(self) -> CheckResult:
        """
        Execute log monitoring check.

        Returns:
            CheckResult with log analysis information
        """
        start_time = time.time()
        mode = self.config.get('mode', 'display')  # Default to display mode

        if mode == 'display':
            return self._execute_display_mode(start_time)
        else:
            return self._execute_pattern_mode(start_time)

    def _execute_display_mode(self, start_time: float) -> CheckResult:
        """
        Execute in display mode - fetch and return raw log content.
        """
        magento_root = self.config.get('magento_root', '')
        wordpress_root = self.config.get('wordpress_root', '')
        include_system_logs = self.config.get('include_system_logs', True)
        max_lines = self.config.get('max_lines', self.DEFAULT_MAX_LINES_DISPLAY)
        custom_paths = self.config.get('paths', [])

        log_contents = {}
        errors_found = 0
        warnings_found = 0
        files_read = 0

        # Collect Magento logs if magento_root is provided
        if magento_root:
            for log_file in self.MAGENTO_LOG_FILES:
                full_path = os.path.join(magento_root, log_file)
                if os.path.exists(full_path):
                    content, stats = self._read_log_file(full_path, max_lines)
                    if content is not None:
                        log_name = f"magento:{os.path.basename(log_file)}"
                        log_contents[log_name] = {
                            'path': full_path,
                            'lines': content,
                            'total_lines': stats['total_lines'],
                            'file_size': stats['file_size'],
                            'last_modified': stats['last_modified'],
                            'error_count': stats['error_count'],
                            'warning_count': stats['warning_count'],
                        }
                        errors_found += stats['error_count']
                        warnings_found += stats['warning_count']
                        files_read += 1

        # Collect WordPress logs if wordpress_root is provided
        if wordpress_root:
            for log_file in self.WORDPRESS_LOG_FILES:
                full_path = os.path.join(wordpress_root, log_file)
                # Handle both files and directories (like wc-logs)
                if os.path.isfile(full_path):
                    content, stats = self._read_log_file(full_path, max_lines)
                    if content is not None:
                        log_name = f"wordpress:{os.path.basename(log_file)}"
                        log_contents[log_name] = {
                            'path': full_path,
                            'lines': content,
                            'total_lines': stats['total_lines'],
                            'file_size': stats['file_size'],
                            'last_modified': stats['last_modified'],
                            'error_count': stats['error_count'],
                            'warning_count': stats['warning_count'],
                        }
                        errors_found += stats['error_count']
                        warnings_found += stats['warning_count']
                        files_read += 1
                elif os.path.isdir(full_path):
                    # For directories like wc-logs, read the most recent log files
                    try:
                        log_files = sorted(
                            [f for f in os.listdir(full_path) if f.endswith('.log')],
                            key=lambda x: os.path.getmtime(os.path.join(full_path, x)),
                            reverse=True
                        )[:3]  # Get 3 most recent
                        for lf in log_files:
                            lf_path = os.path.join(full_path, lf)
                            content, stats = self._read_log_file(lf_path, max_lines)
                            if content is not None:
                                log_name = f"wordpress:{lf}"
                                log_contents[log_name] = {
                                    'path': lf_path,
                                    'lines': content,
                                    'total_lines': stats['total_lines'],
                                    'file_size': stats['file_size'],
                                    'last_modified': stats['last_modified'],
                                    'error_count': stats['error_count'],
                                    'warning_count': stats['warning_count'],
                                }
                                errors_found += stats['error_count']
                                warnings_found += stats['warning_count']
                                files_read += 1
                    except Exception as e:
                        logger.warning(f"Error reading WordPress log directory {full_path}: {e}")

        # Collect system logs if enabled
        if include_system_logs:
            for log_file in self.SYSTEM_LOG_FILES:
                if os.path.exists(log_file):
                    content, stats = self._read_log_file(log_file, max_lines)
                    if content is not None:
                        log_name = f"system:{os.path.basename(log_file)}"
                        log_contents[log_name] = {
                            'path': log_file,
                            'lines': content,
                            'total_lines': stats['total_lines'],
                            'file_size': stats['file_size'],
                            'last_modified': stats['last_modified'],
                            'error_count': stats['error_count'],
                            'warning_count': stats['warning_count'],
                        }
                        errors_found += stats['error_count']
                        warnings_found += stats['warning_count']
                        files_read += 1

        # Collect custom paths
        for custom_path in custom_paths:
            if os.path.exists(custom_path):
                content, stats = self._read_log_file(custom_path, max_lines)
                if content is not None:
                    log_name = f"custom:{os.path.basename(custom_path)}"
                    log_contents[log_name] = {
                        'path': custom_path,
                        'lines': content,
                        'total_lines': stats['total_lines'],
                        'file_size': stats['file_size'],
                        'last_modified': stats['last_modified'],
                        'error_count': stats['error_count'],
                        'warning_count': stats['warning_count'],
                    }
                    errors_found += stats['error_count']
                    warnings_found += stats['warning_count']
                    files_read += 1

        duration = int((time.time() - start_time) * 1000)

        if files_read == 0:
            return CheckResult(
                status=CheckStatus.WARNING,
                score=70,
                message="No log files found to display",
                details={
                    'mode': 'display',
                    'magento_root': magento_root,
                    'include_system_logs': include_system_logs,
                    'logs': {},
                },
                duration=duration,
            )

        # Determine status based on error counts
        if errors_found > 50:
            status = CheckStatus.CRITICAL
            score = 30
            message = f"Found {errors_found} errors in {files_read} log files"
        elif errors_found > 10 or warnings_found > 50:
            status = CheckStatus.WARNING
            score = 70
            message = f"Found {errors_found} errors, {warnings_found} warnings in {files_read} log files"
        else:
            status = CheckStatus.PASSED
            score = 100
            message = f"Read {files_read} log files with {errors_found} errors"

        return CheckResult(
            status=status,
            score=score,
            message=message,
            details={
                'mode': 'display',
                'files_read': files_read,
                'total_errors': errors_found,
                'total_warnings': warnings_found,
                'max_lines_per_file': max_lines,
                'logs': log_contents,
            },
            duration=duration,
        )

    def _read_log_file(self, file_path: str, max_lines: int) -> tuple:
        """
        Read the last N lines from a log file.

        Returns:
            Tuple of (lines_list, stats_dict) or (None, None) if failed
        """
        try:
            file_stat = os.stat(file_path)
            file_size = file_stat.st_size
            last_modified = datetime.fromtimestamp(file_stat.st_mtime).isoformat()

            # Skip very large files
            if file_size > self.DEFAULT_MAX_FILE_SIZE_MB * 1024 * 1024:
                logger.warning(f"Skipping large file: {file_path} ({file_size} bytes)")
                return None, None

            # Read last N lines efficiently
            lines = self._tail_file_efficient(file_path, max_lines)

            # Count errors and warnings in the content
            error_count = 0
            warning_count = 0
            error_pattern = re.compile(r'\b(error|exception|fatal|critical)\b', re.IGNORECASE)
            warning_pattern = re.compile(r'\b(warning|warn)\b', re.IGNORECASE)

            for line in lines:
                if error_pattern.search(line):
                    error_count += 1
                elif warning_pattern.search(line):
                    warning_count += 1

            # Count total lines in file
            total_lines = self._count_lines(file_path)

            stats = {
                'total_lines': total_lines,
                'file_size': file_size,
                'file_size_human': self._format_size(file_size),
                'last_modified': last_modified,
                'error_count': error_count,
                'warning_count': warning_count,
            }

            return lines, stats

        except (IOError, OSError, PermissionError) as e:
            logger.warning(f"Cannot read file {file_path}: {e}")
            return None, None

    def _tail_file_efficient(self, file_path: str, n: int) -> List[str]:
        """
        Efficiently read the last n lines from a file.
        Uses a simple and reliable approach: read from end in chunks,
        accumulate lines, stop when we have enough.
        """
        try:
            with open(file_path, 'rb') as f:
                # Seek to end
                f.seek(0, 2)
                file_size = f.tell()

                if file_size == 0:
                    return []

                # Read from end in chunks
                buffer_size = 8192
                buffer = b''
                position = file_size
                read_entire_file = False

                while position > 0:
                    # Calculate how much to read
                    read_size = min(buffer_size, position)
                    position -= read_size

                    # Seek and read
                    f.seek(position)
                    chunk = f.read(read_size)
                    buffer = chunk + buffer

                    # Check if we read the entire file
                    if position == 0:
                        read_entire_file = True

                    # Count newlines - if we have enough, stop reading
                    # We need n+1 newlines to get n complete lines (plus potential partial first line)
                    if buffer.count(b'\n') >= n + 1:
                        break

                # Decode buffer
                try:
                    text = buffer.decode('utf-8', errors='replace')
                except:
                    text = buffer.decode('latin-1', errors='replace')

                # Split into lines
                all_lines = text.split('\n')

                # If we didn't read the entire file, the first "line" is partial - discard it
                if not read_entire_file and len(all_lines) > 0:
                    all_lines = all_lines[1:]

                # Filter out empty lines and strip whitespace
                all_lines = [line.strip() for line in all_lines if line.strip()]

                # Return last n lines
                return all_lines[-n:] if len(all_lines) > n else all_lines

        except Exception as e:
            logger.warning(f"Error reading file {file_path}: {e}")
            # Fallback to simple read
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    all_lines = f.readlines()
                    return [l.strip() for l in all_lines[-n:] if l.strip()]
            except:
                return []

    def _count_lines(self, file_path: str) -> int:
        """Count total lines in a file efficiently."""
        try:
            with open(file_path, 'rb') as f:
                return sum(1 for _ in f)
        except:
            return 0

    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human readable format."""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"

    def _execute_pattern_mode(self, start_time: float) -> CheckResult:
        """
        Execute in pattern mode - scan for error patterns.
        """
        paths = self.config.get('paths', [])
        custom_patterns = self.config.get('patterns', [])
        max_lines = self.config.get('max_lines', self.DEFAULT_MAX_LINES)
        max_file_size_mb = self.config.get('max_file_size_mb', self.DEFAULT_MAX_FILE_SIZE_MB)
        include_extensions = self.config.get('include_extensions', self.DEFAULT_INCLUDE_EXTENSIONS)

        if not paths:
            duration = int((time.time() - start_time) * 1000)
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message="No log paths configured",
                duration=duration,
            )

        try:
            # Build pattern list
            patterns = self._build_patterns(custom_patterns)

            # Collect log files
            log_files = self._collect_log_files(paths, include_extensions, max_file_size_mb)

            if not log_files:
                duration = int((time.time() - start_time) * 1000)
                return CheckResult(
                    status=CheckStatus.PASSED,
                    score=100,
                    message="No log files found to analyze",
                    details={'paths': paths},
                    duration=duration,
                )

            # Analyze logs
            matches = self._analyze_logs(log_files, patterns, max_lines)
            duration = int((time.time() - start_time) * 1000)

            # Categorize matches
            critical_matches = [m for m in matches if m.level == 'critical']
            warning_matches = [m for m in matches if m.level == 'warning']
            info_matches = [m for m in matches if m.level == 'info']

            # Determine status and score
            if critical_matches:
                status = CheckStatus.CRITICAL
                score = 30
                message = f"Found {len(critical_matches)} critical issues in logs"
            elif warning_matches:
                status = CheckStatus.WARNING
                score = 70
                message = f"Found {len(warning_matches)} warnings in logs"
            else:
                status = CheckStatus.PASSED
                score = 100
                message = f"No significant issues found in {len(log_files)} log files"

            return CheckResult(
                status=status,
                score=score,
                message=message,
                details={
                    'files_analyzed': len(log_files),
                    'total_matches': len(matches),
                    'critical_count': len(critical_matches),
                    'warning_count': len(warning_matches),
                    'info_count': len(info_matches),
                    'critical_matches': [self._match_to_dict(m) for m in critical_matches[:10]],
                    'warning_matches': [self._match_to_dict(m) for m in warning_matches[:10]],
                    'files': log_files,
                },
                duration=duration,
            )

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            logger.error(f"Log monitoring check failed: {e}")
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Check failed: {str(e)}",
                duration=duration,
            )

    def _build_patterns(self, custom_patterns: List[Dict[str, Any]]) -> List[LogPattern]:
        """
        Build pattern list from defaults and custom patterns.

        Args:
            custom_patterns: Custom pattern configurations

        Returns:
            List of LogPattern objects
        """
        patterns = list(DEFAULT_PATTERNS)

        for custom in custom_patterns:
            pattern = LogPattern(
                pattern=custom.get('pattern', ''),
                level=custom.get('level', 'warning'),
                description=custom.get('description', ''),
            )
            if pattern.compiled:
                patterns.append(pattern)

        return patterns

    def _collect_log_files(
        self,
        paths: List[str],
        include_extensions: List[str],
        max_file_size_mb: float,
    ) -> List[str]:
        """
        Collect log files from specified paths.

        Args:
            paths: List of file/directory paths
            include_extensions: File extensions to include
            max_file_size_mb: Maximum file size in MB

        Returns:
            List of log file paths
        """
        log_files = []
        max_size_bytes = max_file_size_mb * 1024 * 1024

        for path_str in paths:
            path = Path(path_str)

            if not path.exists():
                logger.warning(f"Path does not exist: {path}")
                continue

            if path.is_file():
                if self._should_include_file(path, include_extensions, max_size_bytes):
                    log_files.append(str(path))
            elif path.is_dir():
                for file_path in path.rglob('*'):
                    if file_path.is_file():
                        if self._should_include_file(file_path, include_extensions, max_size_bytes):
                            log_files.append(str(file_path))

        return log_files

    def _should_include_file(
        self,
        path: Path,
        include_extensions: List[str],
        max_size_bytes: float,
    ) -> bool:
        """
        Check if a file should be included in analysis.

        Args:
            path: File path
            include_extensions: Allowed extensions
            max_size_bytes: Maximum file size

        Returns:
            True if file should be included
        """
        # Check extension
        if path.suffix.lower() not in include_extensions:
            return False

        # Check size
        try:
            if path.stat().st_size > max_size_bytes:
                logger.debug(f"Skipping large file: {path}")
                return False
        except OSError:
            return False

        return True

    def _analyze_logs(
        self,
        log_files: List[str],
        patterns: List[LogPattern],
        max_lines: int,
    ) -> List[LogMatch]:
        """
        Analyze log files for pattern matches.

        Args:
            log_files: List of log file paths
            patterns: Patterns to search for
            max_lines: Maximum lines to read per file

        Returns:
            List of LogMatch objects
        """
        matches = []

        for file_path in log_files:
            try:
                file_matches = self._analyze_file(file_path, patterns, max_lines)
                matches.extend(file_matches)
            except Exception as e:
                logger.warning(f"Error analyzing {file_path}: {e}")

        return matches

    def _analyze_file(
        self,
        file_path: str,
        patterns: List[LogPattern],
        max_lines: int,
    ) -> List[LogMatch]:
        """
        Analyze a single log file.

        Args:
            file_path: Path to log file
            patterns: Patterns to search for
            max_lines: Maximum lines to read

        Returns:
            List of matches found
        """
        matches = []

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                # Read last N lines (tail)
                lines = self._tail_file(f, max_lines)

            for line_num, line in enumerate(lines, 1):
                line = line.strip()
                if not line:
                    continue

                for pattern in patterns:
                    if pattern.compiled and pattern.compiled.search(line):
                        matches.append(LogMatch(
                            file_path=file_path,
                            line_number=line_num,
                            line=line[:500],  # Truncate long lines
                            pattern=pattern.pattern,
                            level=pattern.level,
                        ))
                        break  # Only match first pattern per line

        except (IOError, OSError) as e:
            logger.warning(f"Cannot read file {file_path}: {e}")

        return matches

    def _tail_file(self, f, n: int) -> List[str]:
        """
        Read last n lines from file.

        Args:
            f: File object
            n: Number of lines to read

        Returns:
            List of lines
        """
        # Simple approach: read all and take last n
        # For very large files, a more efficient approach would be needed
        lines = f.readlines()
        return lines[-n:] if len(lines) > n else lines

    def _match_to_dict(self, match: LogMatch) -> Dict[str, Any]:
        """Convert LogMatch to dictionary."""
        return {
            'file': match.file_path,
            'line_number': match.line_number,
            'line': match.line,
            'pattern': match.pattern,
            'level': match.level,
        }
