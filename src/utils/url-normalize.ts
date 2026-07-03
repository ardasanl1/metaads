export function stripUtmParams(url: string): string {
  try {
    const parsed = new URL(url);
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    for (const key of [...parsed.searchParams.keys()]) {
      if (drop.includes(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function normalizeWebsiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (!parsed.hostname || parsed.hostname === "localhost") return null;
    const normalized = stripUtmParams(`${parsed.protocol}//${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`);
    return normalized.replace(/\/$/, "") || normalized;
  } catch {
    return null;
  }
}

export function extractDomain(url: string): string | null {
  try {
    const normalized = normalizeWebsiteUrl(url);
    if (!normalized) return null;
    const host = new URL(normalized).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function domainsMatch(a: string, b: string): boolean {
  const da = extractDomain(a);
  const db = extractDomain(b);
  return Boolean(da && db && da === db);
}

export function isValidHttpUrl(raw: string): boolean {
  return normalizeWebsiteUrl(raw) !== null;
}

export function isFacebookHostname(value?: string): boolean {
  if (!value?.trim()) return false;
  const raw = value.trim().toLowerCase();
  if (/^\d+$/.test(raw)) return false;
  try {
    const host = raw.includes("://")
      ? new URL(raw).hostname.toLowerCase()
      : raw.replace(/^www\./, "").split("/")[0];
    return host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com" || host.endsWith(".fb.com");
  } catch {
    return raw.includes("facebook.com") || raw.includes("fb.com");
  }
}

const BLOCKED_WEBSITE_HOSTS = [
  "instagram.com",
  "l.facebook.com",
  "api.whatsapp.com",
  "whatsapp.com",
  "messenger.com",
];

export function isBlockedWebsiteUrl(value?: string): boolean {
  if (!value?.trim()) return false;
  if (isFacebookHostname(value)) return true;
  try {
    const normalized = normalizeWebsiteUrl(value);
    if (!normalized) return false;
    const host = new URL(normalized).hostname.toLowerCase();
    return BLOCKED_WEBSITE_HOSTS.some(
      (blocked) => host === blocked || host.endsWith(`.${blocked}`),
    );
  } catch {
    const raw = value.trim().toLowerCase();
    return BLOCKED_WEBSITE_HOSTS.some((blocked) => raw.includes(blocked));
  }
}

export function isAllowedWebsiteUrl(value?: string): boolean {
  if (!value?.trim()) return false;
  if (isBlockedWebsiteUrl(value)) return false;
  return normalizeWebsiteUrl(value) !== null;
}
