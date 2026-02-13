"""
Custom script check implementation.

Allows users to run custom shell scripts with configurable exit code interpretation.
Security: Scripts are validated for dangerous patterns before execution.
"""

import logging
import os
import re
import subprocess
import tempfile
import time
from typing import Dict, Any, List, Optional, Tuple

from ..base import BaseCheck, CheckResult, CheckStatus
from ..registry import CheckRegistry

logger = logging.getLogger(__name__)


# Dangerous command patterns that are BLOCKED
BLOCKED_PATTERNS: List[Tuple[re.Pattern, str]] = [
    # File deletion commands - block ALL rm usage
    (re.compile(r'\brm\s+'), 'File deletion with rm is not allowed'),
    (re.compile(r'\brmdir\b'), 'Directory deletion with rmdir is not allowed'),
    (re.compile(r'\bshred\b'), 'Secure file deletion with shred is not allowed'),
    (re.compile(r'\bunlink\b'), 'File deletion with unlink is not allowed'),
    (re.compile(r'\bfind\b.*-delete\b'), 'File deletion with find -delete is not allowed'),
    (re.compile(r'\bfind\b.*-exec\s+(rm|rmdir|unlink)\b'), 'File deletion with find -exec is not allowed'),

    # Database destructive operations
    (re.compile(r'\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA)\b', re.IGNORECASE), 'DROP statements are not allowed'),
    (re.compile(r'\bDELETE\s+FROM\b', re.IGNORECASE), 'DELETE FROM statements are not allowed'),
    (re.compile(r'\bTRUNCATE\s+(TABLE)?\b', re.IGNORECASE), 'TRUNCATE statements are not allowed'),
    (re.compile(r'\bALTER\s+TABLE\b.*\bDROP\b', re.IGNORECASE), 'ALTER TABLE DROP is not allowed'),

    # Disk/filesystem destructive operations
    (re.compile(r'\bdd\s+.*of=\/dev\/'), 'Writing to block devices with dd is not allowed'),
    (re.compile(r'\bmkfs\b'), 'Filesystem formatting with mkfs is not allowed'),
    (re.compile(r'\bfdisk\b'), 'Disk partitioning with fdisk is not allowed'),
    (re.compile(r'\bparted\b'), 'Disk partitioning with parted is not allowed'),

    # System control commands
    (re.compile(r'\bshutdown\b'), 'System shutdown commands are not allowed'),
    (re.compile(r'\breboot\b'), 'System reboot commands are not allowed'),
    (re.compile(r'\bpoweroff\b'), 'System poweroff commands are not allowed'),
    (re.compile(r'\bhalt\b'), 'System halt commands are not allowed'),
    (re.compile(r'\binit\s+[0-6]\b'), 'Changing runlevel with init is not allowed'),

    # Network/firewall manipulation
    (re.compile(r'\biptables\s+.*(-[ADIFR]|--delete|--flush|--insert)'), 'Firewall modification with iptables is not allowed'),
    (re.compile(r'\bufw\s+(disable|delete|deny|allow)'), 'Firewall modification with ufw is not allowed'),
    (re.compile(r'\bfirewall-cmd\b'), 'Firewall modification is not allowed'),

    # User/permission management
    (re.compile(r'\buseradd\b'), 'Adding users is not allowed'),
    (re.compile(r'\buserdel\b'), 'Deleting users is not allowed'),
    (re.compile(r'\busermod\b'), 'Modifying users is not allowed'),
    (re.compile(r'\bpasswd\b'), 'Changing passwords is not allowed'),
    (re.compile(r'\bgroupadd\b'), 'Adding groups is not allowed'),
    (re.compile(r'\bgroupdel\b'), 'Deleting groups is not allowed'),
    (re.compile(r'\bchmod\s+([0-7]*7[0-7]*|a\+[rwx])'), 'Setting world-writable permissions is not allowed'),
    (re.compile(r'\bchown\s+-R?\s*root'), 'Changing ownership to root is not allowed'),

    # Cron/scheduled tasks
    (re.compile(r'\bcrontab\s+(-[eirl]|-)'), 'Modifying crontab is not allowed'),
    # Only match 'at' command with time patterns (now, noon, midnight, HH:MM, etc.) or flags
    (re.compile(r'\bat\s+(now|noon|midnight|teatime|tomorrow|\d{1,2}:\d{2}|-[a-z])'), 'Scheduling tasks with at is not allowed'),

    # File overwrite/append to system files
    (re.compile(r'>\s*\/etc\/'), 'Writing to /etc/ is not allowed'),
    (re.compile(r'>>\s*\/etc\/'), 'Appending to /etc/ is not allowed'),
    (re.compile(r'>\s*\/var\/log\/'), 'Overwriting log files is not allowed'),
    (re.compile(r'\btee\s+(-a\s+)?\/etc\/'), 'Writing to /etc/ with tee is not allowed'),

    # Reverse shells and backdoors
    (re.compile(r'\bnc\s+.*-[ecl]'), 'Netcat with execution flags is not allowed'),
    (re.compile(r'\bbash\s+-i\s+.*\/dev\/tcp'), 'Reverse shell attempts are not allowed'),
    (re.compile(r'\/dev\/tcp\/'), 'TCP device access is not allowed'),
    (re.compile(r'\/dev\/udp\/'), 'UDP device access is not allowed'),
    (re.compile(r'\bexec\s+\d+<>\/dev\/tcp'), 'Network socket creation is not allowed'),

    # Fork bomb pattern
    (re.compile(r':\(\)\s*\{\s*:\|:&\s*\}\s*;:'), 'Fork bombs are not allowed'),

    # SSH key manipulation
    (re.compile(r'\bssh-keygen\b'), 'SSH key generation is not allowed'),
    (re.compile(r'\.ssh\/authorized_keys'), 'Modifying authorized_keys is not allowed'),

    # Sensitive file access
    (re.compile(r'\/etc\/shadow'), 'Accessing /etc/shadow is not allowed'),
    (re.compile(r'\/etc\/passwd\s*[^:]'), 'Modifying /etc/passwd is not allowed'),

    # Git destructive operations
    (re.compile(r'\bgit\s+push\s+.*--force'), 'Force push is not allowed'),
    (re.compile(r'\bgit\s+reset\s+--hard'), 'Hard reset is not allowed'),
    (re.compile(r'\bgit\s+clean\s+-[a-z]*f'), 'Git clean with force is not allowed'),

    # Package management (destructive)
    (re.compile(r'\bapt(-get)?\s+(remove|purge|autoremove)'), 'Package removal is not allowed'),
    (re.compile(r'\byum\s+(remove|erase)'), 'Package removal is not allowed'),
    (re.compile(r'\bdnf\s+(remove|erase)'), 'Package removal is not allowed'),
    (re.compile(r'\bpip\s+uninstall'), 'Package uninstallation is not allowed'),
    (re.compile(r'\bnpm\s+uninstall\s+-g'), 'Global package removal is not allowed'),

    # Service management (stop/disable)
    (re.compile(r'\bsystemctl\s+(stop|disable|mask)\s+'), 'Stopping or disabling services is not allowed'),
    (re.compile(r'\bservice\s+\S+\s+stop'), 'Stopping services is not allowed'),

    # Dangerous downloads
    (re.compile(r'\bwget\s+.*-O\s*\/'), 'Downloading to system paths is not allowed'),
    (re.compile(r'\bcurl\s+.*-o\s*\/'), 'Downloading to system paths is not allowed'),
    (re.compile(r'\|\s*bash\b'), 'Piping to bash is not allowed (curl | bash pattern)'),
    (re.compile(r'\|\s*sh\b'), 'Piping to sh is not allowed (curl | sh pattern)'),

    # Process killing
    (re.compile(r'\bkill\s+-9\s+'), 'Force killing processes is not allowed'),
    (re.compile(r'\bkillall\b'), 'killall command is not allowed'),
    (re.compile(r'\bpkill\s+'), 'pkill command is not allowed'),
]


def validate_script(script: str) -> Tuple[bool, List[str]]:
    """
    Validate a script for dangerous patterns.

    Args:
        script: The script content to validate

    Returns:
        Tuple of (is_valid, list of error messages)
    """
    errors = []
    for pattern, message in BLOCKED_PATTERNS:
        if pattern.search(script):
            errors.append(message)
    return len(errors) == 0, errors


@CheckRegistry.register('CUSTOM')
class CustomScriptCheck(BaseCheck):
    """
    Execute custom shell scripts and interpret exit codes.

    Configuration options:
        script: The script content to execute (required)
        interpreter: Script interpreter - bash, sh, or python3 (default: bash)
        timeout: Execution timeout in seconds (default: 30)
        working_directory: Directory to run script in (default: /tmp)
        success_exit_codes: Exit codes that indicate PASSED (default: [0])
        warning_exit_codes: Exit codes that indicate WARNING (default: [1])

    Any other exit code will be treated as CRITICAL/ERROR.
    """

    DEFAULT_TIMEOUT = 30
    DEFAULT_INTERPRETER = 'bash'
    DEFAULT_WORKING_DIR = '/tmp'
    DEFAULT_SUCCESS_CODES = [0]
    DEFAULT_WARNING_CODES = [1]

    # Allowed interpreters for security
    ALLOWED_INTERPRETERS = {
        'bash': '/bin/bash',
        'sh': '/bin/sh',
        'python3': '/usr/bin/python3',
        'python': '/usr/bin/python3',
    }

    @property
    def name(self) -> str:
        return "Custom Script"

    @property
    def category(self) -> str:
        return "custom"

    def execute(self) -> CheckResult:
        """
        Execute the custom script and return results.

        Returns:
            CheckResult with script execution status and output
        """
        start_time = time.time()

        # Get configuration
        script = self.config.get('script')
        if not script:
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message="No script provided in configuration",
                duration=0,
            )

        # SECURITY: Validate script for dangerous patterns
        is_valid, validation_errors = validate_script(script)
        if not is_valid:
            error_msg = f"Script blocked for security: {'; '.join(validation_errors)}"
            logger.warning(f"[CustomScript] {error_msg}")
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=error_msg,
                details={
                    'blocked_patterns': validation_errors,
                    'security_check': 'failed',
                },
                duration=0,
            )

        interpreter = self.config.get('interpreter', self.DEFAULT_INTERPRETER)
        timeout = self.config.get('timeout', self.DEFAULT_TIMEOUT)
        working_dir = self.config.get('working_directory', self.DEFAULT_WORKING_DIR)
        success_codes = self.config.get('success_exit_codes', self.DEFAULT_SUCCESS_CODES)
        warning_codes = self.config.get('warning_exit_codes', self.DEFAULT_WARNING_CODES)

        # Ensure codes are lists of integers
        if isinstance(success_codes, str):
            success_codes = [int(c.strip()) for c in success_codes.split(',') if c.strip()]
        if isinstance(warning_codes, str):
            warning_codes = [int(c.strip()) for c in warning_codes.split(',') if c.strip()]

        # Validate interpreter
        if interpreter not in self.ALLOWED_INTERPRETERS:
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Invalid interpreter: {interpreter}. Allowed: {list(self.ALLOWED_INTERPRETERS.keys())}",
                duration=0,
            )

        interpreter_path = self.ALLOWED_INTERPRETERS[interpreter]

        # Check if interpreter exists
        if not os.path.exists(interpreter_path):
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Interpreter not found: {interpreter_path}",
                duration=0,
            )

        # Validate working directory
        if not os.path.isdir(working_dir):
            logger.warning(f"Working directory {working_dir} does not exist, using /tmp")
            working_dir = '/tmp'

        try:
            result = self._execute_script(
                script=script,
                interpreter_path=interpreter_path,
                timeout=timeout,
                working_dir=working_dir,
            )

            duration = int((time.time() - start_time) * 1000)

            exit_code = result['exit_code']
            stdout = result['stdout']
            stderr = result['stderr']

            # Determine status based on exit code
            if exit_code in success_codes:
                status = CheckStatus.PASSED
                score = 100
                message = stdout.strip() if stdout.strip() else f"Script completed successfully (exit code: {exit_code})"
            elif exit_code in warning_codes:
                status = CheckStatus.WARNING
                score = 70
                message = stdout.strip() if stdout.strip() else f"Script completed with warning (exit code: {exit_code})"
            else:
                status = CheckStatus.CRITICAL
                score = 30
                # Prefer stderr for error messages, fall back to stdout
                error_output = stderr.strip() or stdout.strip()
                message = error_output if error_output else f"Script failed (exit code: {exit_code})"

            return CheckResult(
                status=status,
                score=score,
                message=message[:500],  # Truncate long messages
                details={
                    'exit_code': exit_code,
                    'stdout': stdout[:2000],  # Truncate output
                    'stderr': stderr[:2000],
                    'interpreter': interpreter,
                    'timeout': timeout,
                    'working_directory': working_dir,
                    'success_exit_codes': success_codes,
                    'warning_exit_codes': warning_codes,
                },
                duration=duration,
            )

        except subprocess.TimeoutExpired:
            duration = int((time.time() - start_time) * 1000)
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Script execution timed out after {timeout} seconds",
                details={
                    'timeout': timeout,
                    'interpreter': interpreter,
                },
                duration=duration,
            )

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            logger.error(f"Custom script check failed: {e}")
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Script execution failed: {str(e)}",
                duration=duration,
            )

    def _execute_script(
        self,
        script: str,
        interpreter_path: str,
        timeout: int,
        working_dir: str,
    ) -> Dict[str, Any]:
        """
        Execute the script content in a sandboxed environment.

        Creates a temporary file with the script content and executes it
        with resource limits and restricted environment.

        Args:
            script: Script content
            interpreter_path: Path to interpreter
            timeout: Execution timeout
            working_dir: Working directory

        Returns:
            Dict with exit_code, stdout, stderr
        """
        # Create temporary script file
        suffix = '.sh' if 'bash' in interpreter_path or 'sh' in interpreter_path else '.py'
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix=suffix,
            delete=False,
        ) as temp_file:
            # For shell scripts, add resource limits at the top
            if suffix == '.sh':
                # Add ulimit restrictions for sandboxing
                sandbox_header = """#!/bin/bash
# Security: Resource limits
ulimit -f 10240 2>/dev/null  # Max file size: 10MB
ulimit -n 64 2>/dev/null     # Max open files: 64
ulimit -u 32 2>/dev/null     # Max processes: 32
ulimit -v 524288 2>/dev/null # Max virtual memory: 512MB
ulimit -t 60 2>/dev/null     # Max CPU time: 60 seconds

# Original script follows:
"""
                temp_file.write(sandbox_header)
            temp_file.write(script)
            temp_file.flush()
            script_path = temp_file.name

        try:
            # Make script executable (only for owner)
            os.chmod(script_path, 0o700)

            logger.debug(f"[CustomScript] Executing script: {script_path}")
            logger.debug(f"[CustomScript] Interpreter: {interpreter_path}")
            logger.debug(f"[CustomScript] Working dir: {working_dir}")
            logger.debug(f"[CustomScript] Timeout: {timeout}s")

            # Execute the script with restricted environment
            process = subprocess.run(
                [interpreter_path, script_path],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=working_dir,
                env=self._get_safe_env(),
                # Don't inherit file descriptors
                close_fds=True,
            )

            return {
                'exit_code': process.returncode,
                'stdout': process.stdout,
                'stderr': process.stderr,
            }

        finally:
            # Clean up temporary file
            try:
                os.unlink(script_path)
            except OSError:
                pass

    def _get_safe_env(self) -> Dict[str, str]:
        """
        Get a safe environment for script execution.

        Includes basic environment variables but excludes sensitive ones.
        """
        safe_env = {
            'PATH': '/usr/local/bin:/usr/bin:/bin',
            'HOME': '/tmp',
            'LANG': 'C.UTF-8',
            'LC_ALL': 'C.UTF-8',
        }

        # Add some useful environment variables if they exist
        for key in ['HOSTNAME', 'USER']:
            if key in os.environ:
                safe_env[key] = os.environ[key]

        return safe_env
