import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AnimatedNumber, Badge, Card, DataTable, Provenance, TickerSelect } from '../components/ui';
import LineSvg from '../components/LineSvg';
import { TICKERS, getQuote, getCandles } from '../data/mock';
import { fmtPct, fmtPrice, tone } from '../lib/format';

// Lognormal (GBM) projection with an analytic 10th–90th percentile band.
// Hissa C mein ye calculation Python sandbox mein Monte Carlo se hogi.
function project({ amount, years, mu, sigma }) {
  const steps = Math.max(12, Math.round(years * 12));
  const z = 1.2816; // 90th percentile of the standard normal
  const mid = [];
  const upper = [];
  const lower = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * years;
    const drift = (mu - sigma ** 2 / 2) * t;
    const spread = sigma * Math.sqrt(t);
    mid.push(amount * Math.exp(mu * t));
    upper.push(amount * Math.exp(drift + z * spread));
    lower.push(amount * Math.exp(drift - z * spread));
  }
  return { mid, upper, lower };
}

function histVol(symbol) {
  const c = getCandles(symbol).map((x) => x.close);
  const r = c.slice(1).map((v, i) => Math.log(v / c[i]));
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length) * Math.sqrt(252);
}

function Slider({ label, value, min, max, step, onChange, format }) {
  return (
    <div className="field">
      <div className="row between">
        <label>{label}</label>
        <span className="num label-md">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

export default function WhatIfPage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [amount, setAmount] = useState(10000);
  const [years, setYears] = useState(3);
  const [mu, setMu] = useState(0.1);
  const [shock, setShock] = useState(-20);
  const sigma = useMemo(() => histVol(symbol), [symbol]);
  const q = getQuote(symbol);
  const p = useMemo(() => project({ amount, years, mu, sigma }), [amount, years, mu, sigma]);

  const shares = amount / q.price;
  const shockedPrice = q.price * (1 + shock / 100);
  const recoveryYears = mu > 0 ? Math.log(1 / (1 + shock / 100)) / mu : null;

  const scenarios = [
    ['Bear (10th pct)', p.lower.at(-1)],
    ['Base (expected)', p.mid.at(-1)],
    ['Bull (90th pct)', p.upper.at(-1)],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label-sm muted">Projections &amp; scenarios</div>
          <h1 className="h-lg">What-if Analysis</h1>
        </div>
        <TickerSelect value={symbol} onChange={setSymbol} tickers={TICKERS} />
      </div>

      <div className="grid">
        <Card className="col-4" i={0} title="Inputs">
          <div className="stack">
            <div className="field">
              <label>Investment amount</label>
              <div className="input-group">
                <span className="prefix">USD</span>
                <input type="number" min="100" value={amount} onChange={(e) => setAmount(Math.max(0, +e.target.value))} />
              </div>
            </div>
            <Slider label="Horizon" value={years} min={1} max={10} step={1} onChange={setYears} format={(v) => `${v} yr`} />
            <Slider label="Expected annual return" value={mu} min={-0.1} max={0.3} step={0.01} onChange={setMu} format={(v) => fmtPct(v * 100, 0)} />
            <Slider label="Price shock (what if it drops / jumps)" value={shock} min={-60} max={60} step={5} onChange={setShock} format={(v) => fmtPct(v, 0)} />
            <div className="kv"><span className="muted">Volatility (historical, annual)</span><span className="num">{(sigma * 100).toFixed(1)}%</span></div>
            <div className="kv"><span className="muted">Shares bought at {fmtPrice(q.price)}</span><span className="num">{shares.toFixed(2)}</span></div>
          </div>
        </Card>

        <Card
          className="col-8"
          i={1}
          title={`Projected value of USD ${amount.toLocaleString()} over ${years} years`}
          action={<Badge tone="info">10th–90th percentile band</Badge>}
        >
          <LineSvg
            series={[{ name: 'Expected', values: p.mid, color: '#4edea3', width: 2.5 }, { name: 'Bull', values: p.upper, color: 'rgba(78,222,163,0.5)', width: 1, dashed: true }, { name: 'Bear', values: p.lower, color: 'rgba(255,180,171,0.6)', width: 1, dashed: true }]}
            band={{ upper: p.upper, lower: p.lower, color: 'rgba(16,185,129,0.08)' }}
            height={280}
            yFormat={(v) => `${(v / 1000).toFixed(1)}K`}
            labels={['Today', `Year ${years}`]}
          />
          <div className="grid" style={{ marginTop: 16 }}>
            {scenarios.map(([label, v], i) => (
              <motion.div key={label} className="col-4 card compact" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}>
                <div className="body-sm muted">{label}</div>
                <div className={`h-md num ${tone(v - amount)}`}><AnimatedNumber value={v} decimals={0} prefix="$" /></div>
                <span className={`num body-sm ${tone(v - amount)}`}>{fmtPct((v / amount - 1) * 100, 1)}</span>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card className="col-6" i={2} title={`Shock scenario: ${symbol} moves ${fmtPct(shock, 0)}`}>
          <DataTable
            columns={['Item', 'Before', 'After']}
            align={['l', 'r', 'r']}
            rows={[
              ['Share price', fmtPrice(q.price), <span className={tone(shock)}>{fmtPrice(shockedPrice)}</span>],
              ['Position value', fmtPrice(amount), <span className={tone(shock)}>{fmtPrice(shares * shockedPrice)}</span>],
              ['Profit / loss', '0.00', <span className={tone(shock)}>{fmtPrice(shares * shockedPrice - amount)}</span>],
              ['Years to recover at expected return', '—', shock < 0 && recoveryYears ? `${recoveryYears.toFixed(1)} yr` : '—'],
            ]}
          />
        </Card>
        <Card className="col-6" i={3} title="Assumptions & method">
          <Provenance
            sources={[{ label: 'Price history: Yahoo Finance via yfinance (demo data in Hissa A)', url: 'https://finance.yahoo.com' }]}
            assumptions={[
              'Prices follow geometric Brownian motion (log-normal returns).',
              `Volatility = ${(sigma * 100).toFixed(1)}% from 1 year of daily returns.`,
              'No dividends, taxes or trading fees.',
              'Projections are illustrations, not forecasts or advice.',
            ]}
          />
        </Card>
      </div>
    </>
  );
}
