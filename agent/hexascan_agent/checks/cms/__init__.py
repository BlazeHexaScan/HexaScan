"""
CMS-specific health checks.
"""

from .magento_health_check import MagentoHealthCheck
from .wordpress_health_check import WordPressHealthCheck

__all__ = ['MagentoHealthCheck', 'WordPressHealthCheck']
