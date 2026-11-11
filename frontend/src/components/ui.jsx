// Reusable UI pieces following the Institutional Sovereign design system
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useId } from 'react';
import Icon from './Icon';

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] } }),
};

export function Card({ title, action, children, className = '', i = 0, compact, lift }) {
  return (
    <motion.section
      className={`card ${compact ? 'compact' : ''} ${lift ? 'hover-lift' : ''} ${className}`}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      custom={i}
    >
      {(title || action) && (
        <div className="card-head">
          {title && <h3 className="card-title">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}

export function Badge({ tone = 'neutral', dot, pulse, children }) {
  return (
    <span className={`badge badge-${tone} ${pulse ? 'pulse' : ''}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function Skeleton({ h = 16, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}

export function ProgressBar({ value, running }) {
  return (
    <div className="progress">
      <motion.div
        className={`progress-bar ${running ? 'running' : ''}`}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

// Animated number counter (prices tick up on load)
export function AnimatedNumber({ value, decimals = 2, prefix = '', suffix = '', className = '' }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) =>
    `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
  );
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return c.stop;
  }, [value, mv]);
  return <motion.span className={`num ${className}`}>{text}</motion.span>;
}

// Segmented control with sliding background
export function Segmented({ options, value, onChange }) {
  const id = useId();
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        const on = v === value;
        return (
          <button key={v} className={on ? 'on' : ''} onClick={() => onChange(v)} role="tab" aria-selected={on}>
            {on && <motion.span layoutId={`seg-${id}`} className="seg-bg" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Data table: 44px rows, 1px dividers, numbers right-aligned, rows animate in
export function DataTable({ columns, rows, align }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} style={{ textAlign: align?.[i] === 'r' ? 'right' : 'left' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <motion.tr
              key={ri}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + ri * 0.04, duration: 0.3 }}
            >
              {r.map((cell, ci) => (
                <td key={ci} className={align?.[ci] === 'r' ? 'r' : ''}>{cell}</td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Sources + assumptions block shown under every answer / analysis
export function Provenance({ sources = [], assumptions = [] }) {
  return (
    <div className="provenance">
      <details open>
        <summary><Icon name="source" size={14} /> Sources ({sources.length})</summary>
        <ul>
          {sources.map((s) => (
            <li key={s.label}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary><Icon name="info" size={14} /> Assumptions ({assumptions.length})</summary>
        <ul>
          {assumptions.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </details>
    </div>
  );
}

export function TickerSelect({ value, onChange, tickers }) {
  return (
    <select className="select mono" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Ticker">
      {tickers.map((t) => (
        <option key={t.symbol} value={t.symbol}>{t.symbol} — {t.name}</option>
      ))}
    </select>
  );
}
