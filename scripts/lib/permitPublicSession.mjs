/**
 * Levallois's public board initializes an anonymous cookie with a literal
 * same-origin JavaScript redirect. Follow the one URL a browser is given,
 * with cookies kept only in this collection's memory. No JavaScript runs.
 * Challenges, logins, arbitrary targets and repeated redirects are not read.
 */
async function initializerPreview(response) {
  if (Number(response.headers?.get?.('content-length')) > 4096) return null;
  const reader = response.clone().body?.getReader?.();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) return null;
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  } finally {
    // A cloned response tees the body. Awaiting this cancellation would wait
    // for the caller to consume the original, which cannot happen until this
    // helper returns. Keep ordinary large index pages readable without a hang.
    void reader.cancel().catch(() => {});
  }
}

export function permitPublicSession(city, http) {
  if (!city.source?.publicCookieRedirect) return http;
  const origin = new URL(city.page).origin;
  const cookies = new Map();
  const remember = (response) => {
    for (const value of response?.headers?.getSetCookie?.() ?? []) {
      const pair = /^([^=;\s]+)=([^;]*)/.exec(value);
      if (pair) cookies.set(pair[1], pair[2]);
    }
  };
  const request = async (url, options) => {
    for (let hop = 0; hop < 4; hop += 1) {
      const headers = new Headers(options?.headers);
      if (cookies.size) headers.set('Cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '));
      // The proxy merges header objects with its identifying user agent.
      const response = await http.fetch(url, { ...options, headers: Object.fromEntries(headers), redirect: 'manual' });
      remember(response);
      const location = response?.headers?.get?.('location');
      if (!location || ![301, 302, 303, 307, 308].includes(response.status)) return response;
      const target = new URL(location, url);
      if (target.origin !== origin) return response;
      await response.body?.cancel?.().catch?.(() => {});
      url = target.href;
    }
    return null;
  };
  return { ...http, async fetch(url, options) {
    const original = new URL(url);
    if (original.origin !== origin || (options?.method && options.method !== 'GET')) return http.fetch(url, options);
    const response = await request(url, options);
    if (!response?.ok || !/text\/html/i.test(response.headers?.get?.('content-type') ?? '') || !response.clone) return response;
    const body = await initializerPreview(response);
    const match = /^\s*<html\b[\s\S]*?<script>window\.location\.href='(\/redirect_[A-Z0-9=]{16,128}\/[^']*)';<\/script>[\s\S]*?<\/html>\s*$/i.exec(body ?? '');
    if (!match) return response;
    const target = new URL(match[1], origin);
    const suffix = target.pathname.replace(/^\/redirect_[A-Z0-9=]+/i, '');
    if (target.origin !== origin || suffix !== original.pathname || target.search !== original.search || !cookies.size) return response;
    await response.body?.cancel?.().catch?.(() => {});
    return request(target.href, options);
  } };
}
