import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID_LINE, linesBetweenRows } from '../chartGrid'
import { CHART_COLORS } from '../utils'

/**
 * For every district, the gap between its score for households that reported drought and its score
 * for satellite dry months. Positive: households had more drought than the satellite saw.
 */
export default function GapChart({ districts }) {
  const data = districts
    .filter((d) => d.summary.rank_gap !== undefined)
    .map((d) => ({ name: d.name, gap: d.summary.rank_gap }))
    .sort((a, b) => b.gap - a.gap)

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const { name, gap } = payload[0].payload
    const text =
      Math.abs(gap) < 25
        ? 'The satellite and households mostly agree'
        : gap > 0
          ? 'More households reported drought than the satellite saw'
          : 'The satellite saw more drought than households reported'

    return (
      <div className="chart-tooltip">
        <strong>{name}</strong>
        <div>{text}</div>
        <div className="muted">Gap: {gap > 0 ? '+' : ''}{gap} points (out of 100)</div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={data.length * 24 + 40}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID_LINE} horizontalCoordinatesGenerator={linesBetweenRows(data.length)} />
        <XAxis type="number" domain={[-100, 100]} ticks={[-100, -50, 0, 50, 100]} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} interval={0} />
        <Tooltip content={tooltip} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <ReferenceLine x={0} stroke="#64748b" />
        <Bar dataKey="gap" barSize={14}>
          {data.map((row) => (
            <Cell key={row.name} fill={row.gap >= 0 ? CHART_COLORS.dry : CHART_COLORS.wet} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
