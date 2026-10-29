import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from '../utils'

const DISTRICTS_SHOWN = 12

/**
 * Districts ranked by how many dry months satellites detected in the survey period.
 */
export default function DryMonthsChart({ districts }) {
  const data = [...districts]
    .map((d) => ({ name: d.name, months: d.summary.satellite_drought_months }))
    .sort((a, b) => b.months - a.months)
    .slice(0, DISTRICTS_SHOWN)

  return (
    <ResponsiveContainer width="100%" height={data.length * 32 + 30}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} interval={0} />
        <Tooltip formatter={(value) => [`${value} dry months`, 'Satellite']} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="months" fill={CHART_COLORS.dry} radius={[0, 4, 4, 0]} barSize={18}>
          <LabelList dataKey="months" position="right" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
