"""
Main agent orchestrator.

Handles polling for tasks from the central server,
executing checks, and reporting results.
"""

import argparse
import logging
import platform
import signal
import sys
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Dict, Any, Optional

from .config import load_config, AgentConfig
from .communication import ApiClient, Task, TaskResult
from .communication.exceptions import (
    ApiError,
    AuthenticationError,
    RateLimitError,
    ServerError,
    ConnectionError as ApiConnectionError,
)
from .checks import CheckRegistry, CheckResult as CheckResultInternal

# Import check modules to register them
from .checks.system import DiskUsageCheck, CpuUsageCheck, MemoryUsageCheck, SystemHealthCheck
from .checks.files import FilesystemIntegrityCheck
from .checks.browser import CriticalFlowsCheck
from .checks.logs import LogMonitorCheck
from .checks.cms import MagentoHealthCheck, WordPressHealthCheck

logger = logging.getLogger(__name__)


class HexaScanAgent:
    """
    Main agent class for coordinating check execution and server communication.

    Responsibilities:
    - Load configuration
    - Connect to central server
    - Poll for tasks
    - Execute checks
    - Report results
    - Handle backoff and retries
    """

    def __init__(self, config_path: str = "/etc/hexascan-agent/agent.yaml"):
        """
        Initialize the agent with configuration.

        Args:
            config_path: Path to the agent configuration file
        """
        self.config_path = config_path
        self.config: Optional[AgentConfig] = None
        self.api_client: Optional[ApiClient] = None
        self.running = False
        self._current_poll_interval = 60  # Default, will be updated from config

    def _setup_logging(self):
        """Configure logging based on configuration."""
        log_config = self.config.logging
        log_level = getattr(logging, log_config.level.upper(), logging.INFO)

        # Configure root logger
        root_logger = logging.getLogger()
        root_logger.setLevel(log_level)

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        root_logger.addHandler(console_handler)

        # File handler (if configured)
        if log_config.file:
            log_path = Path(log_config.file)
            log_path.parent.mkdir(parents=True, exist_ok=True)

            file_handler = RotatingFileHandler(
                log_config.file,
                maxBytes=log_config.max_size_mb * 1024 * 1024,
                backupCount=log_config.backup_count,
            )
            file_handler.setLevel(log_level)
            file_handler.setFormatter(console_formatter)
            root_logger.addHandler(file_handler)

        logger.info(f"Logging configured: level={log_config.level}")

    def _get_agent_metadata(self) -> Dict[str, Any]:
        """Get agent metadata for heartbeat."""
        return {
            'version': '1.0.0',
            'platform': platform.system(),
            'platform_version': platform.version(),
            'python_version': platform.python_version(),
            'hostname': platform.node(),
            'capabilities': CheckRegistry.list_types(),
        }

    def start(self):
        """Start the agent polling loop."""
        logger.info(f"Starting HexaScanAgent with config: {self.config_path}")

        # Load configuration
        try:
            self.config = load_config(self.config_path)
            logger.info(f"Configuration loaded: agent={self.config.name}")
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            sys.exit(1)

        # Setup logging
        self._setup_logging()

        # Initialize API client
        self.api_client = ApiClient(
            endpoint=self.config.api.endpoint,
            api_key=self.config.api.api_key,
            timeout=self.config.api.timeout,
            verify_ssl=self.config.api.verify_ssl,
        )

        self._current_poll_interval = self.config.api.poll_interval
        self.running = True

        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        logger.info("HexaScanAgent started")

        # Main loop
        last_heartbeat = 0
        heartbeat_interval = 60  # Send heartbeat every 60 seconds

        while self.running:
            try:
                current_time = time.time()

                # Send heartbeat
                if current_time - last_heartbeat >= heartbeat_interval:
                    self._send_heartbeat()
                    last_heartbeat = current_time

                # Poll for tasks
                tasks = self._poll_tasks()

                # Execute tasks
                for task in tasks:
                    if not self.running:
                        break
                    self._execute_task(task)

                # Wait for next poll
                time.sleep(self._current_poll_interval)

            except AuthenticationError as e:
                logger.error(f"Authentication failed: {e}")
                logger.error("Please check your API key configuration")
                self.stop()

            except RateLimitError as e:
                backoff = self.api_client.get_backoff_interval('rate_limit')
                logger.warning(f"Rate limited, backing off for {backoff}s")
                self._current_poll_interval = backoff

            except ServerError as e:
                backoff = self.api_client.get_backoff_interval('server_error')
                logger.warning(f"Server error: {e}, backing off for {backoff}s")
                self._current_poll_interval = backoff

            except ApiConnectionError as e:
                logger.warning(f"Connection error: {e}, will retry")
                time.sleep(30)

            except Exception as e:
                logger.error(f"Unexpected error in agent loop: {e}", exc_info=True)
                time.sleep(60)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        logger.info(f"Received signal {signum}, shutting down...")
        self.stop()

    def stop(self):
        """Stop the agent gracefully."""
        self.running = False
        if self.api_client:
            self.api_client.close()
        logger.info("HexaScanAgent stopped")

    def _send_heartbeat(self):
        """Send heartbeat to server."""
        try:
            metadata = self._get_agent_metadata()
            self.api_client.heartbeat(metadata=metadata)
            logger.debug("Heartbeat sent successfully")
            # Reset poll interval on successful heartbeat
            self._current_poll_interval = self.config.api.poll_interval
        except ApiError as e:
            logger.warning(f"Heartbeat failed: {e}")

    def _poll_tasks(self) -> list:
        """Poll server for pending tasks."""
        try:
            tasks = self.api_client.get_tasks()
            if tasks:
                logger.info(f"Received {len(tasks)} tasks")
            return tasks
        except ApiError as e:
            logger.warning(f"Task polling failed: {e}")
            return []

    def _execute_task(self, task: Task):
        """
        Execute a single task.

        Args:
            task: Task to execute
        """
        logger.info(f"Executing task {task.id}: {task.check_type}")
        start_time = time.time()

        try:
            # Check if path is allowed
            task_paths = task.config.get('paths', [])
            for path in task_paths:
                if not self.config.is_path_allowed(path):
                    logger.warning(f"Path not allowed: {path}")
                    self._submit_error_result(
                        task,
                        f"Path not allowed by agent permissions: {path}",
                        int((time.time() - start_time) * 1000),
                    )
                    return

            # Create and execute check
            check = CheckRegistry.create(task.check_type, task.config)
            if check is None:
                logger.error(f"Unknown check type: {task.check_type}")
                self._submit_error_result(
                    task,
                    f"Unknown check type: {task.check_type}",
                    int((time.time() - start_time) * 1000),
                )
                return

            result = check.execute()
            duration = int((time.time() - start_time) * 1000)

            # Map internal status to API status
            status_map = {
                'passed': 'PASSED',
                'warning': 'WARNING',
                'critical': 'CRITICAL',
                'error': 'ERROR',
                'failed': 'ERROR',
            }

            # Submit result
            task_result = TaskResult(
                task_id=task.id,
                status=status_map.get(result.status.value, 'ERROR'),
                score=result.score,
                message=result.message,
                details=result.details,
                duration=duration,
            )
            self.api_client.submit_result(task_result)
            logger.info(f"Task {task.id} completed: {result.status.value}")

        except Exception as e:
            logger.error(f"Task {task.id} failed: {e}", exc_info=True)
            self._submit_error_result(
                task,
                str(e),
                int((time.time() - start_time) * 1000),
            )

    def _submit_error_result(self, task: Task, message: str, duration: int):
        """Submit an error result for a failed task."""
        try:
            task_result = TaskResult(
                task_id=task.id,
                status='ERROR',
                score=0,
                message=message,
                duration=duration,
            )
            self.api_client.submit_result(task_result)
        except ApiError as e:
            logger.error(f"Failed to submit error result: {e}")


def main():
    """Entry point for the agent."""
    parser = argparse.ArgumentParser(
        description='HexaScan Monitoring Agent',
    )
    parser.add_argument(
        '-c', '--config',
        default='/etc/hexascan-agent/agent.yaml',
        help='Path to configuration file (default: /etc/hexascan-agent/agent.yaml)',
    )
    parser.add_argument(
        '-v', '--version',
        action='version',
        version='%(prog)s 1.0.0',
    )
    args = parser.parse_args()

    # Basic logging until config is loaded
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    agent = HexaScanAgent(config_path=args.config)
    agent.start()


if __name__ == "__main__":
    main()
