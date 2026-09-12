// CivicHorizon analytics — privacy-conscious event instrumentation.
// Configure measurement IDs in js/config.js before production deployment.
import { CIVICHORIZON_CONFIG } from "./config.js";

let ready = false;
let clarityReady = false;

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    s.id = id;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function initAnalytics() {
  const id = CIVICHORIZON_CONFIG.analytics?.ga4MeasurementId;
  if (!id || CIVICHORIZON_CONFIG.analytics?.enabled === false) return false;

  try {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", id, {
      anonymize_ip: true,
      send_page_view: true
    });
    await loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`, "civichorizon-ga4");
    ready = true;
    const clarityId = CIVICHORIZON_CONFIG.analytics?.clarityProjectId;
    if (clarityId) {
      try {
        window.clarity = window.clarity || function(){ (window.clarity.q = window.clarity.q || []).push(arguments); };
        await loadScript(`https://www.clarity.ms/tag/${encodeURIComponent(clarityId)}`, "civichorizon-clarity");
        clarityReady = true;
      } catch (error) {
        console.warn("CivicHorizon Clarity unavailable:", error);
      }
    }
    return true;
  } catch (error) {
    console.warn("CivicHorizon analytics unavailable:", error);
    return false;
  }
}

export function trackEvent(name, params = {}) {
  if (!ready || typeof window.gtag !== "function") return;
  const safe = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    safe[key] = typeof value === "string" ? value.slice(0, 100) : value;
  }
  window.gtag("event", name, safe);
}
