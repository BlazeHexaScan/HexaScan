"""
Filesystem Integrity Check implementation.

Monitors file changes in specified directories using checksums and metadata.
Does not require Git - works on any directory.
Optionally includes Git status for repositories within watch paths.
"""

import logging
import os
import hashlib
import json
import time
import subprocess
from datetime import datetime
from typing import Dict, Any, List, Optional, Set, Tuple
from pathlib import Path

from ..base import BaseCheck, CheckResult, CheckStatus
from ..registry import CheckRegistry

logger = logging.getLogger(__name__)


@CheckRegistry.register('FILESYSTEM_INTEGRITY')
class FilesystemIntegrityCheck(BaseCheck):
    """
    Monitor filesystem changes in specified directories.

    This check creates a baseline snapshot of files (checksums, sizes, permissions, mtimes)
    and compares against it on subsequent runs to detect changes.

    Optionally includes Git status for repositories within watch paths.

    Configuration options:
        watch_paths: List of paths to monitor (required)
        baseline_file: Path to store baseline snapshot (default: /tmp/hexascan-agent-baselines/{hash}.json)
                      NOTE: /tmp is cleared on reboot. Baselines will be recreated on first check after reboot.
                      To use persistent storage, specify a custom baseline_file path in check configuration
        include_patterns: List of file patterns to include (e.g., ['*.php', '*.js'])
        exclude_patterns: List of file patterns to exclude (e.g., ['*.log', 'cache/*'])
        check_permissions: Whether to check file permissions (default: True)
        check_ownership: Whether to check file ownership (default: True)
        checksum_algorithm: Algorithm for checksums - 'md5', 'sha1', 'sha256' (default: 'sha256')
        max_file_size_mb: Skip checksums for files larger than this (default: 100)
        critical_patterns: Patterns that trigger critical status if changed (e.g., ['*.php', 'index.*'])
        warning_patterns: Patterns that trigger warning status if changed (e.g., ['*.js', '*.css'])
        auto_update_baseline: Auto-update baseline after detecting changes (default: False)

        Git Status Options:
        include_git_status: Include Git repository status in the check (default: False)
        run_as_user: User to run git commands as (for permission issues, e.g., 'sysadmin')
        git_compare_to: What to compare against - 'staged', 'head', 'remote', 'last_commit' (default: 'head')
    """

    DEFAULT_BASELINE_DIR = '/tmp/hexascan-agent-baselines'
    DEFAULT_CHECKSUM_ALGO = 'sha256'
    DEFAULT_MAX_FILE_SIZE_MB = 100

    @property
    def name(self) -> str:
        return "Filesystem Integrity Monitor"

    @property
    def category(self) -> str:
        return "security"

    def execute(self) -> CheckResult:
        """
        Execute filesystem integrity check.

        Returns:
            CheckResult with file change information
        """
        start_time = time.time()

        watch_paths = self.config.get('watch_paths', [])
        baseline_file = self.config.get('baseline_file', '')
        include_patterns = self.config.get('include_patterns', [])
        exclude_patterns = self.config.get('exclude_patterns', [])
        check_permissions = self.config.get('check_permissions', True)
        check_ownership = self.config.get('check_ownership', True)
        checksum_algo = self.config.get('checksum_algorithm', self.DEFAULT_CHECKSUM_ALGO)
        max_file_size_mb = self.config.get('max_file_size_mb', self.DEFAULT_MAX_FILE_SIZE_MB)
        critical_patterns = self.config.get('critical_patterns', [])
        warning_patterns = self.config.get('warning_patterns', [])
        auto_update = self.config.get('auto_update_baseline', False)

        # Git status options
        include_git_status = self.config.get('include_git_status', False)
        run_as_user = self.config.get('run_as_user', '')
        git_compare_to = self.config.get('git_compare_to', 'head')

        if not watch_paths:
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message="At least one watch path is required",
                duration=int((time.time() - start_time) * 1000),
            )

        # Validate paths
        valid_paths = []
        for path in watch_paths:
            expanded_path = os.path.expanduser(path)
            if not os.path.exists(expanded_path):
                logger.warning(f"Watch path does not exist: {expanded_path}")
                continue
            if not os.path.isdir(expanded_path):
                logger.warning(f"Watch path is not a directory: {expanded_path}")
                continue
            valid_paths.append(expanded_path)

        if not valid_paths:
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message="No valid watch paths found",
                duration=int((time.time() - start_time) * 1000),
            )

        # Determine baseline file path
        if not baseline_file:
            baseline_file = self._get_default_baseline_path(valid_paths)

        baseline_path = Path(baseline_file)

        # Try to create baseline directory
        try:
            baseline_path.parent.mkdir(parents=True, exist_ok=True)
        except (OSError, PermissionError) as e:
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Cannot create baseline directory: {e}",
                details={
                    'error': str(e),
                    'baseline_dir': str(baseline_path.parent),
                    'suggestion': f'Ensure the agent has write permissions to {baseline_path.parent} or specify a custom baseline_file path in the check configuration'
                },
                duration=int((time.time() - start_time) * 1000),
            )

        try:
            # Scan current filesystem state
            current_snapshot = self._scan_directories(
                valid_paths,
                include_patterns,
                exclude_patterns,
                check_permissions,
                check_ownership,
                checksum_algo,
                max_file_size_mb * 1024 * 1024  # Convert to bytes
            )

            # Load or create baseline
            if baseline_path.exists():
                with open(baseline_path, 'r') as f:
                    baseline_snapshot = json.load(f)
                is_first_run = False
            else:
                # First run - create baseline
                baseline_snapshot = current_snapshot
                try:
                    # Write baseline with explicit flush
                    with open(baseline_path, 'w') as f:
                        json.dump(baseline_snapshot, f, indent=2)
                        f.flush()  # Flush Python's buffer
                        # Note: os.fsync() can fail on some filesystems (network mounts, etc)

                    # Verify the file was actually written
                    if not baseline_path.exists():
                        raise OSError(f"Baseline file was not created at {baseline_path}")

                    # Get file stats
                    file_stats = baseline_path.stat()

                    # Verify we can read it back
                    with open(baseline_path, 'r') as f:
                        test_load = json.load(f)

                    logger.info(f"Created new baseline at {baseline_path} with {len(baseline_snapshot['files'])} files (size: {file_stats.st_size} bytes)")

                except (OSError, PermissionError, IOError) as e:
                    logger.error(f"Failed to write baseline file: {e}")
                    return CheckResult(
                        status=CheckStatus.ERROR,
                        score=0,
                        message=f"Failed to create baseline file: {e}",
                        details={
                            'error': str(e),
                            'baseline_path': str(baseline_path),
                            'baseline_dir_exists': baseline_path.parent.exists(),
                            'baseline_dir_writable': os.access(baseline_path.parent, os.W_OK),
                        },
                        duration=int((time.time() - start_time) * 1000),
                    )

                is_first_run = True

                return CheckResult(
                    status=CheckStatus.PASSED,
                    score=100,
                    message=f"Baseline created with {len(baseline_snapshot['files'])} files",
                    details={
                        'baseline_file': str(baseline_path),
                        'total_files': len(baseline_snapshot['files']),
                        'watch_paths': valid_paths,
                        'first_run': True,
                        'baseline_size_bytes': baseline_path.stat().st_size if baseline_path.exists() else 0,
                    },
                    duration=int((time.time() - start_time) * 1000),
                )

            # Compare snapshots
            changes = self._compare_snapshots(baseline_snapshot, current_snapshot)

            duration = int((time.time() - start_time) * 1000)

            # Analyze changes
            total_changes = len(changes['modified']) + len(changes['added']) + len(changes['deleted'])
            critical_files = []
            warning_files = []

            for change in changes['modified'] + changes['added']:
                file_path = change['path']
                if self._matches_patterns(file_path, critical_patterns):
                    critical_files.append(change)
                elif self._matches_patterns(file_path, warning_patterns):
                    warning_files.append(change)

            for file_path in changes['deleted']:
                if self._matches_patterns(file_path, critical_patterns):
                    critical_files.append({'path': file_path, 'change': 'deleted'})
                elif self._matches_patterns(file_path, warning_patterns):
                    warning_files.append({'path': file_path, 'change': 'deleted'})

            # Determine status
            if critical_files:
                status = CheckStatus.CRITICAL
                score = 20
                message = f"Critical files changed: {len(critical_files)} files"
            elif warning_files:
                status = CheckStatus.WARNING
                score = 60
                message = f"Warning files changed: {len(warning_files)} files"
            elif total_changes > 100:
                status = CheckStatus.WARNING
                score = 70
                message = f"Large number of changes detected: {total_changes} files"
            elif total_changes > 0:
                status = CheckStatus.WARNING
                score = 85
                message = f"{total_changes} file(s) changed"
            else:
                status = CheckStatus.PASSED
                score = 100
                message = "No file changes detected"

            # Auto-update baseline if configured
            if auto_update and total_changes > 0:
                with open(baseline_path, 'w') as f:
                    json.dump(current_snapshot, f, indent=2)
                    f.flush()
                logger.info(f"Auto-updated baseline at {baseline_path}")

            # Collect Git status if enabled
            git_status = None
            if include_git_status:
                git_status = self._collect_git_status(valid_paths, run_as_user, git_compare_to)

                # If git has uncommitted changes, factor into status
                if git_status and git_status.get('has_changes'):
                    git_total = git_status.get('summary', {}).get('total_changes', 0)
                    git_critical = git_status.get('critical_files', [])
                    git_warning = git_status.get('warning_files', [])

                    # Update message to include git changes
                    if git_total > 0:
                        if status == CheckStatus.PASSED:
                            status = CheckStatus.WARNING
                            score = 85
                            message = f"Git: {git_total} uncommitted change(s)"
                        else:
                            message = f"{message} | Git: {git_total} uncommitted"

                    # Critical git files override
                    if git_critical:
                        status = CheckStatus.CRITICAL
                        score = min(score, 20)
                        critical_files.extend(git_critical)

            # Build result details
            result_details = {
                'baseline_file': str(baseline_path),
                'watch_paths': valid_paths,
                'summary': {
                    'total_changes': total_changes,
                    'modified': len(changes['modified']),
                    'added': len(changes['added']),
                    'deleted': len(changes['deleted']),
                    'critical_count': len(critical_files),
                    'warning_count': len(warning_files),
                },
                'changes': {
                    'modified': changes['modified'][:50],  # Limit to first 50
                    'added': changes['added'][:50],
                    'deleted': changes['deleted'][:50],
                },
                'critical_files': critical_files,
                'warning_files': warning_files,
                'baseline_updated': auto_update and total_changes > 0,
                'checksum_algorithm': checksum_algo,
            }

            # Add git status if collected
            if git_status:
                result_details['git_status'] = git_status

            return CheckResult(
                status=status,
                score=score,
                message=message,
                details=result_details,
                duration=duration,
            )

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            logger.error(f"Filesystem integrity check failed: {e}", exc_info=True)
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Check failed: {str(e)}",
                duration=duration,
            )

    def _get_default_baseline_path(self, watch_paths: List[str]) -> str:
        """Generate a default baseline file path based on watch paths."""
        # Create a hash of the watch paths to generate unique baseline filename
        paths_hash = hashlib.md5('|'.join(sorted(watch_paths)).encode()).hexdigest()[:12]
        return os.path.join(self.DEFAULT_BASELINE_DIR, f"baseline_{paths_hash}.json")

    def _scan_directories(
        self,
        watch_paths: List[str],
        include_patterns: List[str],
        exclude_patterns: List[str],
        check_permissions: bool,
        check_ownership: bool,
        checksum_algo: str,
        max_file_size: int
    ) -> Dict[str, Any]:
        """Scan directories and create a snapshot of file metadata."""
        snapshot = {
            'timestamp': datetime.utcnow().isoformat(),
            'watch_paths': watch_paths,
            'files': {}
        }

        for watch_path in watch_paths:
            for root, dirs, files in os.walk(watch_path):
                # Filter directories
                dirs[:] = [d for d in dirs if not self._should_exclude(
                    os.path.join(root, d),
                    include_patterns,
                    exclude_patterns
                )]

                for filename in files:
                    file_path = os.path.join(root, filename)

                    # Check if should be included
                    if not self._should_include(file_path, include_patterns, exclude_patterns):
                        continue

                    try:
                        stat_info = os.stat(file_path)

                        file_info = {
                            'size': stat_info.st_size,
                            'mtime': stat_info.st_mtime,
                        }

                        if check_permissions:
                            file_info['mode'] = oct(stat_info.st_mode)

                        if check_ownership:
                            file_info['uid'] = stat_info.st_uid
                            file_info['gid'] = stat_info.st_gid

                        # Calculate checksum for files under size limit
                        if stat_info.st_size <= max_file_size:
                            file_info['checksum'] = self._calculate_checksum(file_path, checksum_algo)
                        else:
                            file_info['checksum'] = 'SKIPPED_TOO_LARGE'

                        # Use relative path as key
                        rel_path = os.path.relpath(file_path, watch_path)
                        snapshot['files'][file_path] = file_info

                    except (OSError, PermissionError) as e:
                        logger.debug(f"Could not scan file {file_path}: {e}")
                        continue

        return snapshot

    def _calculate_checksum(self, file_path: str, algorithm: str = 'sha256') -> str:
        """Calculate file checksum."""
        hash_func = getattr(hashlib, algorithm)()

        try:
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    hash_func.update(chunk)
            return hash_func.hexdigest()
        except (OSError, PermissionError) as e:
            logger.debug(f"Could not checksum file {file_path}: {e}")
            return 'ERROR'

    def _compare_snapshots(
        self,
        baseline: Dict[str, Any],
        current: Dict[str, Any]
    ) -> Dict[str, List[Any]]:
        """Compare two snapshots and return changes."""
        changes = {
            'modified': [],
            'added': [],
            'deleted': []
        }

        baseline_files = set(baseline['files'].keys())
        current_files = set(current['files'].keys())

        # Find deleted files
        deleted_files = baseline_files - current_files
        changes['deleted'] = list(deleted_files)

        # Find added files
        added_files = current_files - baseline_files
        for file_path in added_files:
            changes['added'].append({
                'path': file_path,
                'change': 'added',
                'size': current['files'][file_path].get('size', 0),
            })

        # Find modified files
        common_files = baseline_files & current_files
        for file_path in common_files:
            baseline_info = baseline['files'][file_path]
            current_info = current['files'][file_path]

            modifications = []

            # Check checksum
            if baseline_info.get('checksum') != current_info.get('checksum'):
                if current_info.get('checksum') not in ['SKIPPED_TOO_LARGE', 'ERROR']:
                    modifications.append('content')

            # Check size
            if baseline_info.get('size') != current_info.get('size'):
                modifications.append('size')

            # Check mtime
            if baseline_info.get('mtime') != current_info.get('mtime'):
                modifications.append('mtime')

            # Check permissions
            if baseline_info.get('mode') != current_info.get('mode'):
                modifications.append('permissions')

            # Check ownership
            if baseline_info.get('uid') != current_info.get('uid') or \
               baseline_info.get('gid') != current_info.get('gid'):
                modifications.append('ownership')

            if modifications:
                changes['modified'].append({
                    'path': file_path,
                    'change': 'modified',
                    'modifications': modifications,
                    'old_size': baseline_info.get('size', 0),
                    'new_size': current_info.get('size', 0),
                })

        return changes

    def _should_include(
        self,
        file_path: str,
        include_patterns: List[str],
        exclude_patterns: List[str]
    ) -> bool:
        """Check if file should be included based on patterns."""
        import fnmatch

        # Check exclude patterns first
        for pattern in exclude_patterns:
            if fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(os.path.basename(file_path), pattern):
                return False

        # If include patterns specified, file must match at least one
        if include_patterns:
            matched = False
            for pattern in include_patterns:
                if fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(os.path.basename(file_path), pattern):
                    matched = True
                    break
            return matched

        return True

    def _should_exclude(
        self,
        dir_path: str,
        include_patterns: List[str],
        exclude_patterns: List[str]
    ) -> bool:
        """Check if directory should be excluded."""
        import fnmatch

        dir_name = os.path.basename(dir_path)

        # Common directories to always exclude
        common_excludes = [
            'node_modules', '.git', '.svn', '__pycache__',
            'cache', 'tmp', 'temp', 'logs', '.cache'
        ]

        if dir_name in common_excludes:
            return True

        for pattern in exclude_patterns:
            if fnmatch.fnmatch(dir_path, pattern) or fnmatch.fnmatch(dir_name, pattern):
                return True

        return False

    def _matches_patterns(self, file_path: str, patterns: List[str]) -> bool:
        """Check if file matches any of the given patterns."""
        import fnmatch

        for pattern in patterns:
            if fnmatch.fnmatch(file_path, pattern):
                return True
            # Also check just the filename
            if fnmatch.fnmatch(os.path.basename(file_path), pattern):
                return True

        return False

    def _collect_git_status(
        self,
        watch_paths: List[str],
        run_as_user: str,
        compare_to: str
    ) -> Dict[str, Any]:
        """
        Collect Git status for repositories found in watch paths.

        Returns:
            Dictionary with git status information for all found repositories
        """
        git_info = {
            'repositories': [],
            'has_changes': False,
            'summary': {
                'total_changes': 0,
                'staged': 0,
                'unstaged': 0,
                'untracked': 0,
            },
            'files': [],
            'critical_files': [],
            'warning_files': [],
        }

        # Find git repositories in watch paths
        repos_found = []
        for watch_path in watch_paths:
            # Check if this path is a git repo
            git_dir = os.path.join(watch_path, '.git')
            if os.path.isdir(git_dir):
                repos_found.append(watch_path)
            else:
                # Check subdirectories (one level deep)
                try:
                    for item in os.listdir(watch_path):
                        item_path = os.path.join(watch_path, item)
                        if os.path.isdir(item_path):
                            sub_git_dir = os.path.join(item_path, '.git')
                            if os.path.isdir(sub_git_dir):
                                repos_found.append(item_path)
                except (OSError, PermissionError):
                    pass

        if not repos_found:
            git_info['message'] = 'No Git repositories found in watch paths'
            return git_info

        critical_patterns = self.config.get('critical_patterns', [])
        warning_patterns = self.config.get('warning_patterns', [])

        for repo_path in repos_found:
            repo_info = self._get_repo_status(repo_path, run_as_user, compare_to)
            if repo_info:
                git_info['repositories'].append(repo_info)

                # Aggregate changes
                if repo_info.get('files'):
                    git_info['has_changes'] = True
                    for file_info in repo_info['files']:
                        git_info['files'].append(file_info)
                        git_info['summary']['total_changes'] += 1

                        # Categorize
                        status = file_info.get('status', '')
                        if status in ['A', 'M', 'D', 'R', 'C']:
                            git_info['summary']['staged'] += 1
                        elif status in ['??']:
                            git_info['summary']['untracked'] += 1
                        else:
                            git_info['summary']['unstaged'] += 1

                        # Check critical/warning patterns
                        file_path = file_info.get('path', '')
                        if self._matches_patterns(file_path, critical_patterns):
                            git_info['critical_files'].append({
                                'path': file_path,
                                'status': status,
                                'repo': repo_path,
                                'change_type': 'git_' + self._git_status_to_change_type(status),
                            })
                        elif self._matches_patterns(file_path, warning_patterns):
                            git_info['warning_files'].append({
                                'path': file_path,
                                'status': status,
                                'repo': repo_path,
                                'change_type': 'git_' + self._git_status_to_change_type(status),
                            })

        return git_info

    def _get_repo_status(
        self,
        repo_path: str,
        run_as_user: str,
        compare_to: str
    ) -> Dict[str, Any]:
        """Get status for a single git repository."""
        repo_info = {
            'path': repo_path,
            'branch': None,
            'remote': None,
            'last_commit': None,
            'files': [],
            'comparison': compare_to,
        }

        try:
            # Get current branch
            branch_output = self._run_git_command(
                ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                repo_path,
                run_as_user
            )
            if branch_output:
                repo_info['branch'] = branch_output.strip()

            # Get remote URL
            remote_output = self._run_git_command(
                ['git', 'remote', 'get-url', 'origin'],
                repo_path,
                run_as_user
            )
            if remote_output:
                repo_info['remote'] = remote_output.strip()

            # Get last commit info
            commit_output = self._run_git_command(
                ['git', 'log', '-1', '--format=%H|%s|%an|%ai'],
                repo_path,
                run_as_user
            )
            if commit_output:
                parts = commit_output.strip().split('|')
                if len(parts) >= 4:
                    repo_info['last_commit'] = {
                        'hash': parts[0][:8],
                        'message': parts[1],
                        'author': parts[2],
                        'date': parts[3],
                    }

            # Get changed files based on comparison mode
            if compare_to == 'staged':
                # Show staged and unstaged changes
                status_output = self._run_git_command(
                    ['git', 'status', '--porcelain'],
                    repo_path,
                    run_as_user
                )
            elif compare_to == 'remote':
                # Compare with remote branch
                self._run_git_command(['git', 'fetch', '--quiet'], repo_path, run_as_user)
                remote_branch = f"origin/{repo_info['branch']}" if repo_info['branch'] else 'origin/main'
                status_output = self._run_git_command(
                    ['git', 'diff', '--name-status', remote_branch],
                    repo_path,
                    run_as_user
                )
            elif compare_to == 'last_commit':
                # Show changes since last commit
                status_output = self._run_git_command(
                    ['git', 'diff', '--name-status', 'HEAD~1'],
                    repo_path,
                    run_as_user
                )
            else:  # 'head' - default
                # Show all uncommitted changes (staged + unstaged + untracked)
                status_output = self._run_git_command(
                    ['git', 'status', '--porcelain'],
                    repo_path,
                    run_as_user
                )

            if status_output:
                for line in status_output.strip().split('\n'):
                    if line:
                        # Parse git status output
                        if compare_to in ['remote', 'last_commit']:
                            # Format: "M\tfilename" or "A\tfilename"
                            parts = line.split('\t')
                            if len(parts) >= 2:
                                status_code = parts[0]
                                file_path = parts[1]
                        else:
                            # Format: "XY filename" where X=staged, Y=unstaged
                            status_code = line[:2].strip()
                            file_path = line[3:].strip()

                        if file_path:
                            repo_info['files'].append({
                                'path': file_path,
                                'full_path': os.path.join(repo_path, file_path),
                                'status': status_code,
                                'status_label': self._git_status_label(status_code),
                            })

        except Exception as e:
            logger.warning(f"Error getting git status for {repo_path}: {e}")
            repo_info['error'] = str(e)

        return repo_info

    def _run_git_command(
        self,
        cmd: List[str],
        cwd: str,
        run_as_user: str
    ) -> str:
        """Run a git command, optionally as a different user."""
        try:
            if run_as_user:
                # Run as specified user using sudo
                full_cmd = ['sudo', '-u', run_as_user] + cmd
            else:
                full_cmd = cmd

            result = subprocess.run(
                full_cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                return result.stdout
            else:
                logger.debug(f"Git command failed: {result.stderr}")
                return ''

        except subprocess.TimeoutExpired:
            logger.warning(f"Git command timed out: {' '.join(cmd)}")
            return ''
        except Exception as e:
            logger.debug(f"Git command error: {e}")
            return ''

    def _git_status_label(self, status_code: str) -> str:
        """Convert git status code to human-readable label."""
        labels = {
            'M': 'modified',
            'A': 'added',
            'D': 'deleted',
            'R': 'renamed',
            'C': 'copied',
            'U': 'unmerged',
            '??': 'untracked',
            '!!': 'ignored',
            'MM': 'modified (staged & unstaged)',
            'AM': 'added & modified',
            ' M': 'modified (unstaged)',
            ' D': 'deleted (unstaged)',
        }
        return labels.get(status_code, status_code)

    def _git_status_to_change_type(self, status_code: str) -> str:
        """Convert git status code to change type for categorization."""
        if status_code in ['A', 'AM', '??']:
            return 'added'
        elif status_code in ['D', ' D']:
            return 'deleted'
        elif status_code in ['M', 'MM', ' M']:
            return 'modified'
        elif status_code in ['R']:
            return 'renamed'
        else:
            return 'changed'
