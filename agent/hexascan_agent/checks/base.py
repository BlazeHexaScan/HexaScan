"""
Base check class for all monitoring checks.

All check implementations should inherit from this base class.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from enum import Enum


class CheckStatus(str, Enum):
    """Check execution status."""
    PASSED = "passed"
    WARNING = "warning"
    CRITICAL = "critical"
    ERROR = "error"
    FAILED = "failed"


class CheckResult:
    """Result of a check execution."""

    def __init__(
        self,
        status: CheckStatus,
        score: int,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        duration: float = 0.0
    ):
        self.status = status
        self.score = score
        self.message = message
        self.details = details or {}
        self.duration = duration

    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary for API transmission."""
        return {
            "status": self.status.value,
            "score": self.score,
            "message": self.message,
            "details": self.details,
            "duration": self.duration
        }


class BaseCheck(ABC):
    """Abstract base class for all checks."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the check with configuration.

        Args:
            config: Check-specific configuration
        """
        self.config = config or {}

    @abstractmethod
    def execute(self) -> CheckResult:
        """
        Execute the check and return results.

        Returns:
            CheckResult with status, score, and details
        """
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the check name."""
        pass

    @property
    @abstractmethod
    def category(self) -> str:
        """Return the check category (infrastructure, performance, etc.)."""
        pass
