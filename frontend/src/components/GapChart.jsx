import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID_LINE, linesBetweenRows } from '../chartGrid'
import ChartDetailsDialog from './ChartDetailsDialog'
import ChartClickHint from './ChartClickHint'
import { districtColumns, districtRow } from './chartDetails'
import ChartLegend from './ChartLegend'
import { xAxisTitle } from '../chartAxis'
import { CHART_COLORS, RISK_LABELS } from '../utils'

/**
 * For every district, the gap between its score for households that reported drought and its score
 * for satellite dry months. Positive: households had more drought than the satellite saw.
 */
export default function GapChart({ districts, period }) {
  const [selectedName, setSelectedName] = useState(null)
  const data = districts
    .filter((d) => d.summary.rank_gap !== undefined)
    .map((d) => ({ name: d.name, gap: d.summary.rank_gap }))
    .sort((a, b) => b.gap - a.gap)

  const selected = selectedName ? districts.find((district) => district.name === selectedName) : null
  const selectedGap = selected?.summary.rank_gap
  const direction =
    selectedGap === undefined
      ? ''
      : Math.abs(selectedGap) < 25
        ? 'The satellite and households mostly agree'
        : selectedGap > 0
          ? 'More households reported drought than the satellite saw'
          : 'The satellite saw more drought than households reported'

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
    <>
      <ChartClickHint>Click a bar to see that district and a table of all districts.</ChartClickHint>
      <div className="clickable-chart">
      <ResponsiveContainer width="100%" height={data.length * 24 + 64}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_LINE} horizontalCoordinatesGenerator={linesBetweenRows(data.length)} />
          <XAxis
            type="number"
            domain={[-100, 100]}
            ticks={[-100, -50, 0, 50, 100]}
            tick={{ fontSize: 11 }}
            height={46}
            label={xAxisTitle('Gap (score points, on a 0 to 100 scale)')}
          />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} interval={0} />
          <Tooltip content={tooltip} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <ReferenceLine x={0} stroke="#64748b" strokeDasharray="4 4" />
          <Bar dataKey="gap" barSize={14} onClick={(row) => setSelectedName(row.name)}>
            {data.map((row) => (
              <Cell key={row.name} fill={row.gap >= 0 ? CHART_COLORS.dry : CHART_COLORS.wet} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { color: CHART_COLORS.dry, label: 'Households reported more drought' },
          { color: CHART_COLORS.wet, label: 'Satellite indicated more drought' },
          { color: '#64748b', label: 'Same rank (0)', line: 'dashed' },
        ]}
      />

      {selected && selectedGap !== undefined && (
        <ChartDetailsDialog
          title={selected.name}
          subtitle={`${direction}. All districts are listed below, biggest gap first.`}
          summary={[
            { label: 'Gap', value: `${selectedGap > 0 ? '+' : ''}${selectedGap} points` },
            { label: 'Household score', value: `${Math.round(selected.summary.household_rank_pct)} out of 100` },
            { label: 'Satellite score', value: `${Math.round(selected.summary.satellite_rank_pct)} out of 100` },
            { label: 'Mismatch risk', value: RISK_LABELS[selected.summary.risk_level] ?? selected.summary.risk_level },
          ]}
          tabs={[
            {
              id: 'all',
              label: 'All districts',
              columns: districtColumns(districts, period),
              rows: [...districts]
                .filter((district) => district.summary.rank_gap !== undefined)
                .sort((a, b) => b.summary.rank_gap - a.summary.rank_gap)
                .map((district) => districtRow(district, district.name === selected.name)),
            },
          ]}
          onClose={() => setSelectedName(null)}
        />
      )}
    </>
  )
}
