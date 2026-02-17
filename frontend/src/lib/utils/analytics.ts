import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

function isGAEnabled(): boolean {
  return import.meta.env.PROD && !!GA_MEASUREMENT_ID;
}

/**
 * Initialize Google Analytics by injecting the gtag.js script dynamically.
 * Only runs in production when VITE_GA_MEASUREMENT_ID is set.
 */
export function initializeGA(): void {
  if (!isGAEnabled()) return;
  if (document.querySelector(`script[src*="googletagmanager.com/gtag"]`)) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
  });
}

/**
 * Send a page_view event to GA.
 */
export function trackPageView(path: string): void {
  if (!isGAEnabled() || !window.gtag) return;
  window.gtag('event', 'page_view', { page_path: path });
}

/**
 * Track a custom event.
 */
export function trackEvent(action: string, category: string, label?: string, value?: number): void {
  if (!isGAEnabled() || !window.gtag) return;
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}

/**
 * Hook that sends a page_view on every route change.
 * Must be used inside a component rendered within the Router context.
 */
export function usePageTracking(): void {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
}
