import { useMemo, useState } from 'react';
import { CandleChart, IndicatorChart } from '../components/CandleChart';
import { AnimatedNumber, Badge, Card, Provenance, Segmented, Skeleton, TickerSelect } from '../components/ui';
import { TICKERS } from '../data/mock';
import { fetchHistory } from '../api/client';
import { useApi } from '../lib/useApi';
import { macd, rsi, sma, trendOf } from '../lib/indicators';
import { fmtBig, fmtPct, fmtPrice, tone } from '../lib/format';

const RANGES = { '3M': 63, '6M': 126, '1Y': 252 };

export default function ChartPage() {
  const [symbol, setSymbol] = useState('NVDA');
  const [range, setRange] = useState('6M');
  const { data, loading } = useApi(() => fetchHistory(symbol, '2y'), [symbol]);
  const ready = !loading && data?.candles?.length > 30;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label-sm muted">Technical analysis</div>
          <h1 className="h-lg">Price &amp; Indicators</h1>
        </div>
        <div className="row wrap">
          {data && !loading && <Badge tone={data.demo ? 'warn' : 'gain'} dot>{data.demo ? 'DEMO DATA' : 'LIVE · YAHOO'}</Badge>}
          <TickerSelect value={symbol} onChange={setSymbol} tickers={TICKERS} />
          <Segmented options={Object.keys(RANGES)} value={range} onChange={setRange} />
        </div>
      </div>
      {ready ? (
        <ChartBody key={symbol} all={data.candles} sources={data.sources} range={range} />
      ) : (
        <div className="grid">
          {[0, 1, 2, 3].map((k) => <div key={k} className="col-3"><Skeleton h={110} /></div>)}
          <div className="col-9"><Skeleton h={480} /></div>
          <div className="col-3"><Skeleton h={480} /></div>
        </div>
      )}
    </>
  );
}

function ChartBody({ all, sources, range }) {
  const [ma, setMa] = useState({ sma20: true, sma50: true, sma200: false });
  const [hover, setHover] = useState(null);
  const loading = false;
  const calc = useMemo(() => {
    const closes = all.map((c) => c.close);
    return {
      sma20: sma(closes, 20),
      sma50: sma(closes, 50),
      sma200: sma(closes, 200),
      rsi: rsi(closes),
      macd: macd(closes),
      trend: trendOf(closes),
    };
  }, [all]);

  const n = RANGES[range];
  const view = useMemo(() => all.slice(-n), [all, n]);
  const overlays = useMemo(
    () => ({
      sma20: ma.sma20 ? calc.sma20.slice(-n) : null,
      sma50: ma.sma50 ? calc.sma50.slice(-n) : null,
      sma200: ma.sma200 ? calc.sma200.slice(-n) : null,
    }),
    [ma, calc, n],
  );
  const rsiLines = useMemo(() => [{ values: calc.rsi.slice(-n), color: '#adc6ff' }], [calc, n]);
  const macdLines = useMemo(
    () => [
      { values: calc.macd.line.slice(-n), color: '#4edea3' },
      { values: calc.macd.signal.slice(-n), color: '#ffb95f' },
    ],
    [calc, n],
  );
  const macdHist = useMemo(() => calc.macd.hist.slice(-n), [calc, n]);

  const last = all.at(-1);
  const prevC = all.at(-2);
  const q = { price: last.close, changePct: ((last.close - prevC.close) / prevC.close) * 100 };
  const lastRsi = calc.rsi.at(-1);
  const periodChange = ((view.at(-1).close - view[0].close) / view[0].close) * 100;
  const avgVol = view.reduce((a, c) => a + c.volume, 0) / view.length;
  const lastVol = view.at(-1).volume;
  const info = hover || view.at(-1);

  return (
    <>
      <div className="grid" style={{ marginBottom: 'var(--gutter)' }}>
        <Card className="col-3" compact lift i={0}>
          <div className="body-sm muted">Last price</div>
          <div className="metric-value"><AnimatedNumber value={q.price} /></div>
          <Badge tone={tone(q.changePct)}>{fmtPct(q.changePct)} today</Badge>
        </Card>
        <Card className="col-3" compact lift i={1}>
          <div className="body-sm muted">{range} change</div>
          <div className={`metric-value ${tone(periodChange)}`}><AnimatedNumber value={periodChange} suffix="%" /></div>
          <Badge tone={calc.trend.tone} dot>{calc.trend.label}</Badge>
        </Card>
        <Card className="col-3" compact lift i={2}>
          <div className="body-sm muted">RSI (14)</div>
          <div className="metric-value"><AnimatedNumber value={lastRsi} decimals={1} /></div>
          <Badge tone={lastRsi > 70 ? 'warn' : lastRsi < 30 ? 'info' : 'neutral'}>
            {lastRsi > 70 ? 'Overbought' : lastRsi < 30 ? 'Oversold' : 'Neutral'}
          </Badge>
        </Card>
        <Card className="col-3" compact lift i={3}>
          <div className="body-sm muted">Volume vs avg</div>
          <div className="metric-value num">{fmtBig(lastVol)}</div>
          <Badge tone={lastVol > avgVol ? 'gain' : 'neutral'}>{fmtPct(((lastVol - avgVol) / avgVol) * 100, 0)} vs {range} avg</Badge>
        </Card>
      </div>

      <div className="grid">
        <Card
          className="col-9"
          i={4}
          title={
            <span className="row wrap label-md" style={{ gap: 14 }}>
              <span>{info.time}</span>
              <span>O <span className="num">{fmtPrice(info.open)}</span></span>
              <span>H <span className="num">{fmtPrice(info.high)}</span></span>
              <span>L <span className="num">{fmtPrice(info.low)}</span></span>
              <span>C <span className={`num ${tone(info.close - info.open)}`}>{fmtPrice(info.close)}</span></span>
            </span>
          }
          action={
            <div className="row wrap">
              {[['sma20', 'SMA 20', '#adc6ff'], ['sma50', 'SMA 50', '#ffb95f'], ['sma200', 'SMA 200', '#c4a5ff']].map(([k, label, color]) => (
                <button key={k} className={`btn btn-sm ${ma[k] ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setMa((m) => ({ ...m, [k]: !m[k] }))}>
                  <i style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} /> {label}
                </button>
              ))}
            </div>
          }
        >
          {loading ? <Skeleton h={420} /> : <CandleChart candles={view} overlays={overlays} onHover={setHover} />}
        </Card>

        <div className="col-3 stack">
          <Card title="Indicators panel" i={5}>
            <div className="kv"><span className="muted">SMA 20</span><span className="num">{fmtPrice(calc.sma20.at(-1))}</span></div>
            <div className="kv"><span className="muted">SMA 50</span><span className="num">{fmtPrice(calc.sma50.at(-1))}</span></div>
            <div className="kv"><span className="muted">SMA 200</span><span className="num">{fmtPrice(calc.sma200.at(-1))}</span></div>
            <div className="kv"><span className="muted">MACD</span><span className={`num ${tone(calc.macd.line.at(-1))}`}>{calc.macd.line.at(-1).toFixed(2)}</span></div>
            <div className="kv"><span className="muted">Signal</span><span className="num">{calc.macd.signal.at(-1).toFixed(2)}</span></div>
            <div className="kv"><span className="muted">Histogram</span><span className={`num ${tone(calc.macd.hist.at(-1))}`}>{calc.macd.hist.at(-1).toFixed(2)}</span></div>
          </Card>
          <Card title="Interpretation" i={6}>
            <p className="body-sm muted" style={{ margin: 0 }}>
              Price is {q.price > calc.sma50.at(-1) ? 'above' : 'below'} its 50-day average and MACD is{' '}
              {calc.macd.hist.at(-1) >= 0 ? 'above' : 'below'} its signal line, suggesting{' '}
              {calc.macd.hist.at(-1) >= 0 ? 'positive' : 'weakening'} momentum.
            </p>
            <Provenance
              sources={sources}
              assumptions={['Daily candles', 'RSI uses Wilder smoothing (14)', 'MACD 12/26/9 EMA']}
            />
          </Card>
        </div>

        <Card className="col-6" title="RSI (14)" i={7}>
          {loading ? <Skeleton h={140} /> : (
            <IndicatorChart
              candles={view}
              lines={rsiLines}
              bands={[{ value: 70, color: '#ffb95f', label: '70' }, { value: 30, color: '#adc6ff', label: '30' }]}
            />
          )}
        </Card>
        <Card className="col-6" title="MACD (12, 26, 9)" i={8}
          action={<div className="legend-row"><span><i style={{ background: '#4edea3' }} />MACD</span><span><i style={{ background: '#ffb95f' }} />Signal</span></div>}
        >
          {loading ? <Skeleton h={140} /> : <IndicatorChart candles={view} lines={macdLines} histogram={macdHist} />}
        </Card>
      </div>
    </>
  );
}
