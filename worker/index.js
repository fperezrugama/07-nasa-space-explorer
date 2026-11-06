const NASA_APOD_URL = 'https://api.nasa.gov/planetary/apod';
const EARLIEST_DATE = '1995-06-16';
const MAX_RANGE_DAYS = 31;
const CACHE_SECONDS = 300;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const requestCounts = new Map();

const allowedOrigins = new Set([
  'https://fperezrugama.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
]);

function getCorsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...getCorsHeaders(origin)
    }
  });
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  const [year, month, day] = value.split('-').map(Number);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day;
}

function isAllowedRange(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (!isValidDate(startDate) || !isValidDate(endDate)) return false;
  if (startDate < EARLIEST_DATE || endDate > today || startDate > endDate) return false;
  const rangeLength = (Date.parse(`${endDate}T00:00:00Z`) -
    Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1;
  return rangeLength <= MAX_RANGE_DAYS;
}

function isRateLimited(request) {
  const clientId = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const current = requestCounts.get(clientId);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(clientId, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

function sanitizeApodEntry(entry) {
  return {
    date: entry.date,
    title: entry.title,
    explanation: entry.explanation,
    media_type: entry.media_type,
    url: entry.url || null,
    hdurl: entry.hdurl || null,
    thumbnail_url: entry.thumbnail_url || null,
    permalink: entry.permalink || null,
    alt: entry.alt || null
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
    }
    if (request.method !== 'GET' || url.pathname !== '/api/apod') {
      return jsonResponse({ error: 'Not found.' }, 404, origin);
    }
    if (origin && !allowedOrigins.has(origin)) {
      return jsonResponse({ error: 'Origin not allowed.' }, 403, origin);
    }
    if (!env.NASA_API_KEY) {
      return jsonResponse({ error: 'The NASA service is not configured.' }, 503, origin);
    }
    if (isRateLimited(request)) {
      return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429, origin);
    }

    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    if (!startDate || !endDate || !isAllowedRange(startDate, endDate)) {
      return jsonResponse({ error: 'Use a valid APOD range of up to 31 days.' }, 400, origin);
    }

    const cacheKey = new Request(`${url.origin}/cache/apod?origin=${encodeURIComponent(origin)}&start_date=${startDate}&end_date=${endDate}`);
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;

    const nasaUrl = new URL(NASA_APOD_URL);
    nasaUrl.search = new URLSearchParams({
      api_key: env.NASA_API_KEY,
      start_date: startDate,
      end_date: endDate
    });

    try {
      const response = await fetch(nasaUrl);
      if (!response.ok) {
        return jsonResponse(
          { error: response.status === 429 ? 'NASA rate limit reached.' : 'NASA could not provide this archive.' },
          response.status === 429 ? 429 : 502,
          origin
        );
      }

      const upstreamData = await response.json();
      const entries = (Array.isArray(upstreamData) ? upstreamData : [upstreamData])
        .filter((entry) => entry && entry.date && entry.title && entry.explanation)
        .map(sanitizeApodEntry);
      const responseData = new Response(JSON.stringify(entries), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
          ...getCorsHeaders(origin)
        }
      });
      ctx.waitUntil(caches.default.put(cacheKey, responseData.clone()));
      return responseData;
    } catch (error) {
      return jsonResponse({ error: 'NASA is temporarily unavailable.' }, 502, origin);
    }
  }
};
