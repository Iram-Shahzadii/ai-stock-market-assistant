import { useMemo, useState } from 'react';
import { Badge, Card, DataTable, Provenance, Segmented, Skeleton } from '../components/ui';
import LineSvg from '../components/LineSvg';
import { TICKERS } from '../data/mock';
import { fetchFundamentals, fetchHistory } from '../api/client';
import { useApi } from '../lib/useApi';
import { rsi } from '../lib/indicators';
import { fmtBig, fmtPct, fx, tone } from '../lib/format';

async function loadAll(symbols) {
  const out = await Promise.all(symbols.map(async (s) => {
    const [h, f] = await Promise.all([fetchHistory(s, '1y'), fetchFundamentals(s)]);
    return [s, { candles: h.candles, f, demo: h.demo }];
  }));
  return Object.fromEntries(out);
}

const COLORS = { AAPL: '#adc6ff', MSFT: '#4edea3', NVDA: '#ffb95f', TSLA: '#ffb4ab' };
const RANGES = { '3M': 63, '6M': 126, '1Y': 252 };

export default function ComparePage() {
  const [picked, setPicked] = useState(['AAPL', 'MSFT', 'NVDA']);
  const [range, setRange] = useState('1Y');
  const n = RANGES[range];

  const { data: loaded, loading } = useApi(() => loadAll(picked), [picked.join()]);
  const toggle = (s) => setPicked((p) => (p.includes(s) ? (p.length > 1 ? p.filter((x) => x !== s) : p) : [...p, s]));

  const data = useMemo(
    () =>
      !loaded ? [] : picked.filter((s) => loaded[s]).map((s) => {
        const c = loaded[s].candles.slice(-n);
        const base = c[0].close;
        const closes = c.map((x) => x.close);
        const rets = closes.slice(1).map((v, i) => Math.log(v / closes[i]));
        const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
        const vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) * Math.sqrt(252) * 100;
        let peak = -Infinity;
        let mdd = 0;
        closes.forEach((v) => { peak = Math.max(peak, v); mdd = Math.min(mdd, (v - peak) / peak); });
        return {
          symbol: s,
          norm: closes.map((v) => (v / base) * 100),
          ret: (closes.at(-1) / base - 1) * 100,
          vol,
          mdd: mdd * 100,
          rsi: rsi(loaded[s].candles.map((x) => x.close)).at(-1),
          f: loaded[s].f,
          demo: loaded[s].demo,
        };
      }),
    [picked, n, loaded],
  );
  const best = [...data].sort((a, b) => b.ret - a.ret)[0];
  const ready = !loading && data.length > 0;
  const demo = data.some((d) => d.demo);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label-sm muted">Stock comparison</div>
          <h1 className="h-lg">Compare Stocks</h1>
        </div>
        <div className="row wrap">
          {TICKERS.map((t) => (
            <button key={t.symbol} className={`btn btn-sm ${picked.includes(t.symbol) ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => toggle(t.symbol)}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[t.symbol], display: 'inline-block' }} /> {t.symbol}
            </button>
          ))}
          <Segmented options={Object.keys(RANGES)} value={range} onChange={setRange} />
        </div>
      </div>

      {!ready ? (
        <div className="grid"><div className="col-8"><Skeleton h={360} /></div><div className="col-4"><Skeleton h={360} /></div><div className="col-12"><Skeleton h={220} /></div></div>
      ) : (
      <div className="grid">
        <Card
          className="col-8"
          i={0}
          title="Relative performance (rebased to 100)"
          action={<div className="legend-row">{data.map((d) => <span key={d.symbol}><i style={{ background: COLORS[d.symbol] }} />{d.symbol}</span>)}</div>}
        >
          <LineSvg
            key={picked.join() + range}
            series={data.map((d) => ({ name: d.symbol, values: d.norm, color: COLORS[d.symbol] }))}
            height={300}
            labels={[`${range} ago`, 'Today']}
          />
        </Card>
        <Card className="col-4" i={1} title="Summary">
          <p style={{ marginTop: 0 }}>
            Over {range}, <strong className="mono">{best.symbol}</strong> led with{' '}
            <span className={`num ${tone(best.ret)}`}>{fmtPct(best.ret)}</span>.
          </p>
          {data.map((d) => (
            <div key={d.symbol} className="kv">
              <span className="mono">{d.symbol}</span>
              <span className="row">
                <Badge tone={tone(d.ret) === 'muted' ? 'neutral' : tone(d.ret)}>{fmtPct(d.ret)}</Badge>
              </span>
            </div>
          ))}
          <Provenance
            sources={demo ? [{ label: 'Demo data (backend offline)', url: 'https://finance.yahoo.com' }] : data.map((d) => ({ label: `Yahoo Finance — ${d.symbol}`, url: `https://finance.yahoo.com/quote/${d.symbol}` }))}
            assumptions={['Returns use close prices, no dividends', 'Volatility is annualised from daily log returns (252 days)', 'Max drawdown = largest peak-to-trough fall']}
          />
        </Card>
        <Card className="col-12" i={2} title="Side-by-side metrics">
          <DataTable
            columns={['Ticker', `${range} return`, 'Volatility', 'Max drawdown', 'RSI 14', 'Market cap', 'P/E', 'Net margin', 'Debt/Equity']}
            align={['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']}
            rows={data.map((d) => [
              <span className="mono">{d.symbol}</span>,
              <span className={tone(d.ret)}>{fmtPct(d.ret)}</span>,
              `${d.vol.toFixed(1)}%`,
              <span className="loss">{d.mdd.toFixed(1)}%</span>,
              fx(d.rsi, 1),
              fmtBig(d.f?.marketCap),
              fx(d.f?.pe, 1, 'x'),
              fx(d.f?.netMargin, 1, '%'),
              fx(d.f?.debtToEquity, 2),
            ])}
          />
        </Card>
      </div>
      )}
    </>
  );
}
