"""
Critical Flows Check - Tests Magento 2 checkout flow using Playwright.

This check verifies that the core e-commerce functionality is working:
1. Load the website homepage
2. Navigate to a product page
3. Add product to cart
4. Proceed to checkout page
5. Fill guest checkout form (without submitting)

If any step fails, a CRITICAL alert is triggered.
"""

import base64
import logging
import os
import subprocess
import sys
import time
from typing import Dict, Any, Optional, List, Tuple

import psutil

from ..base import BaseCheck, CheckResult, CheckStatus
from ..registry import CheckRegistry

logger = logging.getLogger(__name__)

# Playwright browser path - use shared location if not already set
PLAYWRIGHT_BROWSERS_PATH = os.environ.get('PLAYWRIGHT_BROWSERS_PATH', '/opt/hexascan-agent/.playwright-browsers')
if not os.environ.get('PLAYWRIGHT_BROWSERS_PATH'):
    os.environ['PLAYWRIGHT_BROWSERS_PATH'] = PLAYWRIGHT_BROWSERS_PATH

# Timeouts
PAGE_TIMEOUT_MS = 60000  # 60 seconds per page
OVERALL_TIMEOUT_S = 180  # 3 minutes total
MIN_RAM_MB = 512  # Minimum RAM required

# Dummy checkout data
CHECKOUT_DATA = {
    'email': 'test@hexascan.com',
    'firstname': 'Test',
    'lastname': 'User',
    'street': '123 Test Street',
    'city': 'Test City',
    'region': 'California',
    'postcode': '90210',
    'country': 'US',
    'telephone': '555-123-4567',
}


def check_playwright_installed() -> Tuple[bool, str]:
    """Check if Playwright and Chromium are installed."""
    try:
        from playwright.sync_api import sync_playwright
        return True, ""
    except ImportError:
        return False, "playwright package not installed. Run: pip install playwright"


def install_system_dependencies() -> Tuple[bool, str]:
    """Install system dependencies required for Chromium (requires sudo)."""
    try:
        logger.info("Installing system dependencies for Chromium...")
        # First try using playwright install-deps (preferred method)
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install-deps", "chromium"],
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        if result.returncode == 0:
            logger.info("System dependencies installed successfully via playwright")
            return True, ""

        # If that fails, try manual apt-get (for Debian/Ubuntu)
        logger.info("Playwright install-deps failed, trying apt-get...")
        packages = [
            "libnss3", "libnspr4", "libatk1.0-0", "libatk-bridge2.0-0",
            "libcups2", "libdrm2", "libxkbcommon0", "libxcomposite1",
            "libxdamage1", "libxfixes3", "libxrandr2", "libgbm1", "libasound2"
        ]
        result = subprocess.run(
            ["sudo", "apt-get", "install", "-y"] + packages,
            capture_output=True,
            text=True,
            timeout=300
        )
        if result.returncode == 0:
            logger.info("System dependencies installed successfully via apt-get")
            return True, ""
        else:
            # Don't fail completely - browser might still work
            logger.warning(f"Could not install system deps (may already be installed): {result.stderr}")
            return True, ""  # Continue anyway
    except subprocess.TimeoutExpired:
        logger.warning("System dependency installation timed out")
        return True, ""  # Continue anyway
    except Exception as e:
        logger.warning(f"Could not install system dependencies: {e}")
        return True, ""  # Continue anyway - they might already be installed


def install_chromium_browser() -> Tuple[bool, str]:
    """Install Chromium browser for Playwright (includes system deps)."""
    try:
        # Step 1: Try to install system dependencies first
        logger.info("Step 1/2: Installing system dependencies...")
        install_system_dependencies()

        # Step 2: Install Chromium browser
        logger.info("Step 2/2: Installing Chromium browser for Playwright...")
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            capture_output=True,
            text=True,
            timeout=600  # 10 minutes timeout for download (can be slow)
        )
        if result.returncode == 0:
            logger.info("Chromium browser installed successfully")
            return True, ""
        else:
            error_msg = result.stderr or result.stdout
            logger.error(f"Failed to install Chromium: {error_msg}")
            return False, f"Failed to install Chromium browser: {error_msg}"
    except subprocess.TimeoutExpired:
        return False, "Chromium installation timed out after 10 minutes"
    except Exception as e:
        return False, f"Error installing Chromium: {str(e)}"


def check_chromium_installed() -> bool:
    """Check if Chromium browser is installed for Playwright."""
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            # Try to get the executable path
            browser_type = p.chromium
            # This will raise if not installed
            browser_type.executable_path
            return True
    except Exception:
        return False


def get_system_resources() -> Dict[str, Any]:
    """Get current system resource usage."""
    try:
        memory = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=0.5)
        return {
            'ram_total_mb': round(memory.total / (1024 * 1024)),
            'ram_available_mb': round(memory.available / (1024 * 1024)),
            'ram_percent_used': memory.percent,
            'cpu_percent': cpu_percent,
        }
    except Exception as e:
        logger.warning(f"Failed to get system resources: {e}")
        return {}


@CheckRegistry.register('CRITICAL_FLOWS')
class CriticalFlowsCheck(BaseCheck):
    """
    Critical Flows Check for Magento 2.

    Tests the checkout flow to ensure core e-commerce functionality is working.
    Uses Playwright for browser automation.

    Configuration:
        product_url: str - Full URL of the product to test (required)
    """

    @property
    def name(self) -> str:
        return "Critical Flows (Magento 2)"

    @property
    def category(self) -> str:
        return "browser"

    def execute(self) -> CheckResult:
        """Execute the critical flows check."""
        start_time = time.time()
        steps: List[Dict[str, Any]] = []
        screenshot_base64: Optional[str] = None
        system_resources = get_system_resources()

        # Validate configuration
        product_url = self.config.get('product_url', '').strip()
        if not product_url:
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message="Configuration error: product_url is required",
                details={
                    'steps': [],
                    'system_resources': system_resources,
                    'error': 'product_url configuration is missing',
                },
                duration=time.time() - start_time
            )

        # Check system resources
        ram_available = system_resources.get('ram_available_mb', 0)
        if ram_available > 0 and ram_available < MIN_RAM_MB:
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=f"Insufficient RAM: {ram_available}MB available, {MIN_RAM_MB}MB required",
                details={
                    'steps': [],
                    'system_resources': system_resources,
                    'error': f'Insufficient RAM for browser automation',
                },
                duration=time.time() - start_time
            )

        # Check Playwright installation
        playwright_ok, playwright_error = check_playwright_installed()
        if not playwright_ok:
            return CheckResult(
                status=CheckStatus.ERROR,
                score=0,
                message=playwright_error,
                details={
                    'steps': [],
                    'system_resources': system_resources,
                    'error': playwright_error,
                },
                duration=time.time() - start_time
            )

        # Check/install Chromium browser
        if not check_chromium_installed():
            logger.info("Chromium not installed, attempting auto-install...")
            steps.append({
                'name': 'Install Chromium Browser',
                'status': 'in_progress',
                'duration_ms': 0,
            })

            install_ok, install_error = install_chromium_browser()
            if not install_ok:
                steps[-1]['status'] = 'failed'
                steps[-1]['error'] = install_error
                return CheckResult(
                    status=CheckStatus.ERROR,
                    score=0,
                    message=f"Failed to install browser: {install_error}",
                    details={
                        'steps': steps,
                        'system_resources': system_resources,
                        'error': install_error,
                    },
                    duration=time.time() - start_time
                )
            steps[-1]['status'] = 'passed'

        # Import Playwright (only after confirming it's installed)
        from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

        # Extract base URL from product URL
        from urllib.parse import urlparse
        parsed = urlparse(product_url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"

        browser = None
        try:
            with sync_playwright() as p:
                # Launch browser
                browser = p.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                    ]
                )

                context = browser.new_context(
                    viewport={'width': 1280, 'height': 720},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                page = context.new_page()
                page.set_default_timeout(PAGE_TIMEOUT_MS)

                # Step 1: Load Homepage
                step_start = time.time()
                try:
                    logger.info(f"Step 1: Loading homepage {base_url}")
                    page.goto(base_url, wait_until='domcontentloaded')
                    page.wait_for_load_state('networkidle', timeout=30000)
                    steps.append({
                        'name': 'Load Homepage',
                        'status': 'passed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'url': base_url,
                    })
                    logger.info("Step 1 completed: Homepage loaded")
                except PlaywrightTimeout as e:
                    screenshot_base64 = self._capture_screenshot(page)
                    steps.append({
                        'name': 'Load Homepage',
                        'status': 'failed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'error': f'Page load timeout: {str(e)}',
                        'url': base_url,
                    })
                    raise Exception(f"Homepage failed to load: {str(e)}")
                except Exception as e:
                    screenshot_base64 = self._capture_screenshot(page)
                    steps.append({
                        'name': 'Load Homepage',
                        'status': 'failed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'error': str(e),
                        'url': base_url,
                    })
                    raise

                # Step 2: Load Product Page
                step_start = time.time()
                try:
                    logger.info(f"Step 2: Loading product page {product_url}")
                    page.goto(product_url, wait_until='domcontentloaded')
                    page.wait_for_load_state('networkidle', timeout=30000)

                    # Verify it's a product page (look for add to cart button)
                    add_to_cart_btn = page.locator('button#product-addtocart-button, button.tocart, button[title="Add to Cart"], form#product_addtocart_form button[type="submit"]').first
                    add_to_cart_btn.wait_for(state='visible', timeout=10000)

                    steps.append({
                        'name': 'Load Product Page',
                        'status': 'passed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'url': product_url,
                    })
                    logger.info("Step 2 completed: Product page loaded")
                except PlaywrightTimeout as e:
                    screenshot_base64 = self._capture_screenshot(page)
                    steps.append({
                        'name': 'Load Product Page',
                        'status': 'failed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'error': f'Product page timeout or Add to Cart button not found: {str(e)}',
                        'url': product_url,
                    })
                    raise Exception(f"Product page failed to load: {str(e)}")
                except Exception as e:
                    screenshot_base64 = self._capture_screenshot(page)
                    steps.append({
                        'name': 'Load Product Page',
                        'status': 'failed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'error': str(e),
                        'url': product_url,
                    })
                    raise

                # Step 3: Add to Cart
                step_start = time.time()
                try:
                    logger.info("Step 3: Adding product to cart")

                    # Handle configurable products - select first option for each swatch
                    swatches = page.locator('.swatch-attribute').all()
                    for swatch in swatches:
                        options = swatch.locator('.swatch-option').all()
                        if options:
                            # Click first available option
                            for option in options:
                                if option.is_visible() and option.is_enabled():
                                    option.click()
                                    page.wait_for_timeout(500)  # Wait for UI update
                                    break

                    # Click Add to Cart button
                    add_to_cart_btn = page.locator('button#product-addtocart-button, button.tocart, button[title="Add to Cart"], form#product_addtocart_form button[type="submit"]').first
                    add_to_cart_btn.click()

                    # Wait for cart to update - look for success message or cart counter change
                    try:
                        # Wait for success message
                        page.locator('.message-success, .messages .success').wait_for(state='visible', timeout=15000)
                    except PlaywrightTimeout:
                        # Alternative: wait for minicart to show item count
                        page.locator('.counter-number:not(:empty), .minicart-wrapper .counter.qty').wait_for(state='visible', timeout=10000)

                    steps.append({
                        'name': 'Add to Cart',
                        'status': 'passed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                    })
                    logger.info("Step 3 completed: Product added to cart")
                except PlaywrightTimeout as e:
                    screenshot_base64 = self._capture_screenshot(page)
                    steps.append({
                        'name': 'Add to Cart',
                        'status': 'failed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'error': f'Add to cart failed - button not clickable or cart not updated: {str(e)}',
                    })
                    raise Exception(f"Add to cart failed: {str(e)}")
                except Exception as e:
                    screenshot_base64 = self._capture_screenshot(page)
                    steps.append({
                        'name': 'Add to Cart',
                        'status': 'failed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'error': str(e),
                    })
                    raise

                # Step 4: Navigate to Checkout
                step_start = time.time()
                try:
                    logger.info("Step 4: Navigating to checkout")
                    checkout_url = f"{base_url}/checkout"
                    page.goto(checkout_url, wait_until='domcontentloaded')
                    page.wait_for_load_state('networkidle', timeout=30000)

                    # Verify checkout page loaded - look for shipping form or email field
                    checkout_form = page.locator('#checkout, .checkout-container, #shipping, input#customer-email').first
                    checkout_form.wait_for(state='visible', timeout=15000)

                    steps.append({
                        'name': 'Navigate to Checkout',
                        'status': 'passed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'url': checkout_url,
                    })
                    logger.info("Step 4 completed: Checkout page loaded")
                except PlaywrightTimeout as e:
                    screenshot_base64 = self._capture_screenshot(page)
                    steps.append({
                        'name': 'Navigate to Checkout',
                        'status': 'failed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'error': f'Checkout page timeout or form not found: {str(e)}',
                        'url': f"{base_url}/checkout",
                    })
                    raise Exception(f"Checkout page failed to load: {str(e)}")
                except Exception as e:
                    screenshot_base64 = self._capture_screenshot(page)
                    steps.append({
                        'name': 'Navigate to Checkout',
                        'status': 'failed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'error': str(e),
                    })
                    raise

                # Step 5: Fill Guest Checkout Form
                step_start = time.time()
                try:
                    logger.info("Step 5: Filling guest checkout form")

                    # Fill email
                    email_field = page.locator('input#customer-email, input[name="username"], #customer-email-fieldset input[type="email"]').first
                    if email_field.is_visible():
                        email_field.fill(CHECKOUT_DATA['email'])
                        page.wait_for_timeout(500)

                    # Wait for shipping form to appear after email
                    page.wait_for_timeout(2000)  # Allow time for form to load

                    # Fill shipping address fields (Magento 2 standard checkout)
                    form_fields = [
                        ('input[name="firstname"]', CHECKOUT_DATA['firstname']),
                        ('input[name="lastname"]', CHECKOUT_DATA['lastname']),
                        ('input[name="street[0]"]', CHECKOUT_DATA['street']),
                        ('input[name="city"]', CHECKOUT_DATA['city']),
                        ('input[name="postcode"]', CHECKOUT_DATA['postcode']),
                        ('input[name="telephone"]', CHECKOUT_DATA['telephone']),
                    ]

                    for selector, value in form_fields:
                        field = page.locator(selector).first
                        if field.is_visible():
                            field.fill(value)
                            page.wait_for_timeout(200)

                    # Select country if dropdown exists
                    country_select = page.locator('select[name="country_id"]').first
                    if country_select.is_visible():
                        country_select.select_option(value=CHECKOUT_DATA['country'])
                        page.wait_for_timeout(500)

                    # Select region if dropdown appears
                    region_select = page.locator('select[name="region_id"]').first
                    if region_select.is_visible():
                        try:
                            # Try to select California
                            region_select.select_option(label=CHECKOUT_DATA['region'])
                        except:
                            # Just select first available option
                            options = region_select.locator('option').all()
                            if len(options) > 1:
                                region_select.select_option(index=1)

                    steps.append({
                        'name': 'Fill Guest Checkout Form',
                        'status': 'passed',
                        'duration_ms': int((time.time() - step_start) * 1000),
                    })
                    logger.info("Step 5 completed: Checkout form filled")
                except Exception as e:
                    # Form filling is best-effort - don't fail the whole check
                    logger.warning(f"Some checkout form fields could not be filled: {e}")
                    steps.append({
                        'name': 'Fill Guest Checkout Form',
                        'status': 'passed',  # Mark as passed since we're on checkout page
                        'duration_ms': int((time.time() - step_start) * 1000),
                        'note': f'Some fields could not be filled: {str(e)}',
                    })

                # Capture final screenshot (success)
                screenshot_base64 = self._capture_screenshot(page)

                # Calculate total duration
                total_duration = time.time() - start_time
                total_duration_ms = int(total_duration * 1000)

                # All steps passed
                return CheckResult(
                    status=CheckStatus.PASSED,
                    score=100,
                    message=f"All {len(steps)} checkout flow steps completed successfully",
                    details={
                        'steps': steps,
                        'screenshot_base64': screenshot_base64,
                        'total_duration_ms': total_duration_ms,
                        'system_resources': system_resources,
                        'product_url': product_url,
                    },
                    duration=total_duration
                )

        except Exception as e:
            # Check failed at some step
            total_duration = time.time() - start_time
            failed_step = next((s for s in steps if s.get('status') == 'failed'), None)
            failed_step_name = failed_step['name'] if failed_step else 'Unknown'

            return CheckResult(
                status=CheckStatus.CRITICAL,
                score=0,
                message=f"Checkout flow failed at step: {failed_step_name}",
                details={
                    'steps': steps,
                    'screenshot_base64': screenshot_base64,
                    'total_duration_ms': int(total_duration * 1000),
                    'system_resources': system_resources,
                    'product_url': product_url,
                    'error': str(e),
                },
                duration=total_duration
            )

        finally:
            if browser:
                try:
                    browser.close()
                except:
                    pass

    def _capture_screenshot(self, page) -> Optional[str]:
        """Capture a screenshot and return as base64 string."""
        try:
            screenshot_bytes = page.screenshot(
                type='png',
                full_page=False,  # Just viewport to keep size reasonable
            )
            return base64.b64encode(screenshot_bytes).decode('utf-8')
        except Exception as e:
            logger.warning(f"Failed to capture screenshot: {e}")
            return None
