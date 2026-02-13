import axios from 'axios';
import { CheckExecutionResult } from '../../queue/queue-manager.js';
import { config } from '../../../config/index.js';
import { systemConfigService } from '../../config/index.js';

interface PageSpeedCheckConfig {
  strategy?: 'mobile' | 'desktop' | 'both';
  minScore?: number; // minimum acceptable performance score (0-100)
  categories?: ('performance' | 'accessibility' | 'best-practices' | 'seo')[];
}

interface LighthouseMetrics {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
  speedIndex: number;
  interactive: number;
}

interface StrategyResult {
  performanceScore: number;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  metrics: LighthouseMetrics;
}

interface PageSpeedDetails {
  // Combined scores (average of mobile and desktop when both are available)
  performanceScore: number;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  // Individual strategy results
  mobile: StrategyResult | null;
  desktop: StrategyResult | null;
  // Legacy metrics field for backward compatibility (uses primary strategy)
  metrics: LighthouseMetrics;
  strategy: string;
  fetchTime: string;
  url: string;
}

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Fetch PageSpeed data for a single strategy
 */
async function fetchPageSpeedData(
  url: string,
  strategy: 'mobile' | 'desktop',
  categories: string[],
  apiKey?: string
): Promise<StrategyResult | null> {
  const params = new URLSearchParams({
    url: url,
    strategy: strategy,
  });

  categories.forEach(category => {
    params.append('category', category);
  });

  if (apiKey) {
    params.append('key', apiKey);
  }

  const apiUrl = `${PAGESPEED_API_URL}?${params.toString()}`;

  const response = await axios.get(apiUrl, {
    timeout: systemConfigService.get<number>('pageSpeed.apiTimeoutMs'),
    headers: {
      'User-Agent': 'HexaScan-Monitor/1.0',
    },
  });

  const data = response.data;
  const lighthouseResult = data.lighthouseResult;

  if (!lighthouseResult) {
    return null;
  }

  const categoryScores = lighthouseResult.categories || {};
  const audits = lighthouseResult.audits || {};

  return {
    performanceScore: categoryScores.performance
      ? Math.round(categoryScores.performance.score * 100)
      : 0,
    accessibilityScore: categoryScores.accessibility
      ? Math.round(categoryScores.accessibility.score * 100)
      : null,
    bestPracticesScore: categoryScores['best-practices']
      ? Math.round(categoryScores['best-practices'].score * 100)
      : null,
    seoScore: categoryScores.seo
      ? Math.round(categoryScores.seo.score * 100)
      : null,
    metrics: {
      firstContentfulPaint: audits['first-contentful-paint']?.numericValue || 0,
      largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || 0,
      totalBlockingTime: audits['total-blocking-time']?.numericValue || 0,
      cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || 0,
      speedIndex: audits['speed-index']?.numericValue || 0,
      interactive: audits['interactive']?.numericValue || 0,
    },
  };
}

/**
 * Average two scores, handling nulls
 */
function averageScores(a: number | null, b: number | null): number | null {
  if (a !== null && b !== null) return Math.round((a + b) / 2);
  if (a !== null) return a;
  if (b !== null) return b;
  return null;
}

/**
 * PageSpeed Insights Check
 * Analyzes page performance using Google PageSpeed Insights API v5
 * Supports running both mobile and desktop strategies in a single check
 */
export async function pageSpeedCheck(
  check: any,
  site: any
): Promise<Omit<CheckExecutionResult, 'duration'>> {
  const checkConfig: PageSpeedCheckConfig = check.config || {};
  const strategy = checkConfig.strategy || systemConfigService.get<string>('pageSpeed.defaultStrategy');
  const minScore = checkConfig.minScore || systemConfigService.get<number>('pageSpeed.defaultMinScore');
  const categories = checkConfig.categories || ['performance'];
  const apiKey = config.externalApis.googlePageSpeedApiKey;

  try {
    let mobileResult: StrategyResult | null = null;
    let desktopResult: StrategyResult | null = null;

    // Fetch results based on strategy configuration
    if (strategy === 'both') {
      // Run both in parallel
      const [mobile, desktop] = await Promise.all([
        fetchPageSpeedData(site.url, 'mobile', categories, apiKey),
        fetchPageSpeedData(site.url, 'desktop', categories, apiKey),
      ]);
      mobileResult = mobile;
      desktopResult = desktop;
    } else if (strategy === 'mobile') {
      mobileResult = await fetchPageSpeedData(site.url, 'mobile', categories, apiKey);
    } else {
      desktopResult = await fetchPageSpeedData(site.url, 'desktop', categories, apiKey);
    }

    // Check if we got any results
    if (!mobileResult && !desktopResult) {
      return {
        checkId: check.id,
        status: 'ERROR',
        score: 0,
        message: 'Invalid response from PageSpeed API',
        details: { error: 'No lighthouse result in response' },
      };
    }

    // Calculate combined scores (average when both available)
    const performanceScore = averageScores(
      mobileResult?.performanceScore ?? null,
      desktopResult?.performanceScore ?? null
    ) ?? 0;
    const accessibilityScore = averageScores(
      mobileResult?.accessibilityScore ?? null,
      desktopResult?.accessibilityScore ?? null
    );
    const bestPracticesScore = averageScores(
      mobileResult?.bestPracticesScore ?? null,
      desktopResult?.bestPracticesScore ?? null
    );
    const seoScore = averageScores(
      mobileResult?.seoScore ?? null,
      desktopResult?.seoScore ?? null
    );

    // Use mobile metrics as primary (or desktop if mobile not available)
    const primaryMetrics = mobileResult?.metrics || desktopResult?.metrics || {
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      totalBlockingTime: 0,
      cumulativeLayoutShift: 0,
      speedIndex: 0,
      interactive: 0,
    };

    // Determine status based on combined performance score
    let status: 'PASSED' | 'WARNING' | 'CRITICAL';
    let message: string;

    if (performanceScore >= 90) {
      status = 'PASSED';
      message = `Excellent performance score: ${performanceScore}/100`;
    } else if (performanceScore >= minScore) {
      status = 'WARNING';
      message = `Performance needs improvement: ${performanceScore}/100`;
    } else {
      status = 'CRITICAL';
      message = `Poor performance score: ${performanceScore}/100`;
    }

    // Add strategy info to message
    if (strategy === 'both' && mobileResult && desktopResult) {
      message += ` (Mobile: ${mobileResult.performanceScore}, Desktop: ${desktopResult.performanceScore})`;
    }

    const details: PageSpeedDetails = {
      performanceScore,
      accessibilityScore,
      bestPracticesScore,
      seoScore,
      mobile: mobileResult,
      desktop: desktopResult,
      metrics: primaryMetrics,
      strategy,
      fetchTime: new Date().toISOString(),
      url: site.url,
    };

    return {
      checkId: check.id,
      status,
      score: performanceScore,
      message,
      details,
    };
  } catch (error) {
    let message = 'Failed to analyze page speed';
    let details: any = {};

    if (axios.isAxiosError(error)) {
      if (error.response) {
        const errorData = error.response.data;
        const apiErrorMessage = errorData?.error?.message || '';

        if (apiErrorMessage.includes('Quota exceeded') || error.response.status === 429) {
          message = 'PageSpeed API daily quota exceeded. Try again tomorrow or add an API key.';
          details = {
            statusCode: error.response.status,
            error: 'quota_exceeded',
            hint: 'Get a free API key from https://developers.google.com/speed/docs/insights/v5/get-started',
          };
        } else if (apiErrorMessage) {
          message = `PageSpeed API error: ${apiErrorMessage}`;
          details = {
            statusCode: error.response.status,
            error: apiErrorMessage,
          };
        } else if (error.response.status === 400) {
          message = 'Invalid URL or URL not accessible';
          details = { statusCode: 400, error: 'invalid_url' };
        } else if (error.response.status === 500) {
          message = 'PageSpeed API server error - try again later';
          details = { statusCode: 500, error: 'server_error' };
        } else {
          details = {
            statusCode: error.response.status,
            error: error.message,
          };
        }
      } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        message = 'PageSpeed analysis timed out';
        details = { error: 'Request timeout', code: error.code };
      } else {
        message = error.message;
        details = { error: error.message, code: error.code };
      }
    } else if (error instanceof Error) {
      message = error.message;
      details = { error: error.message };
    }

    return {
      checkId: check.id,
      status: 'ERROR',
      score: 0,
      message,
      details,
    };
  }
}
