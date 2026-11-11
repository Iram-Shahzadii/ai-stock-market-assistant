import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/Icon';
import { Badge, Card, DataTable, Provenance, Skeleton } from '../components/ui';
import { sendChat } from '../api/client';
import { TICKERS, getQuote } from '../data/mock';
import { fmtPrice, fmtPct, tone } from '../lib/format';

const SUGGESTIONS = [
  'Give me a technical summary of NVDA',
  'Is AAPL overbought right now?',
  'Compare MSFT valuation with AAPL',
  'What happens to TSLA if it drops 20%?',
];

// Render **bold** markdown only (keeps it simple and safe)
function Rich({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p>
      {parts.map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </p>
  );
}

const msgAnim = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: ['Hello! I can analyse US stocks with charts, indicators, fundamentals, comparisons and what-if scenarios. Every answer shows its sources and assumptions.'],
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, steps]);

  async function ask(text) {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: [q] }]);
    setBusy(true);
    setSteps([]);
    try {
      const res = await sendChat(q, (s) => setSteps((x) => [...x, s]));
      setMessages((m) => [...m, { role: 'ai', ...res }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: [`Sorry, something went wrong: ${e.message}`] }]);
    } finally {
      setBusy(false);
      setSteps([]);
    }
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
                    {m.ticker && (
                      <div className="row" style={{ marginBottom: 8 }}>
                        <Badge tone="info">{m.ticker}</Badge>
                        <Badge tone="neutral">3 tools used</Badge>
                      </div>
                    )}
                    {m.text.map((t, j) => <Rich key={j} text={t} />)}
                    {m.table && (
                      <div style={{ marginTop: 10 }}>
                        <DataTable columns={m.table.columns} rows={m.table.rows} align={['l', 'r']} />
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
                      {steps.map((s) => (
                        <motion.div key={s} className="tool-step" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
                          <Icon name="check" size={14} className="gain" /> {s}
                        </motion.div>
                      ))}
                      <div className="typing"><span /><span /><span /></div>
                      <Skeleton h={10} w="90%" />
                      <Skeleton h={10} w="70%" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {messages.length === 1 && !busy && (
              <motion.div className="suggestions" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.3 } }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip-btn" onClick={() => ask(s)}>{s}</button>
                ))}
              </motion.div>
            )}
          </div>

          <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input
              className="input"
              placeholder="Ask about a stock, e.g. “Technical summary of AAPL”"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button className="btn btn-primary" disabled={busy || !input.trim()}>
              <Icon name="send" size={16} /> Send
            </button>
          </form>
        </Card>

        <div className="chat-aside stack">
          <Card title="Watchlist" i={1}>
            {TICKERS.map((t) => {
              const q = getQuote(t.symbol);
              return (
                <div key={t.symbol} className="kv">
                  <div>
                    <div className="mono">{t.symbol}</div>
                    <div className="body-sm muted">{t.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num">{fmtPrice(q.price)}</div>
                    <div className={`num body-sm ${tone(q.changePct)}`}>{fmtPct(q.changePct)}</div>
                  </div>
                </div>
              );
            })}
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
