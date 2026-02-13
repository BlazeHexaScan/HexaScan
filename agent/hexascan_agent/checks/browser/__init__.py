"""
Browser-based checks using Playwright.
Note: Playwright requires Python 3.7+ and is optional.
"""

__all__ = []

try:
    from .critical_flows_check import CriticalFlowsCheck
    __all__.append('CriticalFlowsCheck')
except (ImportError, SyntaxError, TypeError) as e:
    # Playwright not available or Python version too old
    # This is fine - browser checks are optional
    import logging
    logging.getLogger(__name__).debug(f"Browser checks not available: {e}")
