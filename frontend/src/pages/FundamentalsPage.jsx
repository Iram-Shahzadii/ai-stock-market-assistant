import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge, Card, DataTable, Provenance, Segmented, Skeleton, TickerSelect } from '../components/ui';
import { TICKERS } from '../data/mock';
import { fetchFundamentals } from '../api/client';
import { useApi } from '../lib/useApi';
import { fmtBig, fmtPct, fx, tone } from '../lib/format';

export default function FundamentalsPage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [tab, setTab] = useState('Income');
  const { data: f, loading } = useApi(() => fetchFundamentals(symbol), [symbol]);

  const head = (
    <div className="page-head">
      <div>
        <div className="label-sm muted">Fundamental analysis</div>
        <h1 className="h-lg">{f && !loading ? f.name || symbol : 'Company Performance'}</h1>
      </div>
      <div className="row wrap">
        {f && !loading && <Badge tone={f.demo ? 'warn' : 'gain'} dot>{f.demo ? 'DEMO DATA' : 'LIVE · YAHOO'}</Badge>}
        <TickerSelect value={symbol} onChange={setSymbol} tickers={TICKERS} />
      </div>
    </div>
  );
  if (loading || !f) {
    return (
      <>
        {head}
        <div className="grid">
          {[0, 1, 2, 3].map((k) => <div key={k} className="col-3"><Skeleton h={110} /></div>)}
          <div className="col-8"><Skeleton h={420} /></div>
          <div className="col-4"><Skeleton h={420} /></div>
        </div>
      </>
    );
  }

  const inc = (f.income || []).filter((r) => r.revenue != null);
  const growth = inc.length > 1 ? ((inc.at(-1).revenue - inc.at(-2).revenue) / inc.at(-2).revenue) * 100 : null;
  const maxRev = Math.max(1, ...inc.map((r) => r.revenue));
  const earnings = (f.earnings || []).filter((e) => e.estimate != null && e.actual != null);

  const valuation = [
    ['Market cap', fmtBig(f.marketCap)],
    ['P/E (TTM)', fx(f.pe, 1, 'x')],
    ['Forward P/E', fx(f.forwardPe, 1, 'x')],
    ['Price / Book', fx(f.pb, 1, 'x')],
    ['Price / Sales', fx(f.ps, 1, 'x')],
    ['EV / EBITDA', fx(f.evEbitda, 1, 'x')],
    ['Dividend yield', fx(f.dividendYield, 2, '%')],
    ['Beta', fx(f.beta, 2)],
    ['ROE', fx(f.roe, 1, '%')],
  ];

  return (
    <>
      {head}
      <div className="grid" key={symbol}>
        {[
          ['Revenue growth (YoY)', fmtPct(growth), growth == null ? 'neutral' : tone(growth) === 'muted' ? 'neutral' : tone(growth)],
          ['Gross margin', fx(f.grossMargin, 1, '%'), f.grossMargin == null ? 'neutral' : f.grossMargin > 30 ? 'gain' : 'warn'],
          ['Net margin', fx(f.netMargin, 1, '%'), f.netMargin == null ? 'neutral' : f.netMargin > 15 ? 'gain' : 'warn'],
          ['Debt / Equity', fx(f.debtToEquity, 2), f.debtToEquity == null ? 'neutral' : f.debtToEquity > 1 ? 'warn' : 'gain'],
        ].map(([label, value, t], i) => (
          <Card key={label} className="col-3" compact lift i={i}>
            <div className="body-sm muted">{label}</div>
            <div className={`metric-value ${t === 'warn' ? 'warn' : ''}`}>{value}</div>
            <Badge tone={t}>{{ gain: 'Healthy', warn: 'Watch', loss: 'Declining', neutral: 'No data' }[t]}</Badge>
          </Card>
        ))}

        <Card className="col-8" i={4} title="Financial statements" action={<Segmented options={['Income', 'Earnings']} value={tab} onChange={setTab} />}>
          {tab === 'Income' ? (
            <DataTable
              columns={['Fiscal year', 'Revenue', 'Gross profit', 'Operating income', 'Net income', 'EPS']}
              align={['l', 'r', 'r', 'r', 'r', 'r']}
              rows={inc.map((r) => [r.year, fmtBig(r.revenue), fmtBig(r.grossProfit), fmtBig(r.operatingIncome), fmtBig(r.netIncome), fx(r.eps, 2)])}
            />
          ) : (
            <DataTable
              columns={['Quarter', 'EPS estimate', 'EPS actual', 'Surprise']}
              align={['l', 'r', 'r', 'r']}
              rows={earnings.map((e) => {
                const s = ((e.actual - e.estimate) / e.estimate) * 100;
                return [e.quarter, e.estimate.toFixed(2), e.actual.toFixed(2), <span className={tone(s)}>{fmtPct(s, 1)}</span>];
              })}
            />
          )}

          <div className="divider" />
          <div className="card-title" style={{ marginBottom: 12 }}>Revenue trend</div>
          <div className="stack" style={{ gap: 10 }}>
            {inc.map((r, i) => (
              <div key={r.year} className="row" style={{ gap: 12 }}>
                <span className="mono body-sm muted" style={{ width: 60 }}>{r.year}</span>
                <div className="bar-track" style={{ flex: 1 }}>
                  <motion.div
                    className="bar-fill"
                    style={{ background: 'var(--primary-container)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(r.revenue / maxRev) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <span className="num body-sm" style={{ width: 64, textAlign: 'right' }}>{fmtBig(r.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-4" i={5} title="Valuation">
          {valuation.map(([k, v]) => (
            <div key={k} className="kv"><span className="muted">{k}</span><span className="num">{v}</span></div>
          ))}
          <Provenance
            sources={f.sources || []}
            assumptions={[f.demo ? 'Backend offline: demo values shown' : 'Latest values reported by Yahoo Finance', 'TTM = trailing twelve months', 'Fiscal years follow each company’s own calendar', 'Debt/Equity shown as a ratio (1.00 = equal)']}
          />
        </Card>
      </div>
    </>
  );
}
