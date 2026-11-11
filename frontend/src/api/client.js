// API client. Hissa A: mock responses. Hissa B: real calls to the FastAPI backend.
import { getQuote, getCandles, FUNDAMENTALS, MOCK_SOURCES } from '../data/mock';
import { rsi, sma, trendOf } from '../lib/indicators';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const USE_MOCK = true; // Hissa B mein false hoga

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function detectTicker(text) {
  const t = text.toUpperCase();
  for (const s of ['AAPL', 'MSFT', 'NVDA', 'TSLA']) if (t.includes(s)) return s;
  if (/APPLE/.test(t)) return 'AAPL';
  if (/MICROSOFT/.test(t)) return 'MSFT';
  if (/NVIDIA/.test(t)) return 'NVDA';
  if (/TESLA/.test(t)) return 'TSLA';
  return 'AAPL';
}

// Returns a structured answer: text + optional table + tool steps + sources + assumptions
export async function sendChat(message, onStep) {
  const ticker = detectTicker(message);
  const steps = [
    `get_quote(${ticker})`,
    `get_price_history(${ticker}, 1y)`,
    `run_python(indicators.py)`,
  ];
  for (const s of steps) {
    await wait(450);
    onStep?.(s);
  }
  await wait(400);

  const q = getQuote(ticker);
  const closes = getCandles(ticker).map((c) => c.close);
  const r = rsi(closes).at(-1);
  const s50 = sma(closes, 50).at(-1);
  const s200 = sma(closes, 200).at(-1);
  const tr = trendOf(closes);
  const f = FUNDAMENTALS[ticker];

  return {
    ticker,
    text: [
      `${ticker} is trading at ${q.price.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}% today). The trend is **${tr.label.toLowerCase()}**: price vs the 50-day average is ${q.price > s50 ? 'above' : 'below'}, and the 50-day is ${s50 > s200 ? 'above' : 'below'} the 200-day.`,
      `RSI(14) is ${r.toFixed(1)}, which is ${r > 70 ? 'overbought territory (possible pullback risk)' : r < 30 ? 'oversold territory (possible bounce)' : 'in the neutral zone'}. On valuation, P/E is ${f.pe.toFixed(1)}x with a ${f.netMargin.toFixed(1)}% net margin.`,
    ],
    table: {
      columns: ['Metric', 'Value'],
      rows: [
        ['Price', q.price.toFixed(2)],
        ['RSI (14)', r.toFixed(1)],
        ['SMA 50', s50.toFixed(2)],
        ['SMA 200', s200.toFixed(2)],
        ['P/E (TTM)', `${f.pe.toFixed(1)}x`],
      ],
    },
    sources: MOCK_SOURCES,
    assumptions: [
      'Demo mode: mock data, not live prices.',
      'Indicators use daily closes over the last ~300 trading days.',
      'This is educational analysis, not financial advice.',
    ],
  };
}
