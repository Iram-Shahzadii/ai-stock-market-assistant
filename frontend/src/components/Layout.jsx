import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';
import { Badge } from './ui';
import { fmtPrice, fmtPct, tone } from '../lib/format';
import { fetchQuotes, getHealth } from '../api/client';
import { useApi } from '../lib/useApi';

const NAV = [
  { to: '/', label: 'Assistant', icon: 'chat' },
  { to: '/chart', label: 'Technicals', icon: 'chart' },
  { to: '/fundamentals', label: 'Fundamentals', icon: 'table' },
  { to: '/compare', label: 'Compare', icon: 'compare' },
  { to: '/what-if', label: 'What-if', icon: 'whatif' },
  { to: '/jobs', label: 'Analyses', icon: 'jobs' },
];

function TickerTape() {
  const { data } = useApi(() => fetchQuotes(), []);
  const items = data?.list ?? [];
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className="ticker-tape">
      <div className="ticker-tape-inner">
        {row.map((q, i) => (
          <span key={i} className="row label-md">
            <span>{q.symbol}</span>
            <span className="num">{fmtPrice(q.price)}</span>
            <span className={`num ${tone(q.changePct)}`}>{fmtPct(q.changePct)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const { data: health } = useApi(() => getHealth(), []);
  const live = health && !health.demo;
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="16" height="16" viewBox="0 0 32 32"><path d="M6 22l6-7 5 4 9-10" fill="none" stroke="#4edea3" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div className="brand-name">Sovereign</div>
            <div className="label-sm muted">AI Stock Assistant</div>
          </div>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-active" className="nav-indicator" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                <Icon name={n.icon} />
                <span className="nav-text">{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <div className="sidebar-foot stack" style={{ gap: 8 }}>
          <Badge tone={live ? 'gain' : 'warn'} dot pulse>{live ? 'BACKEND LIVE' : 'DEMO DATA'}</Badge>
          {live && (
            <span className="label-sm muted">
              AI: {health.ai === 'gemini' ? health.model : 'auto summary'} · MCP: {health.mcp ? 'on' : 'local'}
            </span>
          )}
          <span className="body-sm muted">Educational analysis only. Not financial advice.</span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <TickerTape />
          <Badge tone="info" dot>US MARKETS</Badge>
        </header>
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            className="page"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
