import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartDetailsDialog from './ChartDetailsDialog'
import ChartClickHint from './ChartClickHint'
import { districtColumns, districtRow } from './chartDetails'
import ChartLegend from './ChartLegend'
import { xAxisTitle } from '../chartAxis'
import { CHART_COLORS, RISK_LABELS } from '../utils'

const formatValue = (value) => {
  const number = Number(value)
  return Number.isInteger(number) ? String(number) : number.toFixed(1)
}

/**
 * Every district, from the highest value to the lowest. getValue picks the number to rank by.
 */
export default function DryMonthsChart({ districts, getValue, unit, color, period }) {
  const [selectedName, setSelectedName] = useState(null)
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
  const selected = selectedName ? districts.find((district) => district.name === selectedName) : null
  const selectedRank = selected ? data.findIndex((row) => row.name === selected.name) + 1 : 0
  const selectedValue = selected ? getValue(selected) : null
  const summary = selected
    ? [
        { label: 'This chart', value: selectedValue == null ? 'No data' : `${formatValue(selectedValue)} ${unit}` },
        { label: 'Rank in this chart', value: `${selectedRank} of ${data.length}` },
        { label: 'Province', value: selected.province ?? '-' },
        ...(selected.household_drought_pct != null
          ? [{ label: 'Households that reported drought', value: `${selected.household_drought_pct}%` }]
          : []),
        ...(selected.summary?.satellite_drought_months != null
          ? [{ label: period ? `Dry months, ${period}` : 'Dry months (survey period)', value: String(selected.summary.satellite_drought_months) }]
          : []),
        ...(selected.summary?.risk_level
          ? [{ label: 'Mismatch risk', value: RISK_LABELS[selected.summary.risk_level] ?? selected.summary.risk_level }]
          : []),
      ]
    : []

  return (
    <>
      <div className="clickable-chart">
      <ResponsiveContainer width="100%" height={data.length * 26 + 76}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 8 }}>
          <CartesianGrid vertical stroke="#dbe4ee" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            height={50}
            label={xAxisTitle(`Unit: ${unit}`)}
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
          <Bar
            dataKey="value"
            fill={color}
            radius={[0, 4, 4, 0]}
            barSize={16}
            onClick={(row) => setSelectedName(row.name)}
          >
            {data.map((row) => (
              <Cell key={row.name} fill={row.value === null || row.value === undefined ? CHART_COLORS.skipped : color} />
            ))}
            <LabelList dataKey="label" position="right" fontSize={12} fontWeight={600} fill="#334155" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { color, label: unit },
          ...(hasMissingValues ? [{ color: CHART_COLORS.skipped, label: 'No data' }] : []),
        ]}
      />
      <ChartClickHint>Click a bar to see that district and a table of all districts.</ChartClickHint>

      {selected && (
        <ChartDetailsDialog
          title={selected.name}
          subtitle={`${selected.province ?? ''}${selected.province ? '. ' : ''}All districts are listed below in the order of the chart.`}
          summary={summary}
          tabs={[
            {
              id: 'all',
              label: 'All districts',
              columns: districtColumns(districts, period),
              rows: data.map((row) => {
                const district = districts.find((item) => item.name === row.name)

                return districtRow(district, district.name === selected.name)
              }),
            },
          ]}
          onClose={() => setSelectedName(null)}
        />
      )}
    </>
  )
}
