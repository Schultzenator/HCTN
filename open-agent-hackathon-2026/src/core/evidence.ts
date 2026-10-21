/** Only public web link syntax is eligible; a link is provenance, not verification. */
export function canonicalUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    // GitHub paths are case insensitive; query parameters can carry identity elsewhere.
    if (url.hostname === 'github.com') url.pathname = url.pathname.toLowerCase();
    return url.toString();
  } catch { return undefined; }
}
