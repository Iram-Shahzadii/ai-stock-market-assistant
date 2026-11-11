import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge, Card, DataTable, Provenance, Segmented, TickerSelect } from '../components/ui';
import { FUNDAMENTALS, TICKERS, MOCK_SOURCES } from '../data/mock';
import { fmtBig, fmtPct, tone } from '../lib/format';

export default function FundamentalsPage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [tab, setTab] = useState('Income');
  const f = FUNDAMENTALS[symbol];
  const inc = f.income;
  const growth = ((inc.at(-1).revenue - inc.at(-2).revenue) / inc.at(-2).revenue) * 100;
  const maxRev = Math.max(...inc.map((r) => r.revenue));

  const valuation = [
    ['Market cap', fmtBig(f.marketCap)],
    ['P/E (TTM)', `${f.pe.toFixed(1)}x`],
    ['Forward P/E', `${f.forwardPe.toFixed(1)}x`],
    ['Price / Book', `${f.pb.toFixed(1)}x`],
    ['Price / Sales', `${f.ps.toFixed(1)}x`],
    ['EV / EBITDA', `${f.evEbitda.toFixed(1)}x`],
    ['Dividend yield', `${f.dividendYield.toFixed(2)}%`],
    ['Beta', f.beta.toFixed(2)],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label-sm muted">Fundamental analysis</div>
          <h1 className="h-lg">Company Performance</h1>
        </div>
        <TickerSelect value={symbol} onChange={setSymbol} tickers={TICKERS} />
      </div>

      <div className="grid" key={symbol}>
        {[
          ['Revenue growth (YoY)', fmtPct(growth), tone(growth)],
          ['Gross margin', `${f.grossMargin.toFixed(1)}%`, 'gain'],
          ['Net margin', `${f.netMargin.toFixed(1)}%`, f.netMargin > 15 ? 'gain' : 'warn'],
          ['Debt / Equity', f.debtToEquity.toFixed(2), f.debtToEquity > 1 ? 'warn' : 'gain'],
        ].map(([label, value, t], i) => (
          <Card key={label} className="col-3" compact lift i={i}>
            <div className="body-sm muted">{label}</div>
            <div className={`metric-value ${t === 'warn' ? 'warn' : ''}`}>{value}</div>
            <Badge tone={t}>{t === 'gain' ? 'Healthy' : t === 'warn' ? 'Watch' : 'Declining'}</Badge>
          </Card>
        ))}

        <Card className="col-8" i={4} title="Financial statements" action={<Segmented options={['Income', 'Earnings']} value={tab} onChange={setTab} />}>
          {tab === 'Income' ? (
            <DataTable
              columns={['Fiscal year', 'Revenue', 'Gross profit', 'Operating income', 'Net income', 'EPS']}
              align={['l', 'r', 'r', 'r', 'r', 'r']}
              rows={inc.map((r) => [r.year, fmtBig(r.revenue), fmtBig(r.grossProfit), fmtBig(r.operatingIncome), fmtBig(r.netIncome), r.eps.toFixed(2)])}
            />
          ) : (
            <DataTable
              columns={['Quarter', 'EPS estimate', 'EPS actual', 'Surprise']}
              align={['l', 'r', 'r', 'r']}
              rows={f.earnings.map((e) => {
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
            sources={MOCK_SOURCES}
            assumptions={['Figures shown are demo values in Hissa A', 'TTM = trailing twelve months', 'Fiscal years follow each company’s own calendar']}
          />
        </Card>
      </div>
    </>
  );
}
