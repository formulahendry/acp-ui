// Platform detection helpers for the frontend.
//
// Uses `navigator.userAgent` which works inside both desktop Tauri webviews
// (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux) and the
// mobile webviews that Tauri 2 ships on iOS / Android, without requiring an
// extra Tauri plugin or Rust round-trip.

export type Platform =
  | 'macos'
  | 'linux'
  | 'windows'
  | 'ios'
  | 'android'
  | 'unknown';

let cached: Platform | null = null;

/** Detect the current platform from `navigator.userAgent`. */
export function getPlatform(): Platform {
  if (cached !== null) return cached;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  // iPadOS 13+ reports as Mac in UA; treat touch-capable Macs as iOS.
  const isIPad =
    /Macintosh/i.test(ua) &&
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints !==
      undefined &&
    ((navigator as Navigator & { maxTouchPoints: number }).maxTouchPoints ?? 0) > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || isIPad) cached = 'ios';
  else if (/Android/i.test(ua)) cached = 'android';
  else if (/Mac/i.test(ua)) cached = 'macos';
  else if (/Windows/i.test(ua)) cached = 'windows';
  else if (/Linux/i.test(ua)) cached = 'linux';
  else cached = 'unknown';
  return cached;
}

/** True for iOS / Android. */
export function isMobile(): boolean {
  const p = getPlatform();
  return p === 'ios' || p === 'android';
}

/** True for macOS / Linux / Windows. */
export function isDesktop(): boolean {
  const p = getPlatform();
  return p === 'macos' || p === 'linux' || p === 'windows';
}
