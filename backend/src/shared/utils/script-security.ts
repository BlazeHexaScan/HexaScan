/**
 * Script Security Validation
 *
 * Validates custom scripts to prevent dangerous operations.
 * Backend validation - security critical.
 */

export interface ScriptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Dangerous command patterns that are BLOCKED
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; message: string; category: string }> = [
  // File deletion commands - block ALL rm usage
  { pattern: /\brm\s+/, message: 'File deletion with rm is not allowed', category: 'file-deletion' },
  { pattern: /\brmdir\b/, message: 'Directory deletion with rmdir is not allowed', category: 'file-deletion' },
  { pattern: /\bshred\b/, message: 'Secure file deletion with shred is not allowed', category: 'file-deletion' },
  { pattern: /\bunlink\b/, message: 'File deletion with unlink is not allowed', category: 'file-deletion' },
  { pattern: /\bfind\b.*-delete\b/, message: 'File deletion with find -delete is not allowed', category: 'file-deletion' },
  { pattern: /\bfind\b.*-exec\s+(rm|rmdir|unlink)\b/, message: 'File deletion with find -exec is not allowed', category: 'file-deletion' },

  // Database destructive operations
  { pattern: /\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA)\b/i, message: 'DROP statements are not allowed', category: 'database' },
  { pattern: /\bDELETE\s+FROM\b/i, message: 'DELETE FROM statements are not allowed', category: 'database' },
  { pattern: /\bTRUNCATE\s+(TABLE)?\b/i, message: 'TRUNCATE statements are not allowed', category: 'database' },
  { pattern: /\bALTER\s+TABLE\b.*\bDROP\b/i, message: 'ALTER TABLE DROP is not allowed', category: 'database' },

  // Disk/filesystem destructive operations
  { pattern: /\bdd\s+.*of=\/dev\//, message: 'Writing to block devices with dd is not allowed', category: 'disk' },
  { pattern: /\bmkfs\b/, message: 'Filesystem formatting with mkfs is not allowed', category: 'disk' },
  { pattern: /\bfdisk\b/, message: 'Disk partitioning with fdisk is not allowed', category: 'disk' },
  { pattern: /\bparted\b/, message: 'Disk partitioning with parted is not allowed', category: 'disk' },

  // System control commands
  { pattern: /\bshutdown\b/, message: 'System shutdown commands are not allowed', category: 'system' },
  { pattern: /\breboot\b/, message: 'System reboot commands are not allowed', category: 'system' },
  { pattern: /\bpoweroff\b/, message: 'System poweroff commands are not allowed', category: 'system' },
  { pattern: /\bhalt\b/, message: 'System halt commands are not allowed', category: 'system' },
  { pattern: /\binit\s+[0-6]\b/, message: 'Changing runlevel with init is not allowed', category: 'system' },

  // Network/firewall manipulation
  { pattern: /\biptables\s+.*(-[ADIFR]|--delete|--flush|--insert)/, message: 'Firewall modification with iptables is not allowed', category: 'network' },
  { pattern: /\bufw\s+(disable|delete|deny|allow)/, message: 'Firewall modification with ufw is not allowed', category: 'network' },
  { pattern: /\bfirewall-cmd\b/, message: 'Firewall modification is not allowed', category: 'network' },

  // User/permission management
  { pattern: /\buseradd\b/, message: 'Adding users is not allowed', category: 'user-mgmt' },
  { pattern: /\buserdel\b/, message: 'Deleting users is not allowed', category: 'user-mgmt' },
  { pattern: /\busermod\b/, message: 'Modifying users is not allowed', category: 'user-mgmt' },
  { pattern: /\bpasswd\b/, message: 'Changing passwords is not allowed', category: 'user-mgmt' },
  { pattern: /\bgroupadd\b/, message: 'Adding groups is not allowed', category: 'user-mgmt' },
  { pattern: /\bgroupdel\b/, message: 'Deleting groups is not allowed', category: 'user-mgmt' },
  { pattern: /\bchmod\s+([0-7]*7[0-7]*|a\+[rwx])/, message: 'Setting world-writable permissions is not allowed', category: 'permissions' },
  { pattern: /\bchown\s+-R?\s*root/, message: 'Changing ownership to root is not allowed', category: 'permissions' },

  // Cron/scheduled tasks
  { pattern: /\bcrontab\s+(-[eirl]|-)/, message: 'Modifying crontab is not allowed', category: 'scheduled-tasks' },
  // Only match 'at' command with time patterns (now, noon, midnight, HH:MM, etc.) or flags
  { pattern: /\bat\s+(now|noon|midnight|teatime|tomorrow|\d{1,2}:\d{2}|-[a-z])/, message: 'Scheduling tasks with at is not allowed', category: 'scheduled-tasks' },

  // File overwrite/append to system files
  { pattern: />\s*\/etc\//, message: 'Writing to /etc/ is not allowed', category: 'file-write' },
  { pattern: />>\s*\/etc\//, message: 'Appending to /etc/ is not allowed', category: 'file-write' },
  { pattern: />\s*\/var\/log\//, message: 'Overwriting log files is not allowed', category: 'file-write' },
  { pattern: /\btee\s+(-a\s+)?\/etc\//, message: 'Writing to /etc/ with tee is not allowed', category: 'file-write' },

  // Reverse shells and backdoors
  { pattern: /\bnc\s+.*-[ecl]/, message: 'Netcat with execution flags is not allowed', category: 'security' },
  { pattern: /\bbash\s+-i\s+.*\/dev\/tcp/, message: 'Reverse shell attempts are not allowed', category: 'security' },
  { pattern: /\/dev\/tcp\//, message: 'TCP device access is not allowed', category: 'security' },
  { pattern: /\/dev\/udp\//, message: 'UDP device access is not allowed', category: 'security' },
  { pattern: /\bexec\s+\d+<>\/dev\/tcp/, message: 'Network socket creation is not allowed', category: 'security' },

  // Fork bomb pattern
  { pattern: /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/, message: 'Fork bombs are not allowed', category: 'security' },

  // SSH key manipulation
  { pattern: /\bssh-keygen\b/, message: 'SSH key generation is not allowed', category: 'security' },
  { pattern: /\.ssh\/authorized_keys/, message: 'Modifying authorized_keys is not allowed', category: 'security' },

  // Sensitive file access
  { pattern: /\/etc\/shadow/, message: 'Accessing /etc/shadow is not allowed', category: 'security' },
  { pattern: /\/etc\/passwd\s*[^:]/, message: 'Modifying /etc/passwd is not allowed', category: 'security' },

  // Git destructive operations
  { pattern: /\bgit\s+push\s+.*--force/, message: 'Force push is not allowed', category: 'git' },
  { pattern: /\bgit\s+reset\s+--hard/, message: 'Hard reset is not allowed', category: 'git' },
  { pattern: /\bgit\s+clean\s+-[a-z]*f/, message: 'Git clean with force is not allowed', category: 'git' },

  // Package management (destructive)
  { pattern: /\bapt(-get)?\s+(remove|purge|autoremove)/, message: 'Package removal is not allowed', category: 'packages' },
  { pattern: /\byum\s+(remove|erase)/, message: 'Package removal is not allowed', category: 'packages' },
  { pattern: /\bdnf\s+(remove|erase)/, message: 'Package removal is not allowed', category: 'packages' },
  { pattern: /\bpip\s+uninstall/, message: 'Package uninstallation is not allowed', category: 'packages' },
  { pattern: /\bnpm\s+uninstall\s+-g/, message: 'Global package removal is not allowed', category: 'packages' },

  // Service management (stop/disable)
  { pattern: /\bsystemctl\s+(stop|disable|mask)\s+/, message: 'Stopping or disabling services is not allowed', category: 'services' },
  { pattern: /\bservice\s+\S+\s+stop/, message: 'Stopping services is not allowed', category: 'services' },

  // Dangerous downloads
  { pattern: /\bwget\s+.*-O\s*\//, message: 'Downloading to system paths is not allowed', category: 'downloads' },
  { pattern: /\bcurl\s+.*-o\s*\//, message: 'Downloading to system paths is not allowed', category: 'downloads' },
  { pattern: /\|\s*bash\b/, message: 'Piping to bash is not allowed (curl | bash pattern)', category: 'downloads' },
  { pattern: /\|\s*sh\b/, message: 'Piping to sh is not allowed (curl | sh pattern)', category: 'downloads' },

  // Process killing
  { pattern: /\bkill\s+-9\s+/, message: 'Force killing processes is not allowed', category: 'process' },
  { pattern: /\bkillall\b/, message: 'killall command is not allowed', category: 'process' },
  { pattern: /\bpkill\s+/, message: 'pkill command is not allowed', category: 'process' },
];

/**
 * Validate a custom script for dangerous patterns
 */
export function validateScript(script: string): ScriptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!script || script.trim().length === 0) {
    return {
      isValid: false,
      errors: ['Script content is required'],
      warnings: [],
    };
  }

  // Check for blocked patterns
  for (const { pattern, message } of BLOCKED_PATTERNS) {
    if (pattern.test(script)) {
      errors.push(message);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get a formatted error message for invalid scripts
 */
export function getScriptValidationError(result: ScriptValidationResult): string {
  if (result.isValid) {
    return '';
  }
  return `Script contains prohibited commands: ${result.errors.join('; ')}`;
}
