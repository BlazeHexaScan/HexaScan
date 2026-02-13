import { chromium, Browser, Page } from 'playwright';
import { expect } from '@playwright/test';
import { Check, Site } from '@prisma/client';
import { systemConfigService } from '../../config/index.js';

interface PlaywrightCheckConfig {
  script: string; // The Playwright test code
}

interface PlaywrightCheckResult {
  checkId: string;
  status: 'PASSED' | 'WARNING' | 'CRITICAL' | 'ERROR' | 'PENDING';
  score: number;
  message: string;
  details: {
    success: boolean;
    duration: number;
    screenshot?: string; // Base64 encoded
    error?: string;
    errorStack?: string;
    scriptExecuted: boolean;
    // Additional metadata
    pagesVisited: number;
    urlsVisited: string[];
    browser: string;
    viewport: string;
    consoleErrors: string[];
  };
}

/**
 * Execute a Playwright Critical Flows check
 * Runs user-provided Playwright script and captures results
 */
export async function playwrightCriticalFlowsCheck(
  check: Check,
  site: Site
): Promise<PlaywrightCheckResult> {
  const config = check.config as unknown as PlaywrightCheckConfig;
  const startTime = Date.now();

  let browser: Browser | null = null;
  let page: Page | null = null;
  let screenshotBase64: string | undefined;

  // Track metadata
  const urlsVisited: string[] = [];
  const consoleErrors: string[] = [];
  const viewportSize = {
    width: systemConfigService.get<number>('playwright.viewportWidth'),
    height: systemConfigService.get<number>('playwright.viewportHeight'),
  };
  const browserInfo = 'Chromium (Headless)';

  // Validate script is provided
  if (!config.script || typeof config.script !== 'string' || config.script.trim() === '') {
    return {
      checkId: check.id,
      status: 'ERROR',
      score: 0,
      message: 'No Playwright script provided',
      details: {
        success: false,
        duration: Date.now() - startTime,
        error: 'Script is required. Please provide a valid Playwright test script.',
        scriptExecuted: false,
        pagesVisited: 0,
        urlsVisited: [],
        browser: browserInfo,
        viewport: `${viewportSize.width}×${viewportSize.height}`,
        consoleErrors: [],
      },
    };
  }

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
    });

    // Create context with Full HD viewport
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    page = await context.newPage();

    // Track page navigations
    page.on('framenavigated', (frame) => {
      if (frame === page!.mainFrame()) {
        const url = frame.url();
        if (url && !url.startsWith('about:') && !urlsVisited.includes(url)) {
          urlsVisited.push(url);
        }
      }
    });

    // Track console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Track uncaught exceptions
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Extract and execute the user's script
    // We need to parse the script and execute the actions
    const result = await executePlaywrightScript(page, config.script, site.url);

    // Wait for page to be fully loaded before taking screenshot
    try {
      // Wait for network to be idle (no requests for 500ms)
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      // If networkidle times out, at least wait for DOM to be ready
      await page.waitForLoadState('domcontentloaded');
    }

    // Take final screenshot
    screenshotBase64 = await captureScreenshot(page);

    const duration = Date.now() - startTime;

    if (result.success) {
      return {
        checkId: check.id,
        status: 'PASSED',
        score: 100,
        message: 'Playwright test passed successfully',
        details: {
          success: true,
          duration,
          screenshot: screenshotBase64,
          scriptExecuted: true,
          pagesVisited: urlsVisited.length,
          urlsVisited,
          browser: browserInfo,
          viewport: `${viewportSize.width}×${viewportSize.height}`,
          consoleErrors,
        },
      };
    } else {
      return {
        checkId: check.id,
        status: 'CRITICAL',
        score: 0,
        message: result.error || 'Playwright test failed',
        details: {
          success: false,
          duration,
          screenshot: screenshotBase64,
          error: result.error,
          errorStack: result.errorStack,
          scriptExecuted: true,
          pagesVisited: urlsVisited.length,
          urlsVisited,
          browser: browserInfo,
          viewport: `${viewportSize.width}×${viewportSize.height}`,
          consoleErrors,
        },
      };
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Try to capture screenshot on error
    if (page) {
      try {
        screenshotBase64 = await captureScreenshot(page);
      } catch {
        // Ignore screenshot errors
      }
    }

    return {
      checkId: check.id,
      status: 'ERROR',
      score: 0,
      message: `Playwright execution error: ${error.message}`,
      details: {
        success: false,
        duration,
        screenshot: screenshotBase64,
        error: error.message,
        errorStack: error.stack,
        scriptExecuted: false,
        pagesVisited: urlsVisited.length,
        urlsVisited,
        browser: browserInfo,
        viewport: `${viewportSize.width}×${viewportSize.height}`,
        consoleErrors,
      },
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Capture screenshot and return as base64
 */
async function captureScreenshot(page: Page): Promise<string> {
  const buffer = await page.screenshot({
    type: 'png',
    fullPage: false, // Just the viewport
  });
  return buffer.toString('base64');
}

/**
 * Execute the user's Playwright script
 * This extracts the test body and runs it with the provided page
 */
async function executePlaywrightScript(
  page: Page,
  script: string,
  _siteUrl: string
): Promise<{ success: boolean; error?: string; errorStack?: string }> {
  try {
    // Transform the script to extract executable code
    const transformedScript = transformScript(script);

    // Block dangerous patterns that could escape the Playwright context
    const dangerousPatterns = [
      /\bprocess\b/,
      /\brequire\s*\(/,
      /\bimport\s*\(/,
      /\bglobal\b/,
      /\b__dirname\b/,
      /\b__filename\b/,
      /\bchild_process\b/,
      /\bexecSync\b/,
      /\bexecFile\b/,
      /\bspawnSync\b/,
      /\beval\s*\(/,
      /\bFunction\s*\(/,
      /\bconstructor\s*\[/,
      /\bconstructor\s*\.\s*constructor/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(transformedScript)) {
        return {
          success: false,
          error: `Script contains blocked pattern: ${pattern.source}`,
        };
      }
    }

    // Create an async function from the transformed script
    // The function only receives page and expect - no access to Node.js globals
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

    // Create the test function with page and expect as the only available parameters
    // Explicitly shadow dangerous globals to prevent access
    const testFunction = new AsyncFunction(
      'page', 'expect',
      // Shadow Node.js globals to prevent escape
      `"use strict";
      const process = undefined;
      const require = undefined;
      const global = undefined;
      const globalThis = undefined;
      const __dirname = undefined;
      const __filename = undefined;
      const Buffer = undefined;
      ${transformedScript}`
    );

    // Execute with a timeout to prevent infinite loops
    const timeoutMs = 180000; // 3 minutes
    await Promise.race([
      testFunction(page, expect),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Script execution timed out after 3 minutes')), timeoutMs)
      ),
    ]);

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      errorStack: error.stack,
    };
  }
}

/**
 * Transform user script to extract executable code
 * Removes imports and test() wrapper, leaving just the actions
 */
function transformScript(script: string): string {
  let transformed = script;

  // Remove import statements
  transformed = transformed.replace(/import\s+{[^}]+}\s+from\s+['"][^'"]+['"];?\s*/g, '');
  transformed = transformed.replace(/import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]+['"];?\s*/g, '');
  transformed = transformed.replace(/import\s+\w+\s+from\s+['"][^'"]+['"];?\s*/g, '');

  // Extract content from test() wrapper
  // Match: test('name', async ({ page }) => { ... });
  // or: test("name", async ({ page }) => { ... });
  const testMatch = transformed.match(
    /test\s*\(\s*['"][^'"]*['"]\s*,\s*async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{([\s\S]*)\}\s*\)\s*;?\s*$/
  );

  if (testMatch && testMatch[1]) {
    transformed = testMatch[1].trim();
  }

  // Also try to match test.only, test.skip patterns
  const testOnlyMatch = transformed.match(
    /test\.(only|skip)\s*\(\s*['"][^'"]*['"]\s*,\s*async\s*\(\s*\{\s*page\s*\}\s*\)\s*=>\s*\{([\s\S]*)\}\s*\)\s*;?\s*$/
  );

  if (testOnlyMatch && testOnlyMatch[2]) {
    transformed = testOnlyMatch[2].trim();
  }

  return transformed;
}
