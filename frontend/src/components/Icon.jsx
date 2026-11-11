// Small inline icon set (no extra dependency)
const paths = {
  chat: 'M4 5h16v11H8l-4 4V5z',
  chart: 'M4 19V5M4 19h16M8 15l3-4 3 2 5-6',
  table: 'M4 5h16v14H4zM4 10h16M10 10v9',
  compare: 'M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4',
  whatif: 'M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2M12 9a3 3 0 100 6 3 3 0 000-6z',
  jobs: 'M4 6h16M4 12h10M4 18h6M18 14l2 2-2 2M16 16h4',
  send: 'M4 12l16-8-6 16-2-6-8-2z',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  source: 'M6 4h9l3 3v13H6zM9 10h6M9 14h6',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 100 18 9 9 0 000-18z',
  check: 'M5 12l4 4 10-10',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  refresh: 'M4 12a8 8 0 0114-5l2 2M20 4v5h-5M20 12a8 8 0 01-14 5l-2-2M4 20v-5h5',
};

export default function Icon({ name, size = 18, stroke = 1.6, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
