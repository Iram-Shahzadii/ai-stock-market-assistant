// Technical indicators calculated on the frontend for the chart view.
// The backend (Hissa B) will do the same in Python; these keep the UI live with mock data.

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

// Wilder's RSI
export function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    const g = Math.max(ch, 0);
    const l = Math.max(-ch, 0);
    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        gain /= period;
        loss /= period;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
      }
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}

export function macd(values, fast = 12, slow = 26, signal = 9) {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const line = values.map((_, i) => (ef[i] !== null && es[i] !== null ? ef[i] - es[i] : null));
  const start = line.findIndex((v) => v !== null);
  const sig = new Array(values.length).fill(null);
  if (start >= 0) {
    const sub = ema(line.slice(start), signal);
    sub.forEach((v, j) => (sig[start + j] = v));
  }
  const hist = line.map((v, i) => (v !== null && sig[i] !== null ? v - sig[i] : null));
  return { line, signal: sig, hist };
}

// Simple trend label from moving averages
export function trendOf(closes) {
  const s50 = sma(closes, 50).at(-1);
  const s200 = sma(closes, 200).at(-1);
  const last = closes.at(-1);
  if (s50 == null || s200 == null) return { label: 'Not enough data', tone: 'neutral' };
  if (last > s50 && s50 > s200) return { label: 'Uptrend', tone: 'gain' };
  if (last < s50 && s50 < s200) return { label: 'Downtrend', tone: 'loss' };
  return { label: 'Sideways', tone: 'warn' };
}
