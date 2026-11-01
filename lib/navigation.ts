/** Full-page navigation, used after cookie-session changes so server components re-render. */
export function hardNavigate(path: string): void {
  window.location.assign(new URL(path, window.location.origin).href);
}
