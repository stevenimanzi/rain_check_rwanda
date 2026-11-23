/**
 * Colour key shown under a chart. Each item is { color, label } and may set `line: true`
 * to draw a dashed line swatch instead of a square.
 */
export default function ChartLegend({ items, title }) {
  return (
    <div className="legend" aria-label="Colour key">
      {title && <strong>{title}</strong>}
      {items.map(({ color, label, line }) => (
        <span key={label}>
          <i className={line ? 'legend-line' : undefined} style={line ? { borderColor: color } : { background: color }} />{' '}
          {label}
        </span>
      ))}
    </div>
  )
}
