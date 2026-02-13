import axios from 'axios';
import https from 'https';
import { TLSSocket } from 'tls';
import { URL } from 'url';
import { CheckExecutionResult } from '../../queue/queue-manager.js';
import { systemConfigService } from '../../config/index.js';

/**
 * Combined Web Monitoring Check
 * Performs uptime, response time, and SSL certificate checks in a single execution
 * Thresholds are admin-configurable via SystemConfig
 */
export async function webMonitoringCheck(
  check: any,
  site: any
): Promise<Omit<CheckExecutionResult, 'duration'>> {
  // Read thresholds from system config (admin-editable)
  const TIMEOUT_MS = systemConfigService.get<number>('webMonitoring.requestTimeoutMs');
  const RESPONSE_TIME_WARNING_MS = systemConfigService.get<number>('webMonitoring.responseTimeWarningMs');
  const RESPONSE_TIME_CRITICAL_MS = systemConfigService.get<number>('webMonitoring.responseTimeCriticalMs');
  const SSL_WARNING_DAYS = systemConfigService.get<number>('webMonitoring.sslWarningDays');
  const SSL_CRITICAL_DAYS = systemConfigService.get<number>('webMonitoring.sslCriticalDays');

  const results: {
    uptime: UptimeResult | null;
    responseTime: ResponseTimeResult | null;
    ssl: SSLResult | null;
  } = {
    uptime: null,
    responseTime: null,
    ssl: null,
  };

  let overallStatus: 'PASSED' | 'WARNING' | 'CRITICAL' | 'ERROR' = 'PASSED';
  const issues: string[] = [];

  try {
    // 1. Uptime + Response Time Check (single request)
    const startTime = Date.now();
    let httpResponse: any = null;
    let httpError: any = null;

    try {
      httpResponse = await axios.get(site.url, {
        timeout: TIMEOUT_MS,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'HexaScan-Monitor/1.0',
        },
      });
    } catch (error) {
      httpError = error;
    }

    const responseTime = Date.now() - startTime;

    // Process uptime result
    if (httpError) {
      results.uptime = {
        isUp: false,
        statusCode: null,
        error: getHttpErrorMessage(httpError),
      };
      overallStatus = 'CRITICAL';
      issues.push('Site is down');
    } else {
      const expectedStatusCodes = [200, 201, 202, 203, 204, 301, 302, 303, 307, 308];
      const isExpectedStatus = expectedStatusCodes.includes(httpResponse.status);

      results.uptime = {
        isUp: isExpectedStatus,
        statusCode: httpResponse.status,
        statusText: httpResponse.statusText,
      };

      if (!isExpectedStatus) {
        overallStatus = 'CRITICAL';
        issues.push(`Unexpected status code: ${httpResponse.status}`);
      }
    }

    // Process response time result
    results.responseTime = {
      value: responseTime,
      unit: 'ms',
    };

    if (httpResponse && results.uptime?.isUp) {
      if (responseTime >= RESPONSE_TIME_CRITICAL_MS) {
        if (overallStatus !== 'CRITICAL') overallStatus = 'CRITICAL';
        issues.push(`Response time critically slow: ${responseTime}ms`);
      } else if (responseTime >= RESPONSE_TIME_WARNING_MS) {
        if (overallStatus === 'PASSED') overallStatus = 'WARNING';
        issues.push(`Response time slow: ${responseTime}ms`);
      }
    }

    // 2. SSL Certificate Check (only for HTTPS sites)
    const url = new URL(site.url);

    if (url.protocol === 'https:') {
      try {
        const certificate = await getSSLCertificate(url.hostname, parseInt(url.port || '443'));

        if (certificate) {
          const now = new Date();
          const validFrom = new Date(certificate.valid_from);
          const validTo = new Date(certificate.valid_to);
          const daysUntilExpiration = Math.floor(
            (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          results.ssl = {
            valid: now >= validFrom && now <= validTo,
            issuer: certificate.issuer?.O || certificate.issuer?.CN || 'Unknown',
            subject: certificate.subject?.CN || url.hostname,
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
            daysUntilExpiration,
          };

          if (now < validFrom) {
            overallStatus = 'CRITICAL';
            issues.push('SSL certificate not yet valid');
          } else if (now > validTo) {
            overallStatus = 'CRITICAL';
            issues.push('SSL certificate has expired');
          } else if (daysUntilExpiration <= SSL_CRITICAL_DAYS) {
            if (overallStatus !== 'CRITICAL') overallStatus = 'CRITICAL';
            issues.push(`SSL certificate expires in ${daysUntilExpiration} days`);
          } else if (daysUntilExpiration <= SSL_WARNING_DAYS) {
            if (overallStatus === 'PASSED') overallStatus = 'WARNING';
            issues.push(`SSL certificate expires in ${daysUntilExpiration} days`);
          }
        } else {
          results.ssl = {
            valid: false,
            error: 'Could not retrieve certificate',
          };
          if (overallStatus === 'PASSED') overallStatus = 'WARNING';
          issues.push('Could not verify SSL certificate');
        }
      } catch (sslError) {
        results.ssl = {
          valid: false,
          error: sslError instanceof Error ? sslError.message : 'SSL check failed',
        };
        if (overallStatus === 'PASSED') overallStatus = 'WARNING';
        issues.push('SSL certificate check failed');
      }
    } else {
      results.ssl = {
        valid: false,
        error: 'Site does not use HTTPS',
      };
      if (overallStatus === 'PASSED') overallStatus = 'WARNING';
      issues.push('Site does not use HTTPS');
    }

    // Calculate overall score
    const score = calculateOverallScore(results, overallStatus);

    // Build message
    let message: string;
    if (issues.length === 0) {
      message = `All checks passed (${responseTime}ms response time)`;
    } else if (issues.length === 1) {
      message = issues[0];
    } else {
      message = `${issues.length} issues found`;
    }

    return {
      checkId: check.id,
      status: overallStatus,
      score,
      message,
      details: {
        uptime: results.uptime,
        responseTime: results.responseTime,
        ssl: results.ssl,
        issues,
        thresholds: {
          responseTimeWarningMs: RESPONSE_TIME_WARNING_MS,
          responseTimeCriticalMs: RESPONSE_TIME_CRITICAL_MS,
          sslWarningDays: SSL_WARNING_DAYS,
          sslCriticalDays: SSL_CRITICAL_DAYS,
        },
      },
    };
  } catch (error) {
    return {
      checkId: check.id,
      status: 'ERROR',
      score: 0,
      message: error instanceof Error ? error.message : 'Web monitoring check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        uptime: results.uptime,
        responseTime: results.responseTime,
        ssl: results.ssl,
      },
    };
  }
}

// Types for internal results
interface UptimeResult {
  isUp: boolean;
  statusCode: number | null;
  statusText?: string;
  error?: string;
}

interface ResponseTimeResult {
  value: number;
  unit: string;
}

interface SSLResult {
  valid: boolean;
  issuer?: string;
  subject?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiration?: number;
  error?: string;
}

/**
 * Get human-readable error message from axios error
 */
function getHttpErrorMessage(error: any): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNREFUSED') return 'Connection refused';
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') return 'Request timed out';
    if (error.code === 'ENOTFOUND') return 'DNS lookup failed';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Calculate overall score based on individual check results
 */
function calculateOverallScore(
  results: { uptime: UptimeResult | null; responseTime: ResponseTimeResult | null; ssl: SSLResult | null },
  status: 'PASSED' | 'WARNING' | 'CRITICAL' | 'ERROR'
): number {
  if (status === 'ERROR') return 0;
  if (status === 'CRITICAL') return 30;
  if (status === 'WARNING') return 70;

  // All passed - calculate based on response time
  const responseTime = results.responseTime?.value || 0;
  if (responseTime < 500) return 100;
  if (responseTime < 1000) return 95;
  if (responseTime < 1500) return 90;
  if (responseTime < 2000) return 85;
  return 80;
}

/**
 * Get SSL certificate from a hostname
 */
function getSSLCertificate(hostname: string, port: number = 443): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port,
      method: 'HEAD',
      servername: hostname,
      rejectUnauthorized: false,
      timeout: 30000,
    };

    let certificateResolved = false;

    const req = https.request(options, (res) => {
      const socket = res.socket as TLSSocket;
      const certificate = socket.getPeerCertificate(true);

      if (!certificateResolved) {
        if (certificate && Object.keys(certificate).length > 0) {
          certificateResolved = true;
          resolve(certificate);
        } else {
          certificateResolved = true;
          reject(new Error('No certificate found'));
        }
      }

      req.destroy();
    });

    req.on('socket', (socket) => {
      const tlsSocket = socket as TLSSocket;

      tlsSocket.on('secureConnect', () => {
        if (!certificateResolved) {
          const certificate = tlsSocket.getPeerCertificate(true);
          if (certificate && Object.keys(certificate).length > 0) {
            certificateResolved = true;
            resolve(certificate);
            req.destroy();
          }
        }
      });
    });

    req.on('error', (error) => {
      if (!certificateResolved) {
        certificateResolved = true;
        reject(error);
      }
    });

    req.on('timeout', () => {
      if (!certificateResolved) {
        certificateResolved = true;
        req.destroy();
        reject(new Error('Request timed out'));
      }
    });

    req.setTimeout(30000);
    req.end();
  });
}
