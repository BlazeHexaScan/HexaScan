"""
Configuration loader for HexaScan agent.

Loads and validates configuration from YAML files.
"""

import os
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

# Default configuration values
DEFAULT_CONFIG = {
    'agent': {
        'name': 'hexascan-agent',
        'version': '1.0.0',
    },
    'api': {
        'endpoint': 'http://localhost:3000/api/v1',
        'api_key_source': 'file',
        'api_key_file': '/etc/hexascan-agent/api_key',
        'api_key_env': 'HEXASCAN_API_KEY',
        'poll_interval': 60,
        'timeout': 30,
        'verify_ssl': True,
    },
    'permissions': {
        'level': 'read_only',
        'allowed_paths': ['/var/log', '/var/www'],
        'denied_paths': ['/etc/shadow', '/root/.ssh'],
    },
    'checks': {
        'system': {
            'disk': {'enabled': True, 'warning_threshold': 80, 'critical_threshold': 90},
            'cpu': {'enabled': True, 'warning_threshold': 80, 'critical_threshold': 95},
            'memory': {'enabled': True, 'warning_threshold': 85, 'critical_threshold': 95},
        },
    },
    'logging': {
        'level': 'INFO',
        'file': '/var/log/hexascan-agent/agent.log',
        'max_size_mb': 10,
        'backup_count': 5,
    },
}


@dataclass
class ApiConfig:
    """API connection configuration."""
    endpoint: str
    api_key: str
    poll_interval: int = 60
    timeout: int = 30
    verify_ssl: bool = True


@dataclass
class PermissionsConfig:
    """Permission configuration."""
    level: str = 'read_only'
    allowed_paths: List[str] = field(default_factory=list)
    denied_paths: List[str] = field(default_factory=list)


@dataclass
class CheckThresholds:
    """Threshold configuration for a check."""
    enabled: bool = True
    warning_threshold: int = 80
    critical_threshold: int = 90


@dataclass
class SystemChecksConfig:
    """System checks configuration."""
    disk: CheckThresholds = field(default_factory=CheckThresholds)
    cpu: CheckThresholds = field(default_factory=CheckThresholds)
    memory: CheckThresholds = field(default_factory=CheckThresholds)


@dataclass
class LoggingConfig:
    """Logging configuration."""
    level: str = 'INFO'
    file: Optional[str] = None
    max_size_mb: int = 10
    backup_count: int = 5


@dataclass
class AgentConfig:
    """Main agent configuration."""
    name: str
    version: str
    api: ApiConfig
    permissions: PermissionsConfig
    system_checks: SystemChecksConfig
    logging: LoggingConfig

    def is_path_allowed(self, path: str) -> bool:
        """Check if a path is allowed for operations."""
        path = os.path.abspath(path)

        # Check denied paths first (higher priority)
        for denied in self.permissions.denied_paths:
            if path.startswith(os.path.abspath(denied)):
                return False

        # Check allowed paths
        for allowed in self.permissions.allowed_paths:
            if path.startswith(os.path.abspath(allowed)):
                return True

        return False


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Deep merge two dictionaries."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _load_api_key(config: Dict[str, Any]) -> str:
    """Load API key from configured source."""
    api_config = config.get('api', {})
    source = api_config.get('api_key_source', 'file')

    if source == 'env':
        env_var = api_config.get('api_key_env', 'HEXASCAN_API_KEY')
        api_key = os.environ.get(env_var)
        if not api_key:
            raise ValueError(f"API key environment variable '{env_var}' not set")
        return api_key.strip()

    elif source == 'file':
        key_file = api_config.get('api_key_file', '/etc/hexascan-agent/api_key')
        key_path = Path(key_file)

        if not key_path.exists():
            raise FileNotFoundError(f"API key file not found: {key_file}")

        api_key = key_path.read_text().strip()
        if not api_key:
            raise ValueError(f"API key file is empty: {key_file}")

        return api_key

    else:
        raise ValueError(f"Invalid api_key_source: {source}")


def load_config(config_path: str = "/etc/hexascan-agent/agent.yaml") -> AgentConfig:
    """
    Load and validate agent configuration.

    Args:
        config_path: Path to the YAML configuration file

    Returns:
        Validated AgentConfig object

    Raises:
        FileNotFoundError: If config file doesn't exist
        ValueError: If configuration is invalid
    """
    path = Path(config_path)

    # Start with defaults
    config = DEFAULT_CONFIG.copy()

    # Load and merge custom config if exists
    if path.exists():
        logger.info(f"Loading configuration from {config_path}")
        with open(path, 'r') as f:
            custom_config = yaml.safe_load(f) or {}
        config = _deep_merge(config, custom_config)
    else:
        logger.warning(f"Config file not found at {config_path}, using defaults")

    # Load API key
    try:
        api_key = _load_api_key(config)
    except (FileNotFoundError, ValueError) as e:
        logger.error(f"Failed to load API key: {e}")
        raise

    # Build configuration objects
    api_cfg = config.get('api', {})
    api_config = ApiConfig(
        endpoint=api_cfg.get('endpoint', DEFAULT_CONFIG['api']['endpoint']),
        api_key=api_key,
        poll_interval=api_cfg.get('poll_interval', 60),
        timeout=api_cfg.get('timeout', 30),
        verify_ssl=api_cfg.get('verify_ssl', True),
    )

    perm_cfg = config.get('permissions', {})
    permissions_config = PermissionsConfig(
        level=perm_cfg.get('level', 'read_only'),
        allowed_paths=perm_cfg.get('allowed_paths', []),
        denied_paths=perm_cfg.get('denied_paths', []),
    )

    checks_cfg = config.get('checks', {}).get('system', {})

    disk_cfg = checks_cfg.get('disk', {})
    disk_thresholds = CheckThresholds(
        enabled=disk_cfg.get('enabled', True),
        warning_threshold=disk_cfg.get('warning_threshold', 80),
        critical_threshold=disk_cfg.get('critical_threshold', 90),
    )

    cpu_cfg = checks_cfg.get('cpu', {})
    cpu_thresholds = CheckThresholds(
        enabled=cpu_cfg.get('enabled', True),
        warning_threshold=cpu_cfg.get('warning_threshold', 80),
        critical_threshold=cpu_cfg.get('critical_threshold', 95),
    )

    memory_cfg = checks_cfg.get('memory', {})
    memory_thresholds = CheckThresholds(
        enabled=memory_cfg.get('enabled', True),
        warning_threshold=memory_cfg.get('warning_threshold', 85),
        critical_threshold=memory_cfg.get('critical_threshold', 95),
    )

    system_checks_config = SystemChecksConfig(
        disk=disk_thresholds,
        cpu=cpu_thresholds,
        memory=memory_thresholds,
    )

    log_cfg = config.get('logging', {})
    logging_config = LoggingConfig(
        level=log_cfg.get('level', 'INFO'),
        file=log_cfg.get('file'),
        max_size_mb=log_cfg.get('max_size_mb', 10),
        backup_count=log_cfg.get('backup_count', 5),
    )

    agent_cfg = config.get('agent', {})

    return AgentConfig(
        name=agent_cfg.get('name', 'hexascan-agent'),
        version=agent_cfg.get('version', '1.0.0'),
        api=api_config,
        permissions=permissions_config,
        system_checks=system_checks_config,
        logging=logging_config,
    )
