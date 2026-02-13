"""
API client for communicating with HexaScan server.

Handles authentication, request signing, and backoff strategies.
"""

import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests

from .exceptions import (
    ApiError,
    AuthenticationError,
    ConnectionError,
    RateLimitError,
    ServerError,
)

logger = logging.getLogger(__name__)


@dataclass
class Task:
    """Represents a task from the server."""

    id: str
    check_id: str
    check_type: str
    site_id: str
    config: Dict[str, Any]
    priority: int = 0


@dataclass
class TaskResult:
    """Result of a task execution."""

    task_id: str
    status: str  # 'PASSED', 'WARNING', 'CRITICAL', 'ERROR'
    score: float  # 0-100
    message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    duration: Optional[int] = None  # milliseconds


class ApiClient:
    """
    Client for communicating with HexaScan API.

    Features:
    - API key authentication
    - Automatic retry with exponential backoff
    - Rate limit handling
    """

    # Backoff configuration
    NORMAL_POLL_INTERVAL = 60  # seconds
    RATE_LIMIT_BACKOFF = [120, 240, 600]  # seconds
    SERVER_ERROR_BACKOFF = [300, 600, 1200]  # seconds
    MAX_RETRIES = 3

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        timeout: int = 30,
        verify_ssl: bool = True,
    ):
        """
        Initialize API client.

        Args:
            endpoint: Base URL of the API server
            api_key: Agent API key for authentication
            timeout: Request timeout in seconds
            verify_ssl: Whether to verify SSL certificates
        """
        self.endpoint = endpoint.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.verify_ssl = verify_ssl
        self.session = requests.Session()

        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'HexaScan-Agent/1.0.0',
            'X-Agent-Key': self.api_key,
        })

        # Backoff state
        self._current_backoff_index = 0
        self._last_error_type: Optional[str] = None

    def _build_url(self, path: str) -> str:
        """Build full URL from path."""
        return urljoin(self.endpoint + '/', path.lstrip('/'))

    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        """
        Handle API response and raise appropriate exceptions.

        Args:
            response: HTTP response object

        Returns:
            Parsed JSON response

        Raises:
            AuthenticationError: For 401/403 responses
            RateLimitError: For 429 responses
            ServerError: For 5xx responses
            ApiError: For other error responses
        """
        status_code = response.status_code

        # Parse response body
        try:
            data = response.json()
        except ValueError:
            data = {'message': response.text or 'Unknown error'}

        # Success
        if 200 <= status_code < 300:
            self._reset_backoff()
            return data

        # Authentication error
        if status_code in (401, 403):
            raise AuthenticationError(
                message=data.get('message', 'Authentication failed'),
                status_code=status_code,
                response=data,
            )

        # Rate limit
        if status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 120))
            raise RateLimitError(
                message=data.get('message', 'Rate limit exceeded'),
                status_code=status_code,
                response=data,
                retry_after=retry_after,
            )

        # Server error
        if status_code >= 500:
            raise ServerError(
                message=data.get('message', 'Server error'),
                status_code=status_code,
                response=data,
            )

        # Other client errors
        raise ApiError(
            message=data.get('message', 'Request failed'),
            status_code=status_code,
            response=data,
        )

    def _reset_backoff(self):
        """Reset backoff state after successful request."""
        self._current_backoff_index = 0
        self._last_error_type = None

    def get_backoff_interval(self, error_type: str) -> int:
        """
        Get current backoff interval based on error type.

        Args:
            error_type: 'rate_limit' or 'server_error'

        Returns:
            Backoff interval in seconds
        """
        if error_type != self._last_error_type:
            self._current_backoff_index = 0
            self._last_error_type = error_type

        if error_type == 'rate_limit':
            backoff_list = self.RATE_LIMIT_BACKOFF
        else:
            backoff_list = self.SERVER_ERROR_BACKOFF

        interval = backoff_list[min(self._current_backoff_index, len(backoff_list) - 1)]
        self._current_backoff_index += 1

        return interval

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Make HTTP request to API.

        Args:
            method: HTTP method (GET, POST, etc.)
            path: API path
            data: Request body data
            params: Query parameters

        Returns:
            Parsed JSON response

        Raises:
            ConnectionError: If connection fails
            Various ApiError subclasses for API errors
        """
        url = self._build_url(path)

        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                timeout=self.timeout,
                verify=self.verify_ssl,
            )
            return self._handle_response(response)

        except requests.exceptions.ConnectionError as e:
            raise ConnectionError(
                message=f"Failed to connect to server: {e}",
            )
        except requests.exceptions.Timeout as e:
            raise ConnectionError(
                message=f"Request timed out: {e}",
            )
        except requests.exceptions.RequestException as e:
            raise ConnectionError(
                message=f"Request failed: {e}",
            )

    def heartbeat(self, metadata: Optional[Dict[str, Any]] = None, status: str = 'ONLINE') -> Dict[str, Any]:
        """
        Send heartbeat to server.

        Args:
            metadata: Optional agent metadata (version, capabilities, etc.)
            status: Agent status ('ONLINE', 'OFFLINE', 'ERROR')

        Returns:
            Server response with agent configuration
        """
        logger.debug("Sending heartbeat")
        payload = {
            'status': status,
        }
        if metadata:
            payload['metadata'] = metadata

        response = self._request('POST', '/agent/heartbeat', data=payload)
        logger.debug("Heartbeat successful")
        return response

    def get_tasks(self) -> List[Task]:
        """
        Poll for pending tasks.

        Returns:
            List of tasks to execute
        """
        logger.debug("Polling for tasks")
        response = self._request('GET', '/agent/tasks')

        tasks = []
        for task_data in response.get('data', {}).get('tasks', []):
            task = Task(
                id=task_data.get('taskId') or task_data.get('id'),  # Support both taskId and id
                check_id=task_data['checkId'],
                check_type=task_data['checkType'],
                site_id=task_data['siteId'],
                config=task_data.get('checkConfig') or task_data.get('config', {}),  # Support both checkConfig and config
                priority=task_data.get('priority', 0),
            )
            tasks.append(task)

        logger.info(f"Received {len(tasks)} tasks")
        return tasks

    def submit_result(self, result: TaskResult) -> Dict[str, Any]:
        """
        Submit task execution result.

        Args:
            result: Task execution result

        Returns:
            Server acknowledgment
        """
        logger.debug(f"Submitting result for task {result.task_id}")
        payload = {
            'status': result.status,
            'score': result.score,
            'message': result.message,
            'details': result.details,
            'duration': result.duration,
        }

        response = self._request(
            'POST',
            f'/agent/tasks/{result.task_id}/complete',
            data=payload,
        )
        logger.info(f"Result submitted for task {result.task_id}")
        return response

    def register(
        self,
        name: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Register agent with server (for initial setup).

        Note: In normal operation, agents are pre-registered via dashboard.
        This method is for automated registration scenarios.

        Args:
            name: Agent name
            metadata: Optional agent metadata

        Returns:
            Registration response with agent ID
        """
        logger.info(f"Registering agent: {name}")
        payload = {
            'name': name,
            'metadata': metadata or {},
        }

        response = self._request('POST', '/agents', data=payload)
        logger.info("Agent registered successfully")
        return response

    def close(self):
        """Close the API client session."""
        self.session.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False
