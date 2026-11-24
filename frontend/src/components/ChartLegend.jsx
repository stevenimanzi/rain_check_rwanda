/**
 * Key shown under a chart. Each item is { color, label } and may set `line` to
 * "solid" or "dashed" to draw a line swatch instead of a square.
 */
export default function ChartLegend({ items, title }) {
  return (
    <div className="legend" role="group" aria-label="Chart legend">
      {title && <strong>{title}</strong>}
      {items.map(({ color, label, line }) => (
        <span key={label}>
          <i
            className={line ? `legend-line ${line === true ? 'dashed' : line}` : undefined}
            style={line ? { borderColor: color } : { background: color }}
          />{' '}
          {label}
        </span>
      ))}
    </div>
  )
}
