import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartLegend from './ChartLegend'
import { CHART_COLORS } from '../utils'

const formatValue = (value) => {
  const number = Number(value)
  return Number.isInteger(number) ? String(number) : number.toFixed(1)
}

/**
 * Every district, from the highest value to the lowest. getValue picks the number to rank by.
 */
export default function DryMonthsChart({ districts, getValue, unit, color }) {
  const data = districts
    .map((district) => {
      const value = getValue(district)

      return {
        name: district.name,
        value,
        label: value === null || value === undefined ? 'n/a' : formatValue(value),
      }
    })
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
  const hasMissingValues = data.some((row) => row.value === null || row.value === undefined)

  return (
    <>
      <ResponsiveContainer width="100%" height={data.length * 26 + 56}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 8 }}>
          <CartesianGrid vertical stroke="#dbe4ee" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            height={30}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={{ fontSize: 12, fill: '#334155' }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
          />
          <Tooltip
            formatter={(value) => [value === null || value === undefined ? 'No data' : `${formatValue(value)} ${unit}`, '']}
            cursor={{ fill: 'rgba(29, 79, 145, 0.06)' }}
          />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((row) => (
              <Cell key={row.name} fill={row.value === null || row.value === undefined ? CHART_COLORS.skipped : color} />
            ))}
            <LabelList dataKey="label" position="right" fontSize={12} fontWeight={600} fill="#334155" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { color, label: unit },
          ...(hasMissingValues ? [{ color: CHART_COLORS.skipped, label: 'No data' }] : []),
        ]}
      />
    </>
  )
}
