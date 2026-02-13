"""
Check registry for dynamic check discovery and instantiation.
"""

import logging
from typing import Dict, Type, Optional, Any

from .base import BaseCheck

logger = logging.getLogger(__name__)


class CheckRegistry:
    """
    Registry for managing available check types.

    Allows dynamic registration and instantiation of checks.
    """

    _checks: Dict[str, Type[BaseCheck]] = {}

    @classmethod
    def register(cls, check_type: str):
        """
        Decorator to register a check class.

        Args:
            check_type: Unique identifier for the check type

        Example:
            @CheckRegistry.register('DISK_USAGE')
            class DiskUsageCheck(BaseCheck):
                ...
        """
        def decorator(check_class: Type[BaseCheck]):
            if check_type in cls._checks:
                logger.warning(f"Check type '{check_type}' already registered, overwriting")
            cls._checks[check_type] = check_class
            logger.debug(f"Registered check type: {check_type}")
            return check_class
        return decorator

    @classmethod
    def get(cls, check_type: str) -> Optional[Type[BaseCheck]]:
        """
        Get a check class by type.

        Args:
            check_type: Check type identifier

        Returns:
            Check class or None if not found
        """
        return cls._checks.get(check_type)

    @classmethod
    def create(cls, check_type: str, config: Optional[Dict[str, Any]] = None) -> Optional[BaseCheck]:
        """
        Create a check instance by type.

        Args:
            check_type: Check type identifier
            config: Check configuration

        Returns:
            Check instance or None if type not found
        """
        check_class = cls.get(check_type)
        if check_class is None:
            logger.error(f"Unknown check type: {check_type}")
            return None
        return check_class(config=config)

    @classmethod
    def list_types(cls) -> list:
        """
        List all registered check types.

        Returns:
            List of check type identifiers
        """
        return list(cls._checks.keys())

    @classmethod
    def clear(cls):
        """Clear all registered checks (mainly for testing)."""
        cls._checks.clear()
