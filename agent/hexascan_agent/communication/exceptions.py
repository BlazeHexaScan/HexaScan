"""
Custom exceptions for API communication.
"""


class ApiError(Exception):
    """Base exception for API errors."""

    def __init__(self, message: str, status_code: int = None, response: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response = response

    def __str__(self):
        if self.status_code:
            return f"[{self.status_code}] {self.message}"
        return self.message


class AuthenticationError(ApiError):
    """Raised when API key is invalid or missing."""
    pass


class RateLimitError(ApiError):
    """Raised when rate limit is exceeded."""

    def __init__(self, message: str, retry_after: int = None, **kwargs):
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


class ServerError(ApiError):
    """Raised when server returns 5xx error."""
    pass


class ConnectionError(ApiError):
    """Raised when connection to server fails."""
    pass
