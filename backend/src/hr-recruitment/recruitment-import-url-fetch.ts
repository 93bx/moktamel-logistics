import * as dns from 'dns/promises';
import ipaddr from 'ipaddr.js';
import { fileTypeFromBuffer } from 'file-type';

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_IMAGE_BYTES_DEFAULT = 10 * 1024 * 1024;

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function assertPublicIp(ip: string): void {
  if (!ipaddr.isValid(ip)) {
    throw new Error('SSRF_BLOCKED');
  }
  const addr = ipaddr.parse(ip);
  if (addr.range() !== 'unicast') {
    throw new Error('SSRF_BLOCKED');
  }
}

async function assertHostnameResolvesToPublic(hostname: string): Promise<void> {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) {
    throw new Error('SSRF_BLOCKED');
  }
  const results = await dns.lookup(h, { all: true, verbatim: true });
  if (!results.length) {
    throw new Error('DOWNLOAD_FAILED');
  }
  for (const r of results) {
    assertPublicIp(r.address);
  }
}

async function assertUrlSafeForFetch(url: URL): Promise<void> {
  if (url.protocol !== 'https:') {
    throw new Error('HTTPS_REQUIRED');
  }
  if (url.username || url.password) {
    throw new Error('INVALID_URL');
  }
  const host = url.hostname;
  if (!host) throw new Error('INVALID_URL');

  if (ipaddr.isValid(host)) {
    assertPublicIp(host);
    return;
  }
  await assertHostnameResolvesToPublic(host);
}

async function readBodyWithLimit(
  res: Response,
  maxBytes: number,
): Promise<Buffer> {
  const len = res.headers.get('content-length');
  if (len) {
    const n = Number(len);
    if (Number.isFinite(n) && n > maxBytes) {
      throw new Error('IMAGE_TOO_LARGE');
    }
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('DOWNLOAD_FAILED');
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > maxBytes) {
      throw new Error('IMAGE_TOO_LARGE');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Validates URL, blocks SSRF (HTTPS only, public DNS targets), follows redirects,
 * downloads bytes with size cap, verifies image magic bytes via file-type.
 */
export async function fetchHttpsImageToBuffer(
  rawUrl: string,
  maxBytes: number = MAX_IMAGE_BYTES_DEFAULT,
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error('INVALID_URL');
  }

  let current = url.href;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    await assertUrlSafeForFetch(u);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(u.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'image/*,*/*;q=0.8',
          'User-Agent': 'MoktamelImport/1.0',
        },
      });
    } finally {
      clearTimeout(t);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc || hop === MAX_REDIRECTS) {
        throw new Error('DOWNLOAD_FAILED');
      }
      current = new URL(loc, u).href;
      continue;
    }

    if (!res.ok) {
      throw new Error('DOWNLOAD_FAILED');
    }

    const buf = await readBodyWithLimit(res, maxBytes);
    const ct = (res.headers.get('content-type') ?? '').split(';')[0]?.trim();

    const ft = await fileTypeFromBuffer(buf);
    if (!ft) {
      throw new Error('NOT_IMAGE');
    }
    const mime = ft.mime;
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      throw new Error('NOT_IMAGE');
    }
    if (
      ct &&
      (ct.includes('text/html') ||
        ct.includes('application/json') ||
        ct.includes('text/plain'))
    ) {
      throw new Error('NOT_IMAGE');
    }

    return { buffer: buf, mime, ext: ft.ext };
  }

  throw new Error('DOWNLOAD_FAILED');
}
