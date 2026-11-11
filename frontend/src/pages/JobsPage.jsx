import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge, Card, ProgressBar } from '../components/ui';
import Icon from '../components/Icon';
import { MOCK_JOBS } from '../data/mock';

const STATUS = {
  queued: { tone: 'neutral', label: 'QUEUED' },
  running: { tone: 'info', label: 'RUNNING' },
  retrying: { tone: 'warn', label: 'RETRYING' },
  success: { tone: 'gain', label: 'SAVED' },
  failed: { tone: 'loss', label: 'FAILED' },
};
const FILTERS = ['all', 'running', 'success', 'failed'];
const PIPELINE = ['Queued', 'Fetch data', 'Sandbox run', 'Save result'];

export default function JobsPage() {
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [filter, setFilter] = useState('all');

  // Simulate a Celery worker advancing running jobs (Hissa C: real progress from Redis)
  useEffect(() => {
    const t = setInterval(() => {
      setJobs((js) =>
        js.map((j) => {
          if (j.status === 'queued') return { ...j, status: 'running', step: 'Fetching price history', progress: 5 };
          if (j.status === 'running' || j.status === 'retrying') {
            const progress = Math.min(100, j.progress + Math.round(4 + Math.random() * 8));
            return progress >= 100
              ? { ...j, progress: 100, status: 'success', step: 'Saved result' }
              : { ...j, progress, status: 'running', step: progress > 60 ? 'Running script in sandbox' : 'Fetching price history' };
          }
          return j;
        }),
      );
    }, 1200);
    return () => clearInterval(t);
  }, []);

  const retry = (id) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, status: 'retrying', progress: 10, retries: j.retries + 1, step: 'Manual retry queued' } : j)));
  const shown = jobs.filter((j) => filter === 'all' || j.status === filter || (filter === 'running' && j.status === 'retrying'));
  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, jobs.filter((j) => j.status === k).length]));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label-sm muted">Background processing</div>
          <h1 className="h-lg">Analysis Progress &amp; History</h1>
        </div>
        <div className="row wrap">
          {FILTERS.map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 'var(--gutter)' }}>
        {[['Running', counts.running + counts.retrying, 'info'], ['Queued', counts.queued, 'neutral'], ['Saved results', counts.success, 'gain'], ['Failed', counts.failed, 'loss']].map(([l, v, t], i) => (
          <Card key={l} className="col-3" compact lift i={i}>
            <div className="body-sm muted">{l}</div>
            <div className={`metric-value ${t === 'neutral' ? '' : t}`}>{v}</div>
          </Card>
        ))}
      </div>

      <Card i={4} title="Celery task queue">
        <motion.div layout className="stack" style={{ gap: 0 }}>
          <AnimatePresence>
            {shown.map((j) => {
              const s = STATUS[j.status];
              const stage = j.status === 'success' ? 4 : j.progress === 0 ? 0 : j.progress < 40 ? 1 : j.progress < 90 ? 2 : 3;
              return (
                <motion.div
                  key={j.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ padding: '14px 0', borderBottom: '1px solid var(--divider)' }}
                >
                  <div className="row between wrap" style={{ marginBottom: 10 }}>
                    <div className="row wrap">
                      <span className="mono muted">{j.id}</span>
                      <strong>{j.type}</strong>
                      <Badge tone="info">{j.ticker}</Badge>
                    </div>
                    <div className="row">
                      {j.retries > 0 && <Badge tone="warn">RETRIES {j.retries}/3</Badge>}
                      <Badge tone={s.tone} dot pulse={j.status === 'running' || j.status === 'retrying'}>{s.label}</Badge>
                      {j.status === 'failed' && (
                        <button className="btn btn-sm btn-ghost" onClick={() => retry(j.id)}><Icon name="refresh" size={14} /> Retry</button>
                      )}
                    </div>
                  </div>
                  <ProgressBar value={j.progress} running={j.status === 'running' || j.status === 'retrying'} />
                  <div className="row between wrap" style={{ marginTop: 8 }}>
                    <div className="segments" style={{ width: 220 }}>
                      {PIPELINE.map((p, i) => (
                        <span key={p} title={p} className={i < stage ? 'done' : i === stage && j.status !== 'failed' ? 'active' : ''} />
                      ))}
                    </div>
                    <span className="body-sm muted">{j.step}</span>
                    <span className="num body-sm">{j.progress}% · started {j.started}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </Card>
    </>
  );
}
