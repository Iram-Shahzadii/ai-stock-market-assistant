import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/Icon';
import LineSvg from '../components/LineSvg';
import { Badge, Card, DataTable, Provenance, Skeleton } from '../components/ui';
import { fetchQuotes, sendChat } from '../api/client';
import { TICKERS } from '../data/mock';
import { fmtBig, fmtPrice, fmtPct, tone } from '../lib/format';
import { useApi } from '../lib/useApi';

const SUGGESTIONS = [
  'Give me a technical summary of NVDA',
  'Is AAPL overbought right now?',
  'Compare MSFT, AAPL and NVDA over 1 year',
  'How strong are TSLA fundamentals?',
];
const THINKING = ['Planning the analysis', 'Calling market-data tools (MCP)', 'Running calculations', 'Writing the answer'];
const COLORS = ['#4edea3', '#adc6ff', '#ffb95f', '#ffb4ab', '#c4a5ff'];

// Minimal safe markdown: **bold**, _italic_, and "- " bullet lists
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('_') && p.endsWith('_') && p.length > 2) return <em key={i} className="muted">{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}
function Rich({ text }) {
  // Group consecutive "- " / "* " lines into a list; other lines stay as paragraphs
  const blocks = [];
  text.split('\n').forEach((line) => {
    const isItem = /^\s*[-*•]\s+/.test(line);
    const last = blocks.at(-1);
    if (isItem) {
      const item = line.replace(/^\s*[-*•]\s+/, '');
      if (last?.type === 'ul') last.items.push(item);
      else blocks.push({ type: 'ul', items: [item] });
    } else if (line.trim()) {
      if (last?.type === 'p') last.lines.push(line);
      else blocks.push({ type: 'p', lines: [line] });
    }
  });
  return blocks.map((b, i) =>
    b.type === 'ul' ? (
      <ul key={i} style={{ margin: '0 0 8px', paddingLeft: 18 }}>
        {b.items.map((it, j) => <li key={j} style={{ marginBottom: 4 }}>{inline(it)}</li>)}
      </ul>
    ) : (
      <p key={i}>{b.lines.map((l, j) => <span key={j}>{inline(l)}{j < b.lines.length - 1 && <br />}</span>)}</p>
    ),
  );
}

const cell = (v) => (typeof v === 'number' ? (Math.abs(v) >= 1e6 ? fmtBig(v) : v.toLocaleString('en-US', { maximumFractionDigits: 2 })) : v ?? '—');

function AnswerChart({ chart }) {
  if (!chart) return null;
  if (chart.type === 'price' && chart.points?.length > 1) {
    const vals = chart.points.map((p) => p.close);
    const up = vals.at(-1) >= vals[0];
    return (
      <div style={{ marginTop: 10 }}>
        <div className="label-sm muted" style={{ marginBottom: 4 }}>{chart.symbol} · last {vals.length} sessions</div>
        <LineSvg series={[{ name: chart.symbol, values: vals, color: up ? '#4edea3' : '#ffb4ab' }]} height={150} yFormat={(v) => v.toFixed(0)} labels={[chart.points[0].time, chart.points.at(-1).time]} />
      </div>
    );
  }
  if (chart.type === 'compare') {
    return (
      <div style={{ marginTop: 10 }}>
        <div className="legend-row" style={{ marginBottom: 4 }}>
          {chart.series.map((s, i) => <span key={s.name}><i style={{ background: COLORS[i % COLORS.length] }} />{s.name}</span>)}
        </div>
        <LineSvg series={chart.series.map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] }))} height={160} labels={['Start (=100)', 'Today']} />
      </div>
    );
  }
  return null;
}

const msgAnim = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: ['Hello! I can analyse US stocks with charts, indicators, fundamentals, comparisons and what-if scenarios. Every answer shows its sources and assumptions.'] },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const scrollRef = useRef(null);
  const { data: quotes } = useApi(() => fetchQuotes(), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, phase, busy]);

  useEffect(() => {
    if (!busy) return undefined;
    setPhase(0);
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, THINKING.length - 1)), 1100);
    return () => clearInterval(t);
  }, [busy]);

  async function ask(text) {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    const history = messages.slice(-10).map((m) => ({ role: m.role, content: (m.text || []).join('\n\n'), ticker: m.ticker || null }));
    setMessages((m) => [...m, { role: 'user', text: [q] }]);
    setBusy(true);
    const res = await sendChat(q, history);
    setMessages((m) => [...m, { role: 'ai', ...res }]);
    setBusy(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label-sm muted">Conversational analysis</div>
          <h1 className="h-lg">Market Assistant</h1>
        </div>
      </div>

      <div className="chat">
        <Card className="chat-panel">
          <div className="chat-scroll" ref={scrollRef}>
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div key={i} className={`msg ${m.role === 'user' ? 'user' : ''}`} {...msgAnim}>
                  <div className={`avatar ${m.role === 'user' ? 'me' : 'ai'}`}>{m.role === 'user' ? 'YOU' : 'AI'}</div>
                  <div className="bubble">
                    {m.tools && (
                      <div className="row wrap" style={{ marginBottom: 8 }}>
                        {m.ticker && <Badge tone="info">{m.ticker}</Badge>}
                        <Badge tone={m.demo ? 'warn' : m.mode === 'gemini' ? 'gain' : 'neutral'}>
                          {m.demo ? 'DEMO' : m.mode === 'gemini' ? 'GEMINI' : 'AUTO SUMMARY'}
                        </Badge>
                        {m.tools.map((t, j) => (
                          <Badge key={j} tone={t.ok ? 'neutral' : 'loss'}>
                            {t.name}{t.transport && t.transport !== '-' ? ` · ${t.transport}` : ''}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {m.text.map((t, j) => <Rich key={j} text={t} />)}
                    <AnswerChart chart={m.chart} />
                    {m.table && (
                      <div style={{ marginTop: 10 }}>
                        <DataTable columns={m.table.columns} rows={m.table.rows.map((r) => r.map(cell))} align={m.table.columns.map((_, k) => (k === 0 ? 'l' : 'r'))} />
                      </div>
                    )}
                    {m.sources && <Provenance sources={m.sources} assumptions={m.assumptions} />}
                  </div>
                </motion.div>
              ))}

              {busy && (
                <motion.div key="thinking" className="msg" {...msgAnim} exit={{ opacity: 0 }}>
                  <div className="avatar ai">AI</div>
                  <div className="bubble" style={{ minWidth: 280 }}>
                    <div className="stack" style={{ gap: 6 }}>
                      {THINKING.slice(0, phase + 1).map((s, k) => (
                        <motion.div key={s} className="tool-step" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
                          {k < phase ? <Icon name="check" size={14} className="gain" /> : <span className="typing"><span /><span /><span /></span>} {s}
                        </motion.div>
                      ))}
                      <Skeleton h={10} w="90%" />
                      <Skeleton h={10} w="70%" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {messages.length === 1 && !busy && (
              <motion.div className="suggestions" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.3 } }}>
                {SUGGESTIONS.map((s) => <button key={s} className="chip-btn" onClick={() => ask(s)}>{s}</button>)}
              </motion.div>
            )}
          </div>

          <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input className="input" placeholder="Ask about a stock, e.g. “Technical summary of AAPL”" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} />
            <button className="btn btn-primary" disabled={busy || !input.trim()}><Icon name="send" size={16} /> Send</button>
          </form>
        </Card>

        <div className="chat-aside stack">
          <Card title="Watchlist" i={1} action={quotes && <Badge tone={quotes.demo ? 'warn' : 'gain'}>{quotes.demo ? 'DEMO' : 'LIVE'}</Badge>}>
            {!quotes ? [0, 1, 2, 3].map((k) => <Skeleton key={k} h={36} style={{ marginBottom: 8 }} />) : quotes.list.map((q) => (
              <div key={q.symbol} className="kv">
                <div>
                  <div className="mono">{q.symbol}</div>
                  <div className="body-sm muted">{TICKERS.find((t) => t.symbol === q.symbol)?.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num">{fmtPrice(q.price)}</div>
                  <div className={`num body-sm ${tone(q.changePct)}`}>{fmtPct(q.changePct)}</div>
                </div>
              </div>
            ))}
          </Card>
          <Card title="What the assistant can do" i={2}>
            <div className="stack" style={{ gap: 8 }}>
              {['Candlesticks, RSI, MACD, moving averages, volume', 'Financial statements, earnings, valuation', 'Python calculations in a sandbox', 'Comparisons, projections, what-if scenarios'].map((x) => (
                <div key={x} className="row body-sm muted"><Icon name="check" size={14} className="gain" /> {x}</div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
