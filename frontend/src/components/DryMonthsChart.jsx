import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID_LINE, linesBetweenRows } from '../chartGrid'

/**
 * Every district, from the highest value to the lowest. getValue picks the number to rank by.
 */
export default function DryMonthsChart({ districts, getValue, unit, color }) {
  const data = districts
    .map((d) => ({ name: d.name, value: getValue(d) }))
    .sort((a, b) => b.value - a.value)

  return (
    <ResponsiveContainer width="100%" height={data.length * 26 + 30}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID_LINE} horizontalCoordinatesGenerator={linesBetweenRows(data.length)} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} interval={0} />
        <Tooltip formatter={(value) => [`${value} ${unit}`, '']} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={16}>
          <LabelList dataKey="value" position="right" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
