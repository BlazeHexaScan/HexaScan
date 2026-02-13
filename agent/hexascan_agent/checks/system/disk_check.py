"""
Disk usage check implementation.
"""

import logging
import time
from typing import Dict, Any, Optional, List

import psutil

from ..base import BaseCheck, CheckResult, CheckStatus
from ..registry import CheckRegistry

logger = logging.getLogger(__name__)


@CheckRegistry.register('DISK_USAGE')
class DiskUsageCheck(BaseCheck):
    """
    Check disk usage across mounted filesystems.

    Configuration options:
        warning_threshold: Percentage threshold for warning (default: 80)
        critical_threshold: Percentage threshold for critical (default: 90)
        paths: List of specific paths to check (default: all mounted)
        exclude_types: List of filesystem types to exclude (default: ['tmpfs', 'devtmpfs'])
    """

    DEFAULT_WARNING_THRESHOLD = 80
    DEFAULT_CRITICAL_THRESHOLD = 90
    DEFAULT_EXCLUDE_TYPES = ['tmpfs', 'devtmpfs', 'squashfs', 'overlay']

    @property
    def name(self) -> str:
        return "Disk Usage"

    @property
    def category(self) -> str:
        return "infrastructure"

    def execute(self) -> CheckResult:
        """
        Execute disk usage check.

        Returns:
            CheckResult with disk usage information
        """
        start_time = time.time()

        warning_threshold = self.config.get('warning_threshold', self.DEFAULT_WARNING_THRESHOLD)
        critical_threshold = self.config.get('critical_threshold', self.DEFAULT_CRITICAL_THRESHOLD)
        paths = self.config.get('paths', [])
        exclude_types = self.config.get('exclude_types', self.DEFAULT_EXCLUDE_TYPES)

        try:
            disk_info = self._get_disk_usage(paths, exclude_types)
            duration = int((time.time() - start_time) * 1000)

            if not disk_info:
                return CheckResult(
                    status=CheckStatus.ERROR,
                    score=0,
                    message="No disk partitions found",
                    duration=duration,
                )

            # Analyze results
            max_usage = max(d['percent'] for d in disk_info)
            critical_disks = [d for d in disk_info if d['percent'] >= critical_threshold]
            warning_disks = [d for d in disk_info if warning_threshold <= d['percent'] < critical_threshold]

            # Determine status and score
            if critical_disks:
                status = CheckStatus.CRITICAL
                score = 30
                disks_str = ', '.join(f"{d['mountpoint']} ({d['percent']:.1f}%)" for d in critical_disks)
                message = f"Critical disk usage: {disks_str}"
            elif warning_disks:
                status = CheckStatus.WARNING
                score = 70
                disks_str = ', '.join(f"{d['mountpoint']} ({d['percent']:.1f}%)" for d in warning_disks)
                message = f"High disk usage: {disks_str}"
            else:
                status = CheckStatus.PASSED
                score = 100
                message = f"All disks healthy (max usage: {max_usage:.1f}%)"

            return CheckResult(
                status=status,
                score=score,
                message=message,
                details={
                    'disks': disk_info,
                    'max_usage_percent': max_usage,
                    'warning_threshold': warning_threshold,
                    'critical_threshold': critical_threshold,
                },
                duration=duration,
            )

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            logger.error(f"Disk check failed: {e}")
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Check failed: {str(e)}",
                duration=duration,
            )

    def _get_disk_usage(
        self,
        paths: List[str],
        exclude_types: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Get disk usage information.

        Args:
            paths: Specific paths to check (empty for all)
            exclude_types: Filesystem types to exclude

        Returns:
            List of disk usage dictionaries
        """
        disk_info = []

        if paths:
            # Check specific paths
            for path in paths:
                try:
                    usage = psutil.disk_usage(path)
                    disk_info.append({
                        'mountpoint': path,
                        'device': 'N/A',
                        'fstype': 'N/A',
                        'total_bytes': usage.total,
                        'used_bytes': usage.used,
                        'free_bytes': usage.free,
                        'percent': usage.percent,
                        'total_gb': round(usage.total / (1024**3), 2),
                        'used_gb': round(usage.used / (1024**3), 2),
                        'free_gb': round(usage.free / (1024**3), 2),
                    })
                except (OSError, PermissionError) as e:
                    logger.warning(f"Cannot access path {path}: {e}")
        else:
            # Check all mounted partitions
            for partition in psutil.disk_partitions(all=False):
                if partition.fstype in exclude_types:
                    continue

                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disk_info.append({
                        'mountpoint': partition.mountpoint,
                        'device': partition.device,
                        'fstype': partition.fstype,
                        'total_bytes': usage.total,
                        'used_bytes': usage.used,
                        'free_bytes': usage.free,
                        'percent': usage.percent,
                        'total_gb': round(usage.total / (1024**3), 2),
                        'used_gb': round(usage.used / (1024**3), 2),
                        'free_gb': round(usage.free / (1024**3), 2),
                    })
                except (OSError, PermissionError) as e:
                    logger.warning(f"Cannot access {partition.mountpoint}: {e}")

        return disk_info
