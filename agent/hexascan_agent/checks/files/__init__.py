"""
File monitoring checks.

Includes filesystem integrity monitoring with optional Git status integration.
"""

from .filesystem_integrity_check import FilesystemIntegrityCheck

__all__ = [
    'FilesystemIntegrityCheck',
]
