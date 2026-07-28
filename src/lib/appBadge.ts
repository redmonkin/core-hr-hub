// Badging API — puts the unread count on the installed PWA's app icon.
// Supported on installed PWAs (Chrome/Edge desktop + Android, Safari on
// iOS 16.4+/macOS); a no-op everywhere else, including a plain browser tab.
export function updateAppBadge(count: number) {
  if (!("setAppBadge" in navigator)) return;

  if (count > 0) {
    navigator.setAppBadge(count).catch(() => {});
  } else {
    navigator.clearAppBadge?.().catch(() => {});
  }
}
