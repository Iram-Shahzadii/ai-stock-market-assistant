// API client for the FastAPI backend.
// If the backend is not running (or Yahoo is unavailable) every call falls back to demo data,
// and the result carries `demo: true` so the UI can show a "DEMO DATA" badge.
import { getCandles, getQuote, FUNDAMENTALS, MOCK_SOURCES, TICKERS } from '../data/mock';
import { rsi, sma, trendOf } from '../lib/indicators';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

async function http(path, options = {}) {
  if (FORCE_MOCK) throw new Error('mock mode');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), options.timeout ?? 20000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function withFallback(real, demo) {
  try {
    return { ...(await real()), demo: false };
  } catch (e) {
    return { ...demo(), demo: true, error: e.message };
  }
}

export const getHealth = () =>
  withFallback(() => http('/api/health', { timeout: 4000 }), () => ({ status: 'offline', ai: 'demo', mcp: false }));

export const fetchHistory = (symbol, period = '2y') =>
  withFallback(
    () => http(`/api/history/${symbol}?period=${period}`),
    () => ({ symbol, candles: getCandles(symbol), sources: MOCK_SOURCES.slice(0, 1) }),
  );

export const fetchFundamentals = (symbol) =>
  withFallback(() => http(`/api/fundamentals/${symbol}`), () => ({ symbol, ...FUNDAMENTALS[symbol] ?? FUNDAMENTALS.AAPL, sources: MOCK_SOURCES }));

export async function fetchQuotes(symbols = TICKERS.map((t) => t.symbol)) {
  try {
    const list = await http(`/api/quotes?tickers=${symbols.join(',')}`, { timeout: 45000 });
    return { list, demo: false };
  } catch {
    return { list: symbols.map(getQuote), demo: true };
  }
}

// ---- demo chat (used when the backend is offline) ----
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function demoChat(message) {
  const t = ['AAPL', 'MSFT', 'NVDA', 'TSLA'].find((s) => message.toUpperCase().includes(s)) || 'AAPL';
  await wait(900);
  const c = getCandles(t);
  const closes = c.map((x) => x.close);
  const r = rsi(closes).at(-1);
  const s50 = sma(closes, 50).at(-1);
  const s200 = sma(closes, 200).at(-1);
  const f = FUNDAMENTALS[t];
  return {
    ticker: t,
    text: [
      `**${t}** is at **${closes.at(-1).toFixed(2)}**. Trend: **${trendOf(closes).label.toLowerCase()}**. RSI(14) is ${r.toFixed(1)}; P/E is ${f.pe}x.`,
      '_Backend is offline, so this answer uses demo data. Start the backend for live data and AI answers._',
    ],
    table: { columns: ['Metric', 'Value'], rows: [['RSI 14', r.toFixed(1)], ['SMA 50', s50.toFixed(2)], ['SMA 200', s200.toFixed(2)], ['P/E', f.pe]] },
    chart: { type: 'price', symbol: t, points: c.slice(-120).map((x) => ({ time: x.time, close: x.close })) },
    sources: MOCK_SOURCES,
    assumptions: ['Demo data, not live prices.', 'Educational analysis only, not financial advice.'],
    tools: [{ name: 'demo_data', ok: true, transport: 'local', ms: 0 }],
    mode: 'demo',
  };
}

// history: [{ role: 'user'|'ai', content, ticker }]
export async function sendChat(message, history = []) {
  try {
    const res = await http('/api/chat', { method: 'POST', body: JSON.stringify({ message, history }), timeout: 90000 });
    return { ...res, demo: false };
  } catch (e) {
    return { ...(await demoChat(message)), demo: true, error: e.message };
  }
}
