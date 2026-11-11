// Lightweight animated SVG line chart (comparison + projections). Lines "draw" in on load.
import { motion } from 'framer-motion';

export default function LineSvg({ series, height = 260, band, yFormat = (v) => v.toFixed(0), labels }) {
  const W = 800;
  const H = height;
  const pad = { l: 8, r: 56, t: 12, b: 22 };
  const all = series.flatMap((s) => s.values).concat(band ? [...band.upper, ...band.lower] : []);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + t * (max - min));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.05)" />
          <text x={W - pad.r + 6} y={y(t) + 4} fill="#86948a" fontSize="11" fontFamily="JetBrains Mono">{yFormat(t)}</text>
        </g>
      ))}
      {band && (
        <motion.path
          d={`${path(band.upper)}L${band.lower.map((v, i) => `${x(band.lower.length - 1 - i)},${y(band.lower[band.lower.length - 1 - i])}`).join('L')}Z`}
          fill={band.color}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        />
      )}
      {series.map((s, i) => (
        <motion.path
          key={s.name}
          d={path(s.values)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width || 2}
          strokeDasharray={s.dashed ? '6 5' : undefined}
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
      {labels && (
        <>
          <text x={pad.l} y={H - 4} fill="#86948a" fontSize="11" fontFamily="JetBrains Mono">{labels[0]}</text>
          <text x={W - pad.r} y={H - 4} fill="#86948a" fontSize="11" fontFamily="JetBrains Mono" textAnchor="end">{labels[1]}</text>
        </>
      )}
    </svg>
  );
}
