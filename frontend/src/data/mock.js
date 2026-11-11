// MOCK DATA — sirf UI dikhane ke liye. Hissa B mein ye backend (yfinance) ke live data se replace hoga.
// Numbers deliberately "demo" hain, real market figures nahi.

export const TICKERS = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', start: 228, drift: 0.0006, vol: 0.015 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', start: 415, drift: 0.0005, vol: 0.013 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Semiconductors', start: 120, drift: 0.0012, vol: 0.028 },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Automotive', start: 250, drift: 0.0002, vol: 0.032 },
];

// Deterministic pseudo-random generator so mock charts look the same every reload
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
function gauss(r) {
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const cache = {};
export function getCandles(symbol, days = 300) {
  const key = `${symbol}-${days}`;
  if (cache[key]) return cache[key];
  const t = TICKERS.find((x) => x.symbol === symbol) ?? TICKERS[0];
  const r = rng(symbol.split('').reduce((a, c) => a + c.charCodeAt(0) * 97, 7));
  const out = [];
  const d = new Date(Date.UTC(2026, 10, 10));
  const dates = [];
  while (dates.length < days) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) dates.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  let close = t.start;
  for (const time of dates) {
    const open = close * (1 + gauss(r) * t.vol * 0.3);
    close = open * (1 + t.drift + gauss(r) * t.vol);
    const high = Math.max(open, close) * (1 + r() * t.vol * 0.6);
    const low = Math.min(open, close) * (1 - r() * t.vol * 0.6);
    const volume = Math.round((40 + r() * 60) * 1e6 * (t.symbol === 'NVDA' ? 3 : 1));
    out.push({ time, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume });
  }
  cache[key] = out;
  return out;
}

export function getQuote(symbol) {
  const c = getCandles(symbol);
  const last = c.at(-1);
  const prev = c.at(-2);
  return {
    symbol,
    price: last.close,
    change: last.close - prev.close,
    changePct: ((last.close - prev.close) / prev.close) * 100,
    volume: last.volume,
  };
}

export const FUNDAMENTALS = {
  AAPL: {
    marketCap: 3.4e12, pe: 33.1, forwardPe: 29.4, pb: 48.2, ps: 8.6, evEbitda: 24.8, dividendYield: 0.44, beta: 1.21,
    grossMargin: 46.2, operatingMargin: 31.5, netMargin: 24.3, roe: 152.4, debtToEquity: 1.45,
    income: [
      { year: 'FY2022', revenue: 394.3e9, grossProfit: 170.8e9, operatingIncome: 119.4e9, netIncome: 99.8e9, eps: 6.11 },
      { year: 'FY2023', revenue: 383.3e9, grossProfit: 169.1e9, operatingIncome: 114.3e9, netIncome: 97.0e9, eps: 6.13 },
      { year: 'FY2024', revenue: 391.0e9, grossProfit: 180.7e9, operatingIncome: 123.2e9, netIncome: 93.7e9, eps: 6.08 },
      { year: 'FY2025', revenue: 410.2e9, grossProfit: 190.1e9, operatingIncome: 129.6e9, netIncome: 101.2e9, eps: 6.72 },
    ],
    earnings: [
      { quarter: 'Q4 25', estimate: 1.62, actual: 1.71 },
      { quarter: 'Q1 26', estimate: 2.35, actual: 2.40 },
      { quarter: 'Q2 26', estimate: 1.60, actual: 1.57 },
      { quarter: 'Q3 26', estimate: 1.43, actual: 1.52 },
    ],
  },
  MSFT: {
    marketCap: 3.1e12, pe: 35.6, forwardPe: 31.2, pb: 11.4, ps: 12.9, evEbitda: 23.1, dividendYield: 0.72, beta: 0.9,
    grossMargin: 69.8, operatingMargin: 44.6, netMargin: 35.9, roe: 34.3, debtToEquity: 0.33,
    income: [
      { year: 'FY2022', revenue: 198.3e9, grossProfit: 135.6e9, operatingIncome: 83.4e9, netIncome: 72.7e9, eps: 9.65 },
      { year: 'FY2023', revenue: 211.9e9, grossProfit: 146.1e9, operatingIncome: 88.5e9, netIncome: 72.4e9, eps: 9.68 },
      { year: 'FY2024', revenue: 245.1e9, grossProfit: 171.0e9, operatingIncome: 109.4e9, netIncome: 88.1e9, eps: 11.80 },
      { year: 'FY2025', revenue: 279.4e9, grossProfit: 195.0e9, operatingIncome: 124.6e9, netIncome: 100.3e9, eps: 13.45 },
    ],
    earnings: [
      { quarter: 'Q4 25', estimate: 3.10, actual: 3.23 },
      { quarter: 'Q1 26', estimate: 3.22, actual: 3.46 },
      { quarter: 'Q2 26', estimate: 3.38, actual: 3.51 },
      { quarter: 'Q3 26', estimate: 3.55, actual: 3.62 },
    ],
  },
  NVDA: {
    marketCap: 3.6e12, pe: 52.4, forwardPe: 34.8, pb: 45.1, ps: 27.3, evEbitda: 44.2, dividendYield: 0.03, beta: 1.68,
    grossMargin: 74.6, operatingMargin: 61.2, netMargin: 54.1, roe: 119.2, debtToEquity: 0.15,
    income: [
      { year: 'FY2023', revenue: 27.0e9, grossProfit: 15.4e9, operatingIncome: 4.2e9, netIncome: 4.4e9, eps: 0.17 },
      { year: 'FY2024', revenue: 60.9e9, grossProfit: 44.3e9, operatingIncome: 33.0e9, netIncome: 29.8e9, eps: 1.19 },
      { year: 'FY2025', revenue: 130.5e9, grossProfit: 97.9e9, operatingIncome: 81.5e9, netIncome: 72.9e9, eps: 2.94 },
      { year: 'FY2026', revenue: 196.0e9, grossProfit: 146.2e9, operatingIncome: 120.0e9, netIncome: 106.0e9, eps: 4.31 },
    ],
    earnings: [
      { quarter: 'Q4 25', estimate: 0.85, actual: 0.89 },
      { quarter: 'Q1 26', estimate: 0.93, actual: 0.96 },
      { quarter: 'Q2 26', estimate: 1.01, actual: 1.05 },
      { quarter: 'Q3 26', estimate: 1.12, actual: 1.18 },
    ],
  },
  TSLA: {
    marketCap: 0.82e12, pe: 96.3, forwardPe: 78.5, pb: 11.2, ps: 8.4, evEbitda: 55.9, dividendYield: 0, beta: 2.3,
    grossMargin: 17.9, operatingMargin: 7.2, netMargin: 7.3, roe: 10.4, debtToEquity: 0.18,
    income: [
      { year: 'FY2022', revenue: 81.5e9, grossProfit: 20.9e9, operatingIncome: 13.7e9, netIncome: 12.6e9, eps: 3.62 },
      { year: 'FY2023', revenue: 96.8e9, grossProfit: 17.7e9, operatingIncome: 8.9e9, netIncome: 15.0e9, eps: 4.30 },
      { year: 'FY2024', revenue: 97.7e9, grossProfit: 17.5e9, operatingIncome: 7.1e9, netIncome: 7.1e9, eps: 2.04 },
      { year: 'FY2025', revenue: 99.2e9, grossProfit: 17.8e9, operatingIncome: 7.1e9, netIncome: 7.2e9, eps: 2.05 },
    ],
    earnings: [
      { quarter: 'Q4 25', estimate: 0.76, actual: 0.73 },
      { quarter: 'Q1 26', estimate: 0.41, actual: 0.27 },
      { quarter: 'Q2 26', estimate: 0.40, actual: 0.40 },
      { quarter: 'Q3 26', estimate: 0.55, actual: 0.50 },
    ],
  },
};

export const MOCK_SOURCES = [
  { label: 'Yahoo Finance (via yfinance) — price history', url: 'https://finance.yahoo.com' },
  { label: 'SEC EDGAR — company filings (10-K / 10-Q)', url: 'https://www.sec.gov/edgar/search/' },
];

export const MOCK_JOBS = [
  { id: 'job_7f3a', type: 'Monte Carlo projection', ticker: 'NVDA', status: 'running', progress: 64, step: 'Simulating 10,000 paths', retries: 0, started: '2026-11-11 13:02' },
  { id: 'job_6c21', type: 'Peer comparison', ticker: 'AAPL, MSFT', status: 'success', progress: 100, step: 'Saved result', retries: 0, started: '2026-11-11 12:48' },
  { id: 'job_5b90', type: 'Fundamental deep-dive', ticker: 'TSLA', status: 'retrying', progress: 30, step: 'Data provider timeout — retry 2/3', retries: 2, started: '2026-11-11 12:41' },
  { id: 'job_4e11', type: 'Backtest SMA crossover', ticker: 'MSFT', status: 'success', progress: 100, step: 'Saved result', retries: 1, started: '2026-11-11 11:15' },
  { id: 'job_3d07', type: 'What-if scenario', ticker: 'AAPL', status: 'failed', progress: 45, step: 'Sandbox timeout after 3 retries', retries: 3, started: '2026-11-11 10:03' },
  { id: 'job_2a55', type: 'Technical scan', ticker: 'NVDA', status: 'queued', progress: 0, step: 'Waiting for a worker', retries: 0, started: '2026-11-11 13:05' },
];
