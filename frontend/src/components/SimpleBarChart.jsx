import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID_LINE, linesBetweenColumns } from '../chartGrid'
import { CHART_COLORS } from '../utils'

/**
 * Plain bar chart. Each item is { label, fullLabel, value } where a null value means "not judged".
 */
export default function SimpleBarChart({ data, color, unit = '', height = 240 }) {
  const rows = data.map((item) => ({
    ...item,
    shown: item.value ?? 0,
    text: item.value === null ? 'n/a' : `${item.value}${unit}`,
  }))

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const row = payload[0].payload

    return (
      <div className="chart-tooltip">
        <strong>{row.fullLabel ?? row.label}</strong>
        <div>{row.value === null ? 'Not judged: this month is normally very dry' : row.text}</div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID_LINE} verticalCoordinatesGenerator={linesBetweenColumns(rows.length)} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
        <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
        <Tooltip content={tooltip} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="shown" radius={[3, 3, 0, 0]}>
          {rows.map((row) => (
            <Cell key={row.label} fill={row.value === null ? CHART_COLORS.skipped : color} />
          ))}
          <LabelList dataKey="text" position="top" fontSize={10} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
