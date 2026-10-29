import ChartInfo from '../components/ChartInfo'
import DryMonthsChart from '../components/DryMonthsChart'
import DryPatternCharts from '../components/DryPatternCharts'
import Notice from '../components/Notice'
import RainDeviationChart from '../components/RainDeviationChart'
import RiskBadge from '../components/RiskBadge'
import StatCard from '../components/StatCard'
import { CHART_COLORS, formatPercent } from '../utils'

const inWindow = (month, survey) => {
  const key = `${month.year}-${String(month.month).padStart(2, '0')}`
  return key >= survey.start && key <= survey.end
}

export default function OverviewPage({ districts, overview, onSelect }) {
  const { national, survey, by_year: byYear, by_calendar_month: byMonth } = overview

  const surveyMonths = national.filter((m) => inWindow(m, survey))
  const dryMonths = surveyMonths.filter((m) => m.satellite_drought).length
  const driestYear = [...byYear].sort((a, b) => b.dry_months - a.dry_months)[0]
  const mostProne = [...districts].sort(
    (a, b) => b.summary.avg_dry_months_per_year - a.summary.avg_dry_months_per_year,
  )[0]

  const analysed = districts.filter((d) => d.summary.risk_level !== 'no_data')
  const riskiest = [...analysed].sort((a, b) => b.summary.basis_risk_pct - a.summary.basis_risk_pct).slice(0, 10)

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
          label="Driest year, 2014 to 2024"
          value={driestYear?.year ?? '-'}
          hint={driestYear ? `${driestYear.dry_months} dry months per district on average` : ''}
        />
        <StatCard
          label="Most drought-prone district"
          value={mostProne?.name ?? '-'}
          hint={mostProne ? `${mostProne.summary.avg_dry_months_per_year} dry months a year on average` : ''}
        />
      </div>

      {analysed.length === 0 && (
        <Notice title="Household survey data not imported yet">
          Everything below uses real satellite rainfall. The comparison with what households experienced
          (basis risk) appears once the NISR EICV7 drought reports are imported.
        </Notice>
      )}

      <div className="panel">
        <h3>Was each month wetter or drier than normal?</h3>
        <p className="muted">Average rainfall across Rwanda, last 36 months.</p>
        <RainDeviationChart series={national} />
        <ChartInfo
          shows="How much more or less rain fell in each month than in a normal year, averaged over all 30 districts."
          howToRead="Blue bars: more rain than normal. Red bars: a dry month, at least 20% below normal (below the dashed line). Grey bars: June to August, normally very dry, so not judged. Hover a bar for the exact rainfall."
          sources={['rainfall', 'boundaries']}
        />
      </div>

      <DryPatternCharts byYear={byYear} byMonth={byMonth} area="Rwanda" isAverage />

      <div className="grid-2 even">
        <div className="panel">
          <h3>Dry months by district, survey period</h3>
          <p className="muted">All 30 districts, October 2023 to October 2024.</p>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.summary.satellite_drought_months}
            unit="dry months"
            color={CHART_COLORS.dry}
          />
          <ChartInfo
            shows="Number of months in the household survey period when the satellite saw a dry month in each district."
            howToRead="Longer bar, more dry months. The survey period is the same year NISR interviewed households (EICV7), so these months can be compared with what households reported."
            sources={['rainfall', 'boundaries', 'eicv7']}
          />
        </div>

        <div className="panel">
          <h3>Long-term drought risk by district</h3>
          <p className="muted">Average dry months per year, 2014 to 2024.</p>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.summary.avg_dry_months_per_year}
            unit="dry months a year"
            color={CHART_COLORS.normal}
          />
          <ChartInfo
            shows="On average, how many months a year each district has rainfall at least 20% below its normal."
            howToRead="Longer bar, more drought-prone. This is the long-run risk an insurer or planner should price in, not just one year."
            sources={['rainfall', 'boundaries']}
          />
        </div>
      </div>

      <div className="panel">
        <h3>Where satellites and farmers disagree most</h3>
        {riskiest.length === 0 ? (
          <p className="muted">
            Insurance that pays out on satellite rainfall only works if the satellite matches what farmers
            experience. This ranking appears when household survey data is imported.
          </p>
        ) : (
          <table className="table">
            <tbody>
              {riskiest.map((d) => (
                <tr key={d.id} onClick={() => onSelect(d.id)}>
                  <td>{d.name}</td>
                  <td>{formatPercent(d.summary.basis_risk_pct)} of months disagree</td>
                  <td>
                    <RiskBadge level={d.summary.risk_level} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ChartInfo
          shows="The share of months in which the satellite and surveyed households disagree about whether there was a drought. This is called basis risk."
          howToRead="High basis risk: insurance paid on satellite rainfall would often miss real droughts or pay when nothing happened, so it needs a different design there."
          sources={['rainfall', 'eicv7']}
        />
      </div>
    </>
  )
}
