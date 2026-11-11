export const fmtPrice = (n) =>
  n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPct = (n, digits = 2) =>
  n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;

export const fmtBig = (n) => {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};

export const tone = (n) => (n > 0 ? 'gain' : n < 0 ? 'loss' : 'muted');
