import { useEffect } from "react";
import { useLocation } from "react-router";
import type { MetricWithAttribution } from "web-vitals/attribution";

/** The Google Analytics 4 property, the same one the old site reported to. */
export const GA_MEASUREMENT_ID = "G-QPKSEMRTZ2";

/** Only production builds report: not local dev or the e2e tests. */
export const analyticsEnabled = import.meta.env.PROD;

/**
 * Defines `gtag` and configures the property. Its own page views are off: they'd
 * only count full page loads, so `usePageViews` reports every navigation instead.
 *
 * gtag.js itself (175 KB, the page's largest script) loads once the page has and
 * the browser is idle, so it never competes with the page on a slow phone. Until
 * then `gtag()` queues in `dataLayer`, which gtag.js reads when it arrives.
 */
export const GTAG_SCRIPT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:false});(function(){function load(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}';document.head.appendChild(s)}function idle(){(window.requestIdleCallback||setTimeout)(load)}if(document.readyState==='complete')idle();else addEventListener('load',idle,{once:true})})();`;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Reports a page view for the first page and after every client navigation. */
export function usePageViews() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    // After the render, so the new page's <title> is in place.
    window.gtag?.("event", "page_view", {
      page_path: pathname + search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, search]);
}

/** What each metric's report says about its cause (web-vitals' attribution build). */
function attribution(metric: MetricWithAttribution) {
  switch (metric.name) {
    case "CLS":
      return {
        debug_target: metric.attribution.largestShiftTarget,
        debug_load_state: metric.attribution.loadState,
      };
    case "INP":
      return {
        debug_target: metric.attribution.interactionTarget,
        debug_event: metric.attribution.interactionType,
        debug_load_state: metric.attribution.loadState,
        debug_input_delay: Math.round(metric.attribution.inputDelay),
        debug_processing: Math.round(metric.attribution.processingDuration),
        debug_presentation: Math.round(metric.attribution.presentationDelay),
      };
    case "LCP":
      return {
        debug_target: metric.attribution.target,
        debug_ttfb: Math.round(metric.attribution.timeToFirstByte),
        debug_load_delay: Math.round(metric.attribution.resourceLoadDelay),
        debug_load_time: Math.round(metric.attribution.resourceLoadDuration),
        debug_render_delay: Math.round(metric.attribution.elementRenderDelay),
      };
    default:
      return {};
  }
}

/**
 * Reports how fast pages load and respond for real visitors (LCP, INP, CLS,
 * FCP, TTFB) to Analytics, with the element and phase behind each, so a slow tap
 * or a shift can be traced to its cause (docs/PLAN.md, decision 47). The library
 * loads after the page has; its observers read the entries buffered before then.
 */
export function useWebVitals() {
  useEffect(() => {
    if (!analyticsEnabled) return;
    void import("web-vitals/attribution").then(
      ({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
        const send = (metric: MetricWithAttribution) =>
          window.gtag?.("event", metric.name, {
            // Analytics wants whole numbers; CLS is a small fraction.
            value: Math.round(
              metric.name === "CLS" ? metric.delta * 1000 : metric.delta,
            ),
            metric_id: metric.id,
            metric_value: metric.value,
            metric_rating: metric.rating,
            metric_navigation: metric.navigationType,
            page_path: window.location.pathname,
            non_interaction: true,
            ...attribution(metric),
          });
        onCLS(send);
        onFCP(send);
        onINP(send);
        onLCP(send);
        onTTFB(send);
      },
    );
  }, []);
}
