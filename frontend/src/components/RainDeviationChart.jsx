import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { GRID_LINE, linesBetweenColumns } from '../chartGrid'
import ChartLegend from './ChartLegend'
import { CHART_COLORS, longMonth, MONTH_NAMES, monthShort } from '../utils'

const MONTHS_SHOWN = 36
const LEGEND_ITEMS = [
  { color: CHART_COLORS.wet, label: 'Rainfall (not marked as drought)' },
  { color: CHART_COLORS.normal, label: 'Normal monthly rainfall' },
  { color: CHART_COLORS.dry, label: 'Rainfall at least 20% below normal' },
  { color: CHART_COLORS.skipped, label: 'Normally very dry; not assessed' },
]

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  return (
    <div className="chart-tooltip">
      <strong>{point.fullLabel}</strong>
      <div>{point.isAverage ? 'Average rainfall' : 'Rainfall'}: {Number(point.rainfall).toFixed(1)} mm</div>
      <div>{point.isAverage ? 'Average normal' : 'Normal'}: {Number(point.normal).toFixed(1)} mm</div>
      {point.judged && (
        <div>
          {Math.abs(point.change).toFixed(1)}% {point.change >= 0 ? 'above' : 'below'} normal
        </div>
      )}
      {point.dry && (
        <div className="tooltip-dry">
          {point.isAverage ? 'Monthly average is at least 20% below normal' : 'Drought month'}
        </div>
      )}
      {!point.judged && <div className="muted">Normally very dry; not assessed</div>}
    </div>
  )
}

/**
 * Paired bars compare monthly rainfall with normal, averaging by calendar month for multi-year ranges.
 */
export default function RainDeviationChart({ series, maxMonths = MONTHS_SHOWN }) {
  const months = maxMonths > 0 ? series.slice(-maxMonths) : []
  const groupedByMonth = new Map()

  months.forEach((month) => {
    const group = groupedByMonth.get(month.month) ?? { months: [], years: new Set() }
    group.months.push(month)
    group.years.add(Number(month.year))
    groupedByMonth.set(month.month, group)
  })

  const data = [...groupedByMonth.entries()]
    .sort(([monthA], [monthB]) => monthA - monthB)
    .map(([monthNumber, group]) => {
      const sampleYears = [...group.years].sort((a, b) => a - b)
      const isAverage = sampleYears.length > 1
      const rainfall = group.months.reduce((sum, month) => sum + Number(month.rainfall_mm), 0) / group.months.length
      const normal = group.months.reduce((sum, month) => sum + Number(month.normal_mm), 0) / group.months.length
      const judged = group.months.every((month) => month.judged)
      const change = normal > 0 ? ((rainfall - normal) / normal) * 100 : 0

      return {
        label: monthShort(monthNumber),
        fullLabel: isAverage
          ? `${MONTH_NAMES[monthNumber - 1]} average, ${sampleYears[0]} to ${sampleYears[sampleYears.length - 1]}`
          : longMonth(group.months[0]),
        rainfall,
        normal,
        change,
        judged,
        dry: judged && change <= -20,
        isAverage,
      }
    })

  if (data.length === 0) {
    return (
      <>
        <p className="muted">No rainfall data is available for this year selection.</p>
        <ChartLegend items={LEGEND_ITEMS} />
      </>
    )
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }} barGap={3}>
          <CartesianGrid {...GRID_LINE} verticalCoordinatesGenerator={linesBetweenColumns(data.length)} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis
            domain={[0, 'auto']}
            tickFormatter={(value) => `${value} mm`}
            tick={{ fontSize: 11 }}
            width={56}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="rainfall" name="Monthly rainfall" maxBarSize={28} radius={[3, 3, 0, 0]}>
            {data.map((point) => {
              const color = !point.judged
                ? CHART_COLORS.skipped
                : point.dry
                  ? CHART_COLORS.dry
                  : CHART_COLORS.wet

              return <Cell key={point.fullLabel} fill={color} />
            })}
          </Bar>
          <Bar
            dataKey="normal"
            name="Normal monthly rainfall"
            fill={CHART_COLORS.normal}
            maxBarSize={28}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend items={LEGEND_ITEMS} />
    </>
  )
}
