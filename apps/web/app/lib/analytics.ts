import { useEffect } from "react";
import { useLocation } from "react-router";

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
