"""
Communication module for HexaScan agent.

Handles API communication with the central server.
"""

from .api_client import ApiClient, Task, TaskResult
from .exceptions import (
    ApiError,
    AuthenticationError,
    RateLimitError,
    ServerError,
    ConnectionError,
)

__all__ = [
    'ApiClient',
    'Task',
    'TaskResult',
    'ApiError',
    'AuthenticationError',
    'RateLimitError',
    'ServerError',
    'ConnectionError',
]
