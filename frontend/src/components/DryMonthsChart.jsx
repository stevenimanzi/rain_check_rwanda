import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID_LINE, linesBetweenRows } from '../chartGrid'
import ChartLegend from './ChartLegend'
import { CHART_COLORS } from '../utils'

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
        label: value === null || value === undefined ? 'n/a' : value,
      }
    })
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
  const hasMissingValues = data.some((row) => row.value === null || row.value === undefined)

  return (
    <>
      <ResponsiveContainer width="100%" height={data.length * 26 + 30}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_LINE} horizontalCoordinatesGenerator={linesBetweenRows(data.length)} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} interval={0} />
          <Tooltip
            formatter={(value) => [value === null || value === undefined ? 'No data' : `${value} ${unit}`, '']}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((row) => (
              <Cell key={row.name} fill={row.value === null || row.value === undefined ? CHART_COLORS.skipped : color} />
            ))}
            <LabelList dataKey="label" position="right" fontSize={11} />
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
