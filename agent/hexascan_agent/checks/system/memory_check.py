"""
Memory usage check implementation.
"""

import logging
import time
from typing import Dict, Any

import psutil

from ..base import BaseCheck, CheckResult, CheckStatus
from ..registry import CheckRegistry

logger = logging.getLogger(__name__)


@CheckRegistry.register('MEMORY_USAGE')
class MemoryUsageCheck(BaseCheck):
    """
    Check memory (RAM) usage.

    Configuration options:
        warning_threshold: Percentage threshold for warning (default: 85)
        critical_threshold: Percentage threshold for critical (default: 95)
        include_swap: Include swap memory information (default: True)
    """

    DEFAULT_WARNING_THRESHOLD = 85
    DEFAULT_CRITICAL_THRESHOLD = 95

    @property
    def name(self) -> str:
        return "Memory Usage"

    @property
    def category(self) -> str:
        return "infrastructure"

    def execute(self) -> CheckResult:
        """
        Execute memory usage check.

        Returns:
            CheckResult with memory usage information
        """
        start_time = time.time()

        warning_threshold = self.config.get('warning_threshold', self.DEFAULT_WARNING_THRESHOLD)
        critical_threshold = self.config.get('critical_threshold', self.DEFAULT_CRITICAL_THRESHOLD)
        include_swap = self.config.get('include_swap', True)

        try:
            memory_info = self._get_memory_usage(include_swap)
            duration = int((time.time() - start_time) * 1000)

            memory_percent = memory_info['percent']

            # Determine status and score
            if memory_percent >= critical_threshold:
                status = CheckStatus.CRITICAL
                score = 30
                message = f"Critical memory usage: {memory_percent:.1f}%"
            elif memory_percent >= warning_threshold:
                status = CheckStatus.WARNING
                score = 70
                message = f"High memory usage: {memory_percent:.1f}%"
            else:
                status = CheckStatus.PASSED
                score = 100
                message = f"Memory usage normal: {memory_percent:.1f}%"

            return CheckResult(
                status=status,
                score=score,
                message=message,
                details={
                    'memory_percent': memory_percent,
                    'total_bytes': memory_info['total_bytes'],
                    'available_bytes': memory_info['available_bytes'],
                    'used_bytes': memory_info['used_bytes'],
                    'total_gb': memory_info['total_gb'],
                    'available_gb': memory_info['available_gb'],
                    'used_gb': memory_info['used_gb'],
                    'swap': memory_info.get('swap'),
                    'warning_threshold': warning_threshold,
                    'critical_threshold': critical_threshold,
                },
                duration=duration,
            )

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            logger.error(f"Memory check failed: {e}")
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Check failed: {str(e)}",
                duration=duration,
            )

    def _get_memory_usage(self, include_swap: bool) -> Dict[str, Any]:
        """
        Get memory usage information.

        Args:
            include_swap: Whether to include swap information

        Returns:
            Dictionary with memory usage information
        """
        # Get virtual memory
        mem = psutil.virtual_memory()

        memory_info = {
            'percent': mem.percent,
            'total_bytes': mem.total,
            'available_bytes': mem.available,
            'used_bytes': mem.used,
            'total_gb': round(mem.total / (1024**3), 2),
            'available_gb': round(mem.available / (1024**3), 2),
            'used_gb': round(mem.used / (1024**3), 2),
        }

        # Add platform-specific memory details
        if hasattr(mem, 'buffers'):
            memory_info['buffers_bytes'] = mem.buffers
            memory_info['buffers_gb'] = round(mem.buffers / (1024**3), 2)
        if hasattr(mem, 'cached'):
            memory_info['cached_bytes'] = mem.cached
            memory_info['cached_gb'] = round(mem.cached / (1024**3), 2)

        # Get swap memory if requested
        if include_swap:
            swap = psutil.swap_memory()
            memory_info['swap'] = {
                'total_bytes': swap.total,
                'used_bytes': swap.used,
                'free_bytes': swap.free,
                'percent': swap.percent,
                'total_gb': round(swap.total / (1024**3), 2),
                'used_gb': round(swap.used / (1024**3), 2),
                'free_gb': round(swap.free / (1024**3), 2),
            }

        return memory_info
