import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge, Card, ProgressBar, Provenance } from '../components/ui';
import Icon from '../components/Icon';
import { getJob, listJobs, retryJob, submitJob } from '../api/client';
import { TICKERS } from '../data/mock';

const STATUS = {
  queued: { tone: 'neutral', label: 'QUEUED' },
  running: { tone: 'info', label: 'RUNNING' },
  retrying: { tone: 'warn', label: 'RETRYING' },
  success: { tone: 'gain', label: 'SAVED' },
  failed: { tone: 'loss', label: 'FAILED' },
};
const FILTERS = ['all', 'running', 'success', 'failed'];
const PIPELINE = ['Queued', 'Fetch data', 'Sandbox run', 'Save result'];
const TYPES = [
  { value: 'projection', label: 'Monte Carlo projection' },
  { value: 'what_if', label: 'What-if (-20% shock)' },
  { value: 'backtest_sma', label: 'Backtest SMA 20/50' },
  { value: 'compare', label: 'Compare with MSFT' },
];
const active = (j) => ['queued', 'running', 'retrying'].includes(j.status);
const fmtTime = (iso) => (iso ? iso.replace('T', ' ').replace('+00:00', ' UTC') : '');

function ResultView({ job }) {
  const r = job.result;
  if (!r) return <p className="body-sm muted">{job.error || 'No result yet.'}</p>;
  const rows = Object.entries(r).filter(([k, v]) => !['summary', 'assumptions', 'sources', 'p10', 'p50', 'p90', 'equity', 'rows', 'final'].includes(k) && typeof v !== 'object');
  return (
    <div className="stack" style={{ gap: 8 }}>
      <strong>{r.summary}</strong>
      {r.final && Object.entries(r.final).map(([k, v]) => (
        <div key={k} className="kv"><span className="muted">final.{k}</span><span className="num">{v.toLocaleString()}</span></div>
      ))}
      {r.rows && r.rows.map((x) => (
        <div key={x.symbol} className="kv"><span className="mono">{x.symbol}</span><span className="num">{x.returnPct}% · vol {x.volatilityPct}%</span></div>
      ))}
      {rows.map(([k, v]) => (
        <div key={k} className="kv"><span className="muted">{k}</span><span className="num">{String(v)}</span></div>
      ))}
      <Provenance sources={r.sources || []} assumptions={[...(r.assumptions || []), `Engine: ${job.engine}, sandbox: ${job.sandbox || '—'}`]} />
    </div>
  );
}

export default function JobsPage() {
  const [state, setState] = useState({ jobs: [], engine: '…', demo: false, loaded: false });
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ type: 'projection', ticker: 'AAPL', flaky: false });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null); // full job shown in the detail panel

  const refresh = useCallback(async () => {
    const r = await listJobs();
    setState({ ...r, loaded: true });
    return r;
  }, []);

  // Poll every 1.5 s while any job is active (real progress from the worker)
  useEffect(() => {
    let alive = true;
    let timer;
    const tick = async () => {
      const r = await refresh();
      if (!alive) return;
      timer = setTimeout(tick, r.jobs.some(active) ? 1500 : 6000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  async function start() {
    setBusy(true);
    try {
      const params = form.type === 'compare' ? { tickers: [form.ticker, form.ticker === 'MSFT' ? 'AAPL' : 'MSFT'] } : { ticker: form.ticker };
      if (form.flaky) params.demo_fail_first = true;
      await submitJob(form.type, params);
      await refresh();
    } catch (e) {
      alert(`Could not start job: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function retry(id) {
    try {
      await retryJob(id);
      refresh();
    } catch (e) {
      alert(e.message);
    }
  }

  async function show(id) {
    if (state.demo) return;
    setOpen(await getJob(id));
  }

  const { jobs } = state;
  const shown = jobs.filter((j) => filter === 'all' || j.status === filter || (filter === 'running' && active(j)));
  const count = (s) => jobs.filter((j) => (Array.isArray(s) ? s.includes(j.status) : j.status === s)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label-sm muted">Background processing</div>
          <h1 className="h-lg">Analysis Progress &amp; History</h1>
        </div>
        <div className="row wrap">
          <Badge tone={state.demo ? 'warn' : state.engine === 'celery' ? 'gain' : 'info'} dot pulse={!state.demo}>
            {state.demo ? 'DEMO DATA' : state.engine === 'celery' ? 'CELERY + REDIS' : 'LOCAL WORKER'}
          </Badge>
          {FILTERS.map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 'var(--gutter)' }}>
        {[['Running', count(['running', 'retrying']), 'info'], ['Queued', count('queued'), 'neutral'], ['Saved results', count('success'), 'gain'], ['Failed', count('failed'), 'loss']].map(([l, v, t], i) => (
          <Card key={l} className="col-3" compact lift i={i}>
            <div className="body-sm muted">{l}</div>
            <div className={`metric-value ${t === 'neutral' ? '' : t}`}>{v}</div>
          </Card>
        ))}
      </div>

      <div className="grid">
        <Card className="col-8" i={4} title="Task queue">
          {state.loaded && shown.length === 0 && <p className="muted body-sm">No jobs yet. Start one on the right.</p>}
          <motion.div layout className="stack" style={{ gap: 0 }}>
            <AnimatePresence>
              {shown.map((j) => {
                const s = STATUS[j.status] || STATUS.queued;
                const stage = j.status === 'success' ? 4 : j.progress === 0 ? 0 : j.progress < 40 ? 1 : j.progress < 85 ? 2 : 3;
                return (
                  <motion.div
                    key={j.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ padding: '14px 0', borderBottom: '1px solid var(--divider)', cursor: state.demo ? 'default' : 'pointer' }}
                    onClick={() => show(j.id)}
                  >
                    <div className="row between wrap" style={{ marginBottom: 10 }}>
                      <div className="row wrap">
                        <span className="mono muted">{j.id}</span>
                        <strong>{j.label || `${j.type} · ${j.ticker}`}</strong>
                      </div>
                      <div className="row">
                        {j.retries > 0 && <Badge tone="warn">RETRIES {j.retries}/{j.maxRetries || 3}</Badge>}
                        <Badge tone={s.tone} dot pulse={active(j)}>{s.label}</Badge>
                        {j.status === 'failed' && !state.demo && (
                          <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); retry(j.id); }}>
                            <Icon name="refresh" size={14} /> Retry
                          </button>
                        )}
                      </div>
                    </div>
                    <ProgressBar value={j.progress} running={active(j)} />
                    <div className="row between wrap" style={{ marginTop: 8 }}>
                      <div className="segments" style={{ width: 220 }}>
                        {PIPELINE.map((p, i) => (
                          <span key={p} title={p} className={i < stage ? 'done' : i === stage && j.status !== 'failed' ? 'active' : ''} />
                        ))}
                      </div>
                      <span className="body-sm muted">{j.status === 'success' && j.result?.summary ? j.result.summary : j.step}</span>
                      <span className="num body-sm">{j.progress}% · {fmtTime(j.created || j.started)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </Card>

        <div className="col-4 stack">
          <Card i={5} title="Start a background analysis">
            <div className="stack">
              <div className="field">
                <label>Analysis</label>
                <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Ticker</label>
                <select className="select mono" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })}>
                  {TICKERS.map((t) => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                </select>
              </div>
              <label className="row body-sm muted" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={form.flaky} onChange={(e) => setForm({ ...form, flaky: e.target.checked })} />
                Simulate a provider error (shows automatic retry)
              </label>
              <button className="btn btn-primary" onClick={start} disabled={busy || state.demo}>
                <Icon name="spark" size={16} /> {busy ? 'Queuing…' : 'Run in background'}
              </button>
              {state.demo && <span className="body-sm warn">Start the backend to run real jobs.</span>}
            </div>
          </Card>

          <AnimatePresence mode="wait">
            {open && (
              <motion.section
                key={open.id}
                className="card"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                style={{ boxShadow: 'var(--overlay-ring), var(--overlay-shadow)', background: '#242e42', borderRadius: 'var(--radius-lg)' }}
              >
                <div className="card-head">
                  <h3 className="card-title mono">{open.id}</h3>
                  <button className="btn btn-sm btn-ghost" onClick={() => setOpen(null)}>Close</button>
                </div>
                <ResultView job={open} />
                {open.log?.length > 0 && (
                  <details style={{ marginTop: 10 }}>
                    <summary className="label-sm muted" style={{ cursor: 'pointer' }}>Worker log</summary>
                    <pre className="mono body-sm muted" style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{open.log.join('\n')}</pre>
                  </details>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
