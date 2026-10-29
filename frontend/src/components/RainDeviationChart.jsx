import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_COLORS, longMonth, shortMonth } from '../utils'

const DRY_LINE = -20
const MONTHS_SHOWN = 36
const AXIS_LIMIT = 100 // swings beyond this are drawn at the edge so one odd month does not flatten the chart

const barColor = (point) => {
  if (!point.judged) return CHART_COLORS.skipped
  return point.dry ? CHART_COLORS.dry : CHART_COLORS.wet
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const direction = point.change >= 0 ? 'above' : 'below'

  return (
    <div className="chart-tooltip">
      <strong>{point.fullLabel}</strong>
      <div>
        {Math.abs(point.change)}% {direction} normal rainfall
      </div>
      <div className="muted">
        {point.rainfall} mm fell; normal is {point.normal} mm
      </div>
      {point.dry && <div className="tooltip-dry">Dry month</div>}
      {!point.judged && <div className="muted">Normally a very dry month, so not judged</div>}
    </div>
  )
}

/**
 * Bars show how much more (blue) or less (red) rain fell than normal each month.
 * Bars that cross the dashed line are "dry months".
 */
export default function RainDeviationChart({ series }) {
  const data = series.slice(-MONTHS_SHOWN).map((m) => ({
    label: shortMonth(m),
    fullLabel: longMonth(m),
    change: -m.rainfall_deficit_pct,
    barHeight: Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, -m.rainfall_deficit_pct)),
    judged: m.judged,
    rainfall: m.rainfall_mm,
    normal: m.normal_mm,
    dry: m.satellite_drought,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis
          domain={[-AXIS_LIMIT, AXIS_LIMIT]}
          ticks={[-100, -50, 0, 50, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11 }}
          width={48}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <ReferenceLine
          y={DRY_LINE}
          stroke={CHART_COLORS.dry}
          strokeDasharray="5 4"
          label={{ value: 'Dry month line (-20%)', position: 'insideBottomLeft', fontSize: 11, fill: CHART_COLORS.dry }}
        />
        <Bar dataKey="barHeight" radius={[3, 3, 0, 0]}>
          {data.map((point) => (
            <Cell key={point.fullLabel} fill={barColor(point)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
