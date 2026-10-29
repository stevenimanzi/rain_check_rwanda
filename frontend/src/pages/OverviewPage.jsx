import DryMonthsChart from '../components/DryMonthsChart'
import Notice from '../components/Notice'
import RainDeviationChart from '../components/RainDeviationChart'
import RiskBadge from '../components/RiskBadge'
import StatCard from '../components/StatCard'
import { formatPercent } from '../utils'

export default function OverviewPage({ districts, national, survey, onSelect }) {
  const analysed = districts.filter((d) => d.summary.risk_level !== 'no_data')
  const highRisk = analysed.filter((d) => d.summary.risk_level === 'high')
  const surveyMonths = national.filter((m) => {
    const key = `${m.year}-${String(m.month).padStart(2, '0')}`
    return key >= survey.start && key <= survey.end
  })
  const dryMonths = surveyMonths.filter((m) => m.satellite_drought).length

  const averageRisk = analysed.length
    ? Math.round(analysed.reduce((sum, d) => sum + d.summary.basis_risk_pct, 0) / analysed.length)
    : null

  const riskiest = [...analysed].sort((a, b) => b.summary.basis_risk_pct - a.summary.basis_risk_pct).slice(0, 8)

  return (
    <>
      <div className="stats">
        <StatCard label="Districts covered" value={districts.length} hint="All 30 districts of Rwanda" />
        <StatCard
          label="Dry months across Rwanda"
          value={dryMonths}
          hint={`Out of ${surveyMonths.length} months in the survey period`}
        />
        <StatCard
          label="Satellite vs farmers disagree"
          value={averageRisk === null ? 'Needs survey' : formatPercent(averageRisk)}
          hint="Average basis risk"
        />
        <StatCard label="High-risk districts" value={analysed.length ? highRisk.length : '-'} hint="Insurance may not fit farmers" />
      </div>

      {analysed.length === 0 && (
        <Notice title="Household survey data not imported yet">
          The charts below use real satellite rainfall. Import the EICV7 drought reports (see Method & data)
          to compare it with what households experienced.
        </Notice>
      )}

      <div className="panel">
        <h3>Was each month wetter or drier than normal?</h3>
        <p className="muted">
          Average rainfall across Rwanda. Blue bars: more rain than normal. Red bars: a dry month, when
          rainfall fell at least 20% below normal. Grey bars: normally very dry months (June to August), which are not judged.
        </p>
        <RainDeviationChart series={national} />
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Which districts had the most dry months?</h3>
          <p className="muted">Number of dry months between October 2023 and October 2024.</p>
          <DryMonthsChart districts={districts} />
        </div>

        <div className="panel">
          <h3>Where satellites and farmers disagree most</h3>
          {riskiest.length === 0 ? (
            <p className="muted">
              Insurance that pays out on satellite rainfall only works if the satellite matches what farmers
              experience. This list ranks districts by how often they disagree, once survey data is imported.
            </p>
          ) : (
            <table className="table">
              <tbody>
                {riskiest.map((d) => (
                  <tr key={d.id} onClick={() => onSelect(d.id)}>
                    <td>{d.name}</td>
                    <td>{formatPercent(d.summary.basis_risk_pct)}</td>
                    <td>
                      <RiskBadge level={d.summary.risk_level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
