import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { RISK_COLORS } from '../utils'
import ChartClickHint from './ChartClickHint'
import ChartDetailsDialog from './ChartDetailsDialog'
import { districtTabs } from './chartDetails'
import ChartInfo from './ChartInfo'
import ExpandableChart, { useChartHeight } from './ExpandableChart'

const LEVELS = [
  { id: 'low', name: 'Agree (low mismatch)', color: RISK_COLORS.low },
  { id: 'medium', name: 'Partly disagree (medium)', color: RISK_COLORS.medium },
  { id: 'high', name: 'Disagree (high mismatch)', color: RISK_COLORS.high },
]

// Donut, legend and details. A separate component so it can read the full-screen state from the dialog around it.
function MismatchBreakdown({ compared, period, noData }) {
  const donutHeight = useChartHeight(320, 480)
  const [selectedLevel, setSelectedLevel] = useState(null)
  const total = compared.length

  const counts = LEVELS.map((level) => ({
    ...level,
    value: compared.filter((d) => d.summary.risk_level === level.id).length,
  }))
  const visible = counts.filter((c) => c.value > 0)
  const disagreeing = compared.filter((d) => d.summary.risk_level !== 'low')
  const householdsHigher = disagreeing.filter((d) => d.summary.rank_gap > 0).length
  const satelliteHigher = disagreeing.length - householdsHigher
  const pct = (value) => Math.round((value / total) * 100)
  const level = LEVELS.find((item) => item.id === selectedLevel)

  return (
    <>
      <div className="mismatch-overview clickable-chart">
        <div
          className="mismatch-donut"
          style={{ height: donutHeight }}
          role="img"
          aria-label={`Districts by mismatch risk: ${counts.map((c) => `${c.name} ${c.value} of ${total}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height={donutHeight}>
            <PieChart>
              <Pie
                data={visible}
                dataKey="value"
                nameKey="name"
                innerRadius="52%"
                outerRadius="82%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={3}
                onClick={(_, index) => setSelectedLevel(visible[index]?.id ?? null)}
              >
                {visible.map((c) => (
                  <Cell key={c.id} fill={c.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} of ${total} districts. Click for details`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mismatch-donut-center">
            <strong>{pct(disagreeing.length)}%</strong>
            <span>disagree</span>
          </div>
        </div>

        <div className="mismatch-summary">
          <ul className="pie-legend mismatch-legend" aria-label="Mismatch risk legend">
            {counts.map((c) => (
              <li key={c.id}>
                <button type="button" className="legend-button" onClick={() => setSelectedLevel(c.id)}>
                  <span className="pie-legend-swatch" style={{ backgroundColor: c.color }} />
                  <span>{c.name}</span>
                  <strong>
                    {c.value} {c.value === 1 ? 'district' : 'districts'} ({pct(c.value)}%)
                  </strong>
                </button>
              </li>
            ))}
          </ul>

          {disagreeing.length > 0 && (
            <div className="mismatch-direction">
              <p>
                <strong>Which way do they disagree?</strong>
              </p>
              <p>
                In <strong>{householdsHigher}</strong> of the {disagreeing.length} districts that disagree, households
                reported more drought than the satellite saw. In <strong>{satelliteHigher}</strong>, the satellite saw
                more drought than households reported.
              </p>
            </div>
          )}
          {noData > 0 && (
            <p className="pie-note">
              {noData} {noData === 1 ? 'district has' : 'districts have'} no household survey data and is not counted.
            </p>
          )}
        </div>
      </div>
      <p className="chart-unit">Unit: number of districts, with their share of all compared districts (%)</p>
      <ChartClickHint>Click a slice or a row to see which districts are in that group.</ChartClickHint>

      {level && (
        <ChartDetailsDialog
          title={level.name}
          subtitle={`${counts.find((c) => c.id === level.id).value} of ${total} districts, ${period}`}
          summary={[
            { label: 'Districts in this group', value: `${counts.find((c) => c.id === level.id).value} of ${total}` },
            { label: 'Share of districts', value: `${pct(counts.find((c) => c.id === level.id).value)}%` },
          ]}
          tabs={districtTabs({
            districts: compared,
            period,
            isHighlighted: (district) => district.summary.risk_level === level.id,
            focusLabel: level.name,
            focusSort: (a, b) => b.summary.basis_risk_pct - a.summary.basis_risk_pct,
          })}
          onClose={() => setSelectedLevel(null)}
        />
      )}
    </>
  )
}

/**
 * One-glance overview of how far the satellite and households agree across all selected districts:
 * the districts are grouped by mismatch risk instead of being listed one by one.
 */
export default function MismatchOverview({ districts, period = 'Apr 2023 to Mar 2024' }) {
  const compared = districts.filter((d) => ['low', 'medium', 'high'].includes(d.summary.risk_level))
  const total = compared.length

  if (!total) return null

  const disagreeing = compared.filter((d) => d.summary.risk_level !== 'low')

  return (
    <ExpandableChart>
      <h3>Where the satellite and households disagree: the big picture</h3>
      <p className="muted">
        {disagreeing.length} of {total} districts show a medium or high gap between what the satellite saw and what
        households reported ({period}).
      </p>

      <MismatchBreakdown compared={compared} period={period} noData={districts.length - total} />

      <ChartInfo
        shows={`Every selected district grouped by how closely the satellite's dry months match the share of households that reported drought, for ${period}.`}
        howToRead="Green districts: the satellite and households agree, so a rainfall-based insurance payout would likely fit what farmers experienced. Orange and red districts: the two disagree, so the satellite could miss drought that households felt, or flag drought they did not. The centre number is the share of districts with a medium or high gap. Click a slice to see its districts in a table."
        sources={['rainfall', 'cfsva']}
      />
    </ExpandableChart>
  )
}
