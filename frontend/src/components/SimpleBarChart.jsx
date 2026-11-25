import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID_LINE, linesBetweenColumns } from '../chartGrid'
import { xAxisTitle, yAxisTitle } from '../chartAxis'
import { CHART_COLORS } from '../utils'
import ChartClickHint from './ChartClickHint'
import ChartLegend from './ChartLegend'
import { useChartHeight } from './ExpandableChart'

/**
 * Plain bar chart. Each item is { label, fullLabel, value } where a null value means "not judged".
 */
export default function SimpleBarChart({ data, color, unit = '', height = 240, legendLabel = 'Value', onBarClick, clickHint = 'Click a bar to see the details.', xLabel, yLabel }) {
  const chartHeight = useChartHeight(height, 520)

  const rows = data.map((item) => ({
    ...item,
    shown: item.value ?? 0,
    text: item.value === null || item.value === undefined ? 'n/a' : `${item.value}${unit}`,
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

  const legendItems = [
    { color, label: legendLabel },
    ...(rows.some((row) => row.value === null || row.value === undefined)
      ? [{ color: CHART_COLORS.skipped, label: 'Not assessed' }]
      : []),
  ]

  if (rows.length === 0) {
    return (
      <>
        <p className="muted">No data is available for this year selection.</p>
        <ChartLegend items={legendItems} />
      </>
    )
  }

  return (
    <>
      <div className={onBarClick ? 'clickable-chart' : undefined}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={rows} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_LINE} verticalCoordinatesGenerator={linesBetweenColumns(rows.length)} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} height={xLabel ? 46 : 30} label={xLabel ? xAxisTitle(xLabel) : undefined} />
          <YAxis
            tick={{ fontSize: 11 }}
            width={yLabel ? 60 : 36}
            allowDecimals={false}
            tickFormatter={(value) => `${value}${unit}`}
            label={yLabel ? yAxisTitle(yLabel) : undefined}
          />
          <Tooltip content={tooltip} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="shown" radius={[3, 3, 0, 0]} onClick={onBarClick}>
            {rows.map((row) => (
              <Cell
                key={row.label}
                fill={row.value === null || row.value === undefined ? CHART_COLORS.skipped : color}
              />
            ))}
            <LabelList dataKey="text" position="top" fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
      <ChartLegend items={legendItems} />
      {onBarClick && <ChartClickHint>{clickHint}</ChartClickHint>}
    </>
  )
}
