"""
Combined System Health check implementation.

Checks CPU, Memory, Disk, and important service status in a single unified check.
Also includes top processes by CPU and Memory usage.
"""

import logging
import subprocess
import time
from typing import Dict, Any, List, Optional

import psutil

from ..base import BaseCheck, CheckResult, CheckStatus
from ..registry import CheckRegistry

logger = logging.getLogger(__name__)

# Default services to check (can be overridden via config)
DEFAULT_SERVICES = [
    'httpd', 'apache2', 'nginx',  # Web servers
    'mysqld', 'mariadb', 'mysql',  # MySQL/MariaDB
    'redis', 'redis-server',  # Redis
    'opensearch', 'elasticsearch',  # Search engines
    'crond', 'cron',  # Cron
    'php-fpm', 'php8.1-fpm', 'php8.2-fpm', 'php8.3-fpm',  # PHP-FPM
    'rabbitmq-server',  # RabbitMQ
    'varnish',  # Varnish
    'memcached',  # Memcached
    'postfix',  # Mail
    'sshd',  # SSH
]

# Mutually exclusive service groups - only one from each group should be shown
# (e.g., if apache2 is running, don't show nginx even if installed)
EXCLUSIVE_SERVICE_GROUPS = [
    ['httpd', 'apache2', 'nginx'],  # Web servers - typically only one runs
    ['opensearch', 'elasticsearch'],  # Search engines - typically only one runs
    ['mysqld', 'mariadb', 'mysql'],  # Database - these are variants/aliases
    ['redis', 'redis-server'],  # Redis - package name varies by distro
    ['crond', 'cron'],  # Cron - package name varies by distro
]


def format_bytes(bytes_value: int) -> str:
    """Format bytes to human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_value < 1024:
            return f"{bytes_value:.2f} {unit}"
        bytes_value /= 1024
    return f"{bytes_value:.2f} PB"


@CheckRegistry.register('SYSTEM_HEALTH')
class SystemHealthCheck(BaseCheck):
    """
    Combined system health check for CPU, Memory, Disk, and Service status.

    Configuration options:
        cpu_warning_threshold: CPU percentage for warning (default: 80)
        cpu_critical_threshold: CPU percentage for critical (default: 95)
        memory_warning_threshold: Memory percentage for warning (default: 80)
        memory_critical_threshold: Memory percentage for critical (default: 95)
        disk_warning_threshold: Disk percentage for warning (default: 80)
        disk_critical_threshold: Disk percentage for critical (default: 90)
        disk_exclude_types: Filesystem types to exclude (default: ['tmpfs', 'devtmpfs', 'squashfs', 'overlay'])
        include_processes: Include top processes by CPU/Memory (default: True)
        process_count: Number of top processes to return (default: 25)
        include_services: Include ALL installed services with status (default: True)
        critical_services: Services that trigger critical status if down (default: ['httpd', 'apache2', 'nginx', 'mysqld', 'mariadb'])
        include_firewall: Include firewall status check (default: True)
        include_open_ports: Include open ports security check (default: True)
    """

    DEFAULT_CPU_WARNING = 80
    DEFAULT_CPU_CRITICAL = 95
    DEFAULT_MEMORY_WARNING = 80
    DEFAULT_MEMORY_CRITICAL = 95
    DEFAULT_DISK_WARNING = 80
    DEFAULT_DISK_CRITICAL = 90
    DEFAULT_EXCLUDE_TYPES = ['tmpfs', 'devtmpfs', 'squashfs', 'overlay']
    DEFAULT_PROCESS_COUNT = 25
    DEFAULT_CRITICAL_SERVICES = ['httpd', 'apache2', 'nginx', 'mysqld', 'mariadb', 'mysql']

    @property
    def name(self) -> str:
        return "System Health"

    @property
    def category(self) -> str:
        return "infrastructure"

    def execute(self) -> CheckResult:
        """
        Execute combined system health check.

        Returns:
            CheckResult with CPU, Memory, Disk, Network, and Process information
        """
        start_time = time.time()

        try:
            # Get thresholds from config
            cpu_warning = self.config.get('cpu_warning_threshold', self.DEFAULT_CPU_WARNING)
            cpu_critical = self.config.get('cpu_critical_threshold', self.DEFAULT_CPU_CRITICAL)
            memory_warning = self.config.get('memory_warning_threshold', self.DEFAULT_MEMORY_WARNING)
            memory_critical = self.config.get('memory_critical_threshold', self.DEFAULT_MEMORY_CRITICAL)
            disk_warning = self.config.get('disk_warning_threshold', self.DEFAULT_DISK_WARNING)
            disk_critical = self.config.get('disk_critical_threshold', self.DEFAULT_DISK_CRITICAL)
            disk_exclude_types = self.config.get('disk_exclude_types', self.DEFAULT_EXCLUDE_TYPES)
            include_processes = self.config.get('include_processes', True)
            process_count = self.config.get('process_count', self.DEFAULT_PROCESS_COUNT)
            include_services = self.config.get('include_services', True)
            critical_services = self.config.get('critical_services', self.DEFAULT_CRITICAL_SERVICES)
            include_firewall = self.config.get('include_firewall', True)
            include_open_ports = self.config.get('include_open_ports', True)

            # Collect all metrics
            cpu_data = self._get_cpu_info(cpu_warning, cpu_critical)
            memory_data = self._get_memory_info(memory_warning, memory_critical)
            disk_data = self._get_disk_info(disk_warning, disk_critical, disk_exclude_types)

            # Collect optional metrics - services now includes ALL installed services
            services_data = self._get_services_status([], critical_services) if include_services else None
            processes_data = self._get_top_processes(process_count) if include_processes else None

            # Collect security-related metrics
            firewall_data = self._get_firewall_status() if include_firewall else None
            open_ports_data = self._get_open_ports() if include_open_ports else None

            duration = int((time.time() - start_time) * 1000)

            # Calculate overall status (worst of all)
            statuses = [cpu_data['status'], memory_data['status'], disk_data['status']]
            if services_data and services_data.get('status'):
                statuses.append(services_data['status'])

            if 'critical' in statuses:
                overall_status = CheckStatus.CRITICAL
            elif 'warning' in statuses:
                overall_status = CheckStatus.WARNING
            else:
                overall_status = CheckStatus.PASSED

            # Calculate combined score (weighted average)
            # CPU: 25%, Memory: 25%, Disk: 30%, Services: 20%
            if services_data:
                combined_score = int(
                    cpu_data['score'] * 0.25 +
                    memory_data['score'] * 0.25 +
                    disk_data['score'] * 0.30 +
                    services_data.get('score', 100) * 0.20
                )
            else:
                combined_score = int(
                    cpu_data['score'] * 0.30 +
                    memory_data['score'] * 0.30 +
                    disk_data['score'] * 0.40
                )

            # Build summary message
            issues = []
            if cpu_data['status'] != 'passed':
                issues.append(f"CPU {cpu_data['percent']:.1f}%")
            if memory_data['status'] != 'passed':
                issues.append(f"Memory {memory_data['percent']:.1f}%")
            if disk_data['status'] != 'passed':
                issues.append(f"Disk {disk_data['max_percent']:.1f}%")
            if services_data and services_data.get('status') != 'passed':
                down_count = services_data.get('down_count', 0)
                issues.append(f"{down_count} service(s) down")

            # Add security-related issues
            if open_ports_data and open_ports_data.get('security_status') == 'critical':
                issues.append(open_ports_data.get('security_message', 'Risky ports exposed'))
            if firewall_data and not firewall_data.get('active'):
                issues.append('Firewall inactive')

            if issues:
                message = f"Issues detected: {', '.join(issues)}"
            else:
                message = f"System healthy - CPU: {cpu_data['percent']:.1f}%, Memory: {memory_data['percent']:.1f}%, Disk: {disk_data['max_percent']:.1f}%"

            details: Dict[str, Any] = {
                'cpu': cpu_data,
                'memory': memory_data,
                'disk': disk_data,
                'thresholds': {
                    'cpu': {'warning': cpu_warning, 'critical': cpu_critical},
                    'memory': {'warning': memory_warning, 'critical': memory_critical},
                    'disk': {'warning': disk_warning, 'critical': disk_critical},
                },
            }

            if services_data:
                details['services'] = services_data

            if processes_data:
                details['processes'] = processes_data

            # Add security-related data
            if firewall_data:
                details['firewall'] = firewall_data

            if open_ports_data:
                details['open_ports'] = open_ports_data

            return CheckResult(
                status=overall_status,
                score=combined_score,
                message=message,
                details=details,
                duration=duration,
            )

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            logger.error(f"System health check failed: {e}")
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Check failed: {str(e)}",
                duration=duration,
            )

    def _get_cpu_info(self, warning_threshold: int, critical_threshold: int) -> Dict[str, Any]:
        """Get CPU usage information."""
        # Get CPU percentage (average over 1 second)
        cpu_percent = psutil.cpu_percent(interval=1)

        # Get load averages (1, 5, 15 minutes)
        try:
            load_avg = psutil.getloadavg()
        except (AttributeError, OSError):
            # Windows doesn't support getloadavg
            load_avg = (0, 0, 0)

        # Get CPU count
        cpu_count = psutil.cpu_count()
        cpu_count_logical = psutil.cpu_count(logical=True)

        # Determine status
        if cpu_percent >= critical_threshold:
            status = 'critical'
            score = 30
        elif cpu_percent >= warning_threshold:
            status = 'warning'
            score = 70
        else:
            status = 'passed'
            score = 100

        return {
            'percent': cpu_percent,
            'load_avg_1m': load_avg[0],
            'load_avg_5m': load_avg[1],
            'load_avg_15m': load_avg[2],
            'cores_physical': cpu_count,
            'cores_logical': cpu_count_logical,
            'status': status,
            'score': score,
        }

    def _get_memory_info(self, warning_threshold: int, critical_threshold: int) -> Dict[str, Any]:
        """Get memory usage information."""
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()

        memory_percent = memory.percent

        # Determine status
        if memory_percent >= critical_threshold:
            status = 'critical'
            score = 30
        elif memory_percent >= warning_threshold:
            status = 'warning'
            score = 70
        else:
            status = 'passed'
            score = 100

        return {
            'percent': memory_percent,
            'total_gb': round(memory.total / (1024**3), 2),
            'used_gb': round(memory.used / (1024**3), 2),
            'available_gb': round(memory.available / (1024**3), 2),
            'swap_percent': swap.percent,
            'swap_total_gb': round(swap.total / (1024**3), 2),
            'swap_used_gb': round(swap.used / (1024**3), 2),
            'status': status,
            'score': score,
        }

    def _get_disk_info(
        self,
        warning_threshold: int,
        critical_threshold: int,
        exclude_types: List[str]
    ) -> Dict[str, Any]:
        """Get disk usage information."""
        disks = []
        max_percent = 0
        worst_status = 'passed'
        worst_score = 100

        for partition in psutil.disk_partitions(all=False):
            if partition.fstype in exclude_types:
                continue

            try:
                usage = psutil.disk_usage(partition.mountpoint)
                percent = usage.percent

                # Determine status for this disk
                if percent >= critical_threshold:
                    disk_status = 'critical'
                    disk_score = 30
                elif percent >= warning_threshold:
                    disk_status = 'warning'
                    disk_score = 70
                else:
                    disk_status = 'passed'
                    disk_score = 100

                # Track worst
                if percent > max_percent:
                    max_percent = percent
                    worst_status = disk_status
                    worst_score = disk_score

                disks.append({
                    'mountpoint': partition.mountpoint,
                    'device': partition.device,
                    'fstype': partition.fstype,
                    'percent': percent,
                    'total_gb': round(usage.total / (1024**3), 2),
                    'used_gb': round(usage.used / (1024**3), 2),
                    'free_gb': round(usage.free / (1024**3), 2),
                    'status': disk_status,
                })
            except (OSError, PermissionError) as e:
                logger.warning(f"Cannot access {partition.mountpoint}: {e}")

        return {
            'disks': disks,
            'max_percent': max_percent,
            'status': worst_status,
            'score': worst_score,
        }

    def _get_services_status(self, services: List[str], critical_services: List[str]) -> Dict[str, Any]:
        """
        Get status of ALL loaded systemd services on the system.

        Shows all currently loaded services with their running/stopped and enabled/disabled status.

        Args:
            services: List of service names (used for critical service detection)
            critical_services: List of services that trigger critical status if down

        Returns:
            Dictionary with all service status information
        """
        service_statuses = []
        running_count = 0
        stopped_count = 0
        enabled_count = 0
        disabled_count = 0
        critical_down = []

        try:
            # Get ALL currently loaded services from systemd using list-units
            # This shows services that are loaded into memory (active, inactive, failed)
            result = subprocess.run(
                ['systemctl', 'list-units', '--type=service', '--all', '--no-pager', '--no-legend'],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                logger.warning("Failed to list services")
                return {'services': [], 'total': 0, 'status': 'passed', 'score': 100}

            # Parse the output: UNIT LOAD ACTIVE SUB DESCRIPTION
            for line in result.stdout.strip().split('\n'):
                if not line.strip():
                    continue

                # Handle the bullet point that systemctl adds for failed services
                line = line.lstrip('●').strip()

                parts = line.split(None, 4)  # Split into max 5 parts
                if len(parts) >= 4:
                    unit_name = parts[0]
                    load_state = parts[1]   # loaded, not-found, masked
                    active_state = parts[2]  # active, inactive, failed
                    sub_state = parts[3]     # running, exited, dead, failed

                    # Remove .service suffix for cleaner display
                    service_name = unit_name.replace('.service', '')

                    # Skip template services (contain @)
                    if '@' in service_name:
                        continue

                    # Skip not-found or masked services
                    if load_state in ['not-found', 'masked']:
                        continue

                    # Check if service is enabled
                    is_enabled = self._is_service_enabled(unit_name)

                    is_running = active_state == 'active' and sub_state == 'running'
                    is_active = active_state == 'active'  # includes 'exited' services

                    service_statuses.append({
                        'name': service_name,
                        'is_running': is_running,
                        'is_enabled': is_enabled,
                        'status': sub_state,  # running, exited, dead, failed
                        'active_state': active_state,
                    })

                    # Count stats
                    if is_running:
                        running_count += 1
                    elif active_state == 'active':
                        # Service is active but not running (e.g., oneshot that exited)
                        running_count += 1
                    else:
                        stopped_count += 1

                    if is_enabled:
                        enabled_count += 1
                    else:
                        disabled_count += 1

                    # Check if critical service is down
                    if active_state != 'active' and service_name in critical_services:
                        critical_down.append(service_name)

            # Sort: running first, then by name
            service_statuses.sort(key=lambda s: (s['status'] != 'running', not s['is_running'], s['name']))

            # Filter critical_down based on exclusive groups
            # If apache2 is running, nginx shouldn't be flagged as critical (and vice versa)
            running_services = {s['name'] for s in service_statuses if s['is_running'] or s['active_state'] == 'active'}
            filtered_critical_down = []
            for service in critical_down:
                # Check if this service belongs to an exclusive group
                group = self._get_service_group(service)
                if group:
                    # Check if any other service from the same group is running
                    other_running = any(s in running_services for s in group if s != service)
                    if other_running:
                        # Another service from this group is running, skip this one
                        continue
                filtered_critical_down.append(service)
            critical_down = filtered_critical_down

        except subprocess.TimeoutExpired:
            logger.warning("Timeout listing services")
            return {'services': [], 'total': 0, 'status': 'passed', 'score': 100, 'error': 'timeout'}
        except FileNotFoundError:
            logger.warning("systemctl not available")
            return {'services': [], 'total': 0, 'status': 'passed', 'score': 100, 'error': 'systemctl not found'}
        except Exception as e:
            logger.error(f"Error listing services: {e}")
            return {'services': [], 'total': 0, 'status': 'passed', 'score': 100, 'error': str(e)}

        # Determine overall status based on critical services
        if critical_down:
            status = 'critical'
            score = 30
        else:
            status = 'passed'
            score = 100

        return {
            'services': service_statuses,
            'total': len(service_statuses),
            'running_count': running_count,
            'stopped_count': stopped_count,
            'enabled_count': enabled_count,
            'disabled_count': disabled_count,
            'critical_down': critical_down,
            'status': status,
            'score': score,
        }

    def _filter_exclusive_services(self, services: List[str]) -> List[str]:
        """
        Filter services to handle mutually exclusive groups.

        For groups like [apache2, nginx], only include the service that is
        actually running or enabled, not alternatives that may be installed
        but not in use.

        Args:
            services: List of service names to check

        Returns:
            Filtered list of services to actually check
        """
        result = []
        processed_in_group = set()

        for service in services:
            # Check if this service belongs to an exclusive group
            group = self._get_service_group(service)

            if group:
                # Skip if we already processed this group
                group_key = tuple(sorted(group))
                if group_key in processed_in_group:
                    continue
                processed_in_group.add(group_key)

                # Find which service(s) from this group are actually active or enabled
                active_services = self._get_active_services_from_group(group, services)
                result.extend(active_services)
            else:
                # Not in any exclusive group, add directly
                result.append(service)

        return result

    def _get_service_group(self, service_name: str) -> Optional[List[str]]:
        """
        Get the exclusive group a service belongs to, if any.

        Args:
            service_name: Name of the service

        Returns:
            List of services in the same exclusive group, or None
        """
        for group in EXCLUSIVE_SERVICE_GROUPS:
            if service_name in group:
                return group
        return None

    def _get_active_services_from_group(self, group: List[str], requested_services: List[str]) -> List[str]:
        """
        From a group of mutually exclusive services, return only those that
        are actually running or enabled on the system.

        Args:
            group: List of mutually exclusive service names
            requested_services: The original list of services to check

        Returns:
            List of services from the group that should be shown
        """
        active = []
        enabled_not_running = []

        for service in group:
            # Only consider services that were in the original request
            if service not in requested_services:
                continue

            try:
                result = subprocess.run(
                    ['systemctl', 'show', service, '--property=LoadState,ActiveState,UnitFileState'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )

                if result.returncode != 0:
                    continue

                props = {}
                for line in result.stdout.strip().split('\n'):
                    if '=' in line:
                        key, value = line.split('=', 1)
                        props[key] = value

                load_state = props.get('LoadState', 'not-found')
                active_state = props.get('ActiveState', 'unknown')
                unit_file_state = props.get('UnitFileState', '')

                # Skip if not loaded
                if load_state in ['not-found', 'masked']:
                    continue

                # If running, this is the one to show
                if active_state == 'active':
                    active.append(service)
                # If enabled but not running, track it
                elif unit_file_state == 'enabled':
                    enabled_not_running.append(service)

            except Exception as e:
                logger.debug(f"Error checking service {service} for group filtering: {e}")
                continue

        # Prefer running services, fall back to enabled services
        if active:
            return active
        elif enabled_not_running:
            return enabled_not_running
        else:
            # No service from group is running or enabled
            return []

    def _check_service(self, service_name: str) -> Optional[Dict[str, Any]]:
        """
        Check if a specific service is running.

        Shows all services that are installed on the system, including disabled ones.
        Only skips services that don't exist (not-found) or are masked.

        Args:
            service_name: Name of the service to check

        Returns:
            Dictionary with service status or None if service not installed
        """
        try:
            # Check if service is installed by checking its LoadState
            # A service is "installed" if LoadState is "loaded" (not "not-found")
            load_result = subprocess.run(
                ['systemctl', 'show', service_name, '--property=LoadState,ActiveState,UnitFileState'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if load_result.returncode != 0:
                return None

            # Parse the output
            props = {}
            for line in load_result.stdout.strip().split('\n'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    props[key] = value

            load_state = props.get('LoadState', 'not-found')
            active_state = props.get('ActiveState', 'unknown')

            # Skip services that are not loaded (package not installed)
            if load_state == 'not-found':
                return None

            # Skip services that are masked (intentionally hidden)
            if load_state == 'masked':
                return None

            # Show all installed services (including disabled ones)
            # A service is considered "installed" if LoadState is 'loaded'
            is_active = active_state == 'active'
            status_text = active_state

            # If service is active, get more details
            started_at = None
            if is_active:
                status_result = subprocess.run(
                    ['systemctl', 'show', service_name, '--property=ActiveEnterTimestamp'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if status_result.returncode == 0 and status_result.stdout:
                    timestamp_line = status_result.stdout.strip()
                    if '=' in timestamp_line:
                        started_at = timestamp_line.split('=', 1)[1].strip()

            return {
                'name': service_name,
                'is_running': is_active,
                'status': status_text,
                'started_at': started_at,
            }

        except subprocess.TimeoutExpired:
            logger.warning(f"Timeout checking service {service_name}")
            return None
        except FileNotFoundError:
            # systemctl not available, try alternative methods
            return self._check_service_alternative(service_name)
        except Exception as e:
            logger.debug(f"Error checking service {service_name}: {e}")
            return None

    def _check_service_alternative(self, service_name: str) -> Optional[Dict[str, Any]]:
        """
        Alternative method to check service status (for systems without systemctl).

        Args:
            service_name: Name of the service to check

        Returns:
            Dictionary with service status or None if not found
        """
        try:
            # Try using 'service' command
            result = subprocess.run(
                ['service', service_name, 'status'],
                capture_output=True,
                text=True,
                timeout=5
            )

            # Check if service is running based on return code and output
            is_running = result.returncode == 0 or 'running' in result.stdout.lower()

            if result.returncode == 0 or 'unrecognized' not in result.stderr.lower():
                return {
                    'name': service_name,
                    'is_running': is_running,
                    'status': 'running' if is_running else 'stopped',
                    'started_at': None,
                }

            return None

        except Exception:
            # Check if process is running by name
            for proc in psutil.process_iter(['name']):
                try:
                    if service_name in proc.info['name'].lower():
                        return {
                            'name': service_name,
                            'is_running': True,
                            'status': 'running',
                            'started_at': None,
                        }
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

            return None

    def _get_top_processes(self, count: int = 25) -> Dict[str, Any]:
        """
        Get top processes by CPU and Memory usage.

        Args:
            count: Number of top processes to return (default 25)

        Returns:
            Dictionary with top processes by CPU and Memory
        """
        processes = []

        # Iterate through all processes
        for proc in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent', 'cmdline']):
            try:
                pinfo = proc.info
                # Skip system processes with no name
                if not pinfo['name']:
                    continue

                # Get command line (truncate if too long)
                cmdline = ' '.join(pinfo['cmdline']) if pinfo['cmdline'] else pinfo['name']
                if len(cmdline) > 200:
                    cmdline = cmdline[:197] + '...'

                processes.append({
                    'pid': pinfo['pid'],
                    'name': pinfo['name'],
                    'user': pinfo['username'] or 'N/A',
                    'cpu_percent': pinfo['cpu_percent'] or 0.0,
                    'memory_percent': pinfo['memory_percent'] or 0.0,
                    'command': cmdline,
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        # Sort by CPU and get top N
        top_by_cpu = sorted(processes, key=lambda p: p['cpu_percent'], reverse=True)[:count]

        # Sort by Memory and get top N
        top_by_memory = sorted(processes, key=lambda p: p['memory_percent'], reverse=True)[:count]

        # Format percentages to 1 decimal place
        for p in top_by_cpu:
            p['cpu_percent'] = round(p['cpu_percent'], 1)
            p['memory_percent'] = round(p['memory_percent'], 1)

        for p in top_by_memory:
            p['cpu_percent'] = round(p['cpu_percent'], 1)
            p['memory_percent'] = round(p['memory_percent'], 1)

        return {
            'top_by_cpu': top_by_cpu,
            'top_by_memory': top_by_memory,
        }

    def _get_service_active_state(self, service_name: str) -> str:
        """Get the active state of a service."""
        try:
            result = subprocess.run(
                ['systemctl', 'is-active', service_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.stdout.strip()
        except Exception:
            return 'unknown'

    def _is_service_enabled(self, service_name: str) -> bool:
        """Check if a service is enabled (starts at boot)."""
        try:
            result = subprocess.run(
                ['systemctl', 'is-enabled', service_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            # enabled, disabled, static, masked, etc.
            return result.stdout.strip() == 'enabled'
        except Exception:
            return False

    def _get_firewall_status(self) -> Dict[str, Any]:
        """
        Check firewall status (UFW, firewalld, or iptables).

        Returns:
            Dictionary with firewall status information
        """
        firewall_info = {
            'active': False,
            'type': None,
            'status': 'unknown',
            'details': None,
        }

        # Check UFW (Ubuntu/Debian)
        try:
            result = subprocess.run(
                ['ufw', 'status'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                output = result.stdout.strip()
                if 'Status: active' in output:
                    firewall_info['active'] = True
                    firewall_info['type'] = 'ufw'
                    firewall_info['status'] = 'active'
                    # Parse rules
                    rules = []
                    lines = output.split('\n')
                    for line in lines[4:]:  # Skip header lines
                        if line.strip():
                            rules.append(line.strip())
                    firewall_info['details'] = {'rules_count': len(rules), 'rules': rules[:20]}  # Limit to 20 rules
                    return firewall_info
                elif 'Status: inactive' in output:
                    firewall_info['type'] = 'ufw'
                    firewall_info['status'] = 'inactive'
                    return firewall_info
        except FileNotFoundError:
            pass
        except Exception as e:
            logger.debug(f"UFW check error: {e}")

        # Check firewalld (RHEL/CentOS/Fedora)
        try:
            result = subprocess.run(
                ['firewall-cmd', '--state'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0 and 'running' in result.stdout.lower():
                firewall_info['active'] = True
                firewall_info['type'] = 'firewalld'
                firewall_info['status'] = 'running'

                # Get zones and services
                zones_result = subprocess.run(
                    ['firewall-cmd', '--get-active-zones'],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                services_result = subprocess.run(
                    ['firewall-cmd', '--list-services'],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                ports_result = subprocess.run(
                    ['firewall-cmd', '--list-ports'],
                    capture_output=True,
                    text=True,
                    timeout=10
                )

                firewall_info['details'] = {
                    'zones': zones_result.stdout.strip() if zones_result.returncode == 0 else '',
                    'allowed_services': services_result.stdout.strip().split() if services_result.returncode == 0 else [],
                    'allowed_ports': ports_result.stdout.strip().split() if ports_result.returncode == 0 else [],
                }
                return firewall_info
            elif 'not running' in result.stdout.lower() or result.returncode != 0:
                firewall_info['type'] = 'firewalld'
                firewall_info['status'] = 'not running'
                return firewall_info
        except FileNotFoundError:
            pass
        except Exception as e:
            logger.debug(f"firewalld check error: {e}")

        # Check iptables as fallback
        try:
            result = subprocess.run(
                ['iptables', '-L', '-n', '--line-numbers'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                output = result.stdout.strip()
                lines = output.split('\n')
                # Count non-empty, non-header rules
                rule_count = 0
                for line in lines:
                    if line and not line.startswith('Chain') and not line.startswith('num'):
                        rule_count += 1

                firewall_info['type'] = 'iptables'
                if rule_count > 0:
                    firewall_info['active'] = True
                    firewall_info['status'] = 'configured'
                    firewall_info['details'] = {'rules_count': rule_count}
                else:
                    firewall_info['status'] = 'no rules'
                return firewall_info
        except FileNotFoundError:
            pass
        except PermissionError:
            firewall_info['type'] = 'iptables'
            firewall_info['status'] = 'permission denied'
            return firewall_info
        except Exception as e:
            logger.debug(f"iptables check error: {e}")

        # No firewall found
        firewall_info['status'] = 'no firewall detected'
        return firewall_info

    def _get_open_ports(self) -> Dict[str, Any]:
        """
        Check for open/listening ports on the system.

        Returns:
            Dictionary with open ports information and security assessment
        """
        open_ports = []
        risky_ports = []

        # Well-known risky ports that shouldn't be publicly exposed
        RISKY_PORTS = {
            21: 'FTP',
            22: 'SSH',
            23: 'Telnet',
            25: 'SMTP',
            135: 'MSRPC',
            137: 'NetBIOS',
            138: 'NetBIOS',
            139: 'NetBIOS',
            445: 'SMB',
            1433: 'MSSQL',
            1434: 'MSSQL',
            3306: 'MySQL',
            3389: 'RDP',
            5432: 'PostgreSQL',
            5900: 'VNC',
            6379: 'Redis',
            11211: 'Memcached',
            27017: 'MongoDB',
        }

        # Ports that are typically safe to expose
        SAFE_PUBLIC_PORTS = {80, 443, 8080, 8443}

        try:
            # Try ss first (modern systems)
            result = subprocess.run(
                ['ss', '-tuln'],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')[1:]  # Skip header

                for line in lines:
                    parts = line.split()
                    if len(parts) >= 5:
                        state = parts[0]
                        local_addr = parts[4]

                        # Parse address and port
                        if ':' in local_addr:
                            # Handle IPv6 [::]:port format
                            if local_addr.startswith('['):
                                addr_parts = local_addr.rsplit(':', 1)
                                addr = addr_parts[0]
                                port = int(addr_parts[1]) if len(addr_parts) > 1 else 0
                            else:
                                # IPv4 or simple format
                                addr_parts = local_addr.rsplit(':', 1)
                                addr = addr_parts[0]
                                port = int(addr_parts[1]) if len(addr_parts) > 1 and addr_parts[1].isdigit() else 0

                            if port == 0:
                                continue

                            # Check if listening on all interfaces (publicly accessible)
                            is_public = addr in ['*', '0.0.0.0', '[::]', '::']

                            port_info = {
                                'port': port,
                                'address': addr,
                                'protocol': 'tcp' if 'tcp' in state.lower() or parts[0] == 'LISTEN' else 'udp',
                                'is_public': is_public,
                                'service': RISKY_PORTS.get(port, self._get_service_name(port)),
                            }
                            open_ports.append(port_info)

                            # Check if this is a risky port exposed publicly
                            if is_public and port in RISKY_PORTS and port not in SAFE_PUBLIC_PORTS:
                                risky_ports.append({
                                    'port': port,
                                    'service': RISKY_PORTS[port],
                                    'risk': 'high' if port in [23, 3389, 5900, 6379, 11211, 27017] else 'medium',
                                })

        except FileNotFoundError:
            # Fall back to netstat
            try:
                result = subprocess.run(
                    ['netstat', '-tuln'],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    lines = result.stdout.strip().split('\n')[2:]  # Skip headers
                    for line in lines:
                        parts = line.split()
                        if len(parts) >= 4:
                            local_addr = parts[3]
                            if ':' in local_addr:
                                addr, port_str = local_addr.rsplit(':', 1)
                                if port_str.isdigit():
                                    port = int(port_str)
                                    is_public = addr in ['*', '0.0.0.0', '::']
                                    open_ports.append({
                                        'port': port,
                                        'address': addr,
                                        'protocol': 'tcp' if 'tcp' in parts[0].lower() else 'udp',
                                        'is_public': is_public,
                                        'service': RISKY_PORTS.get(port, self._get_service_name(port)),
                                    })
                                    if is_public and port in RISKY_PORTS and port not in SAFE_PUBLIC_PORTS:
                                        risky_ports.append({
                                            'port': port,
                                            'service': RISKY_PORTS[port],
                                            'risk': 'high' if port in [23, 3389, 5900, 6379, 11211, 27017] else 'medium',
                                        })
            except Exception as e:
                logger.debug(f"netstat fallback failed: {e}")

        except Exception as e:
            logger.error(f"Error checking open ports: {e}")
            return {'ports': [], 'error': str(e)}

        # Sort ports
        open_ports.sort(key=lambda p: p['port'])
        public_ports = [p for p in open_ports if p['is_public']]

        # Determine security status
        if risky_ports:
            high_risk = [p for p in risky_ports if p['risk'] == 'high']
            if high_risk:
                security_status = 'critical'
                security_message = f"{len(high_risk)} high-risk port(s) publicly exposed"
            else:
                security_status = 'warning'
                security_message = f"{len(risky_ports)} potentially risky port(s) publicly exposed"
        elif len(public_ports) > len(SAFE_PUBLIC_PORTS):
            security_status = 'info'
            security_message = f"{len(public_ports)} public ports open (review recommended)"
        else:
            security_status = 'secure'
            security_message = "All ports properly secured"

        return {
            'total_listening': len(open_ports),
            'public_ports': public_ports,
            'public_count': len(public_ports),
            'risky_ports': risky_ports,
            'risky_count': len(risky_ports),
            'security_status': security_status,
            'security_message': security_message,
        }

    def _get_service_name(self, port: int) -> str:
        """Get common service name for a port."""
        common_ports = {
            80: 'HTTP',
            443: 'HTTPS',
            8080: 'HTTP-ALT',
            8443: 'HTTPS-ALT',
            53: 'DNS',
            110: 'POP3',
            143: 'IMAP',
            993: 'IMAPS',
            995: 'POP3S',
            587: 'SMTP-MSA',
            465: 'SMTPS',
            9200: 'Elasticsearch',
            9300: 'Elasticsearch',
            9000: 'PHP-FPM',
            15672: 'RabbitMQ',
            5672: 'AMQP',
        }
        return common_ports.get(port, '')
