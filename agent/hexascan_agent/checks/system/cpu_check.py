"""
CPU usage check implementation.
"""

import logging
import time
from typing import Dict, Any

import psutil

from ..base import BaseCheck, CheckResult, CheckStatus
from ..registry import CheckRegistry

logger = logging.getLogger(__name__)


@CheckRegistry.register('CPU_USAGE')
class CpuUsageCheck(BaseCheck):
    """
    Check CPU usage.

    Configuration options:
        warning_threshold: Percentage threshold for warning (default: 80)
        critical_threshold: Percentage threshold for critical (default: 95)
        sample_interval: CPU sampling interval in seconds (default: 1)
        per_cpu: Include per-CPU statistics (default: False)
    """

    DEFAULT_WARNING_THRESHOLD = 80
    DEFAULT_CRITICAL_THRESHOLD = 95
    DEFAULT_SAMPLE_INTERVAL = 1

    @property
    def name(self) -> str:
        return "CPU Usage"

    @property
    def category(self) -> str:
        return "infrastructure"

    def execute(self) -> CheckResult:
        """
        Execute CPU usage check.

        Returns:
            CheckResult with CPU usage information
        """
        start_time = time.time()

        warning_threshold = self.config.get('warning_threshold', self.DEFAULT_WARNING_THRESHOLD)
        critical_threshold = self.config.get('critical_threshold', self.DEFAULT_CRITICAL_THRESHOLD)
        sample_interval = self.config.get('sample_interval', self.DEFAULT_SAMPLE_INTERVAL)
        per_cpu = self.config.get('per_cpu', False)

        try:
            cpu_info = self._get_cpu_usage(sample_interval, per_cpu)
            duration = int((time.time() - start_time) * 1000)

            cpu_percent = cpu_info['percent']

            # Determine status and score
            if cpu_percent >= critical_threshold:
                status = CheckStatus.CRITICAL
                score = 30
                message = f"Critical CPU usage: {cpu_percent:.1f}%"
            elif cpu_percent >= warning_threshold:
                status = CheckStatus.WARNING
                score = 70
                message = f"High CPU usage: {cpu_percent:.1f}%"
            else:
                status = CheckStatus.PASSED
                score = 100
                message = f"CPU usage normal: {cpu_percent:.1f}%"

            return CheckResult(
                status=status,
                score=score,
                message=message,
                details={
                    'cpu_percent': cpu_percent,
                    'cpu_count': cpu_info['cpu_count'],
                    'cpu_count_logical': cpu_info['cpu_count_logical'],
                    'load_average': cpu_info.get('load_average'),
                    'per_cpu_percent': cpu_info.get('per_cpu_percent'),
                    'warning_threshold': warning_threshold,
                    'critical_threshold': critical_threshold,
                },
                duration=duration,
            )

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            logger.error(f"CPU check failed: {e}")
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Check failed: {str(e)}",
                duration=duration,
            )

    def _get_cpu_usage(
        self,
        sample_interval: float,
        per_cpu: bool,
    ) -> Dict[str, Any]:
        """
        Get CPU usage information.

        Args:
            sample_interval: Interval for CPU percentage calculation
            per_cpu: Whether to include per-CPU statistics

        Returns:
            Dictionary with CPU usage information
        """
        # Get overall CPU percentage (blocking call)
        cpu_percent = psutil.cpu_percent(interval=sample_interval)

        # Get CPU counts
        cpu_count = psutil.cpu_count(logical=False) or 0
        cpu_count_logical = psutil.cpu_count(logical=True) or 0

        cpu_info = {
            'percent': cpu_percent,
            'cpu_count': cpu_count,
            'cpu_count_logical': cpu_count_logical,
        }

        # Get load average (Unix only)
        try:
            load_avg = psutil.getloadavg()
            cpu_info['load_average'] = {
                '1min': round(load_avg[0], 2),
                '5min': round(load_avg[1], 2),
                '15min': round(load_avg[2], 2),
            }
        except (AttributeError, OSError):
            # Windows doesn't support getloadavg
            cpu_info['load_average'] = None

        # Get per-CPU percentages if requested
        if per_cpu:
            per_cpu_percent = psutil.cpu_percent(interval=0.1, percpu=True)
            cpu_info['per_cpu_percent'] = per_cpu_percent

        return cpu_info
