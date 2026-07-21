/** Format a date value that may be a unix epoch (seconds, from the Python
 * backend's time.time()) or an ISO string (from Auth.js adapter Date fields). */
export function fmtDate(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const d =
    typeof v === "number"
      ? new Date(v * 1000)
      : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function fmtRelative(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const d = typeof v === "number" ? new Date(v * 1000) : new Date(v);
  if (isNaN(d.getTime())) return "—";
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 86400 * 30) return `${Math.floor(secs / 86400)}d ago`;
  return d.toLocaleDateString();
}
