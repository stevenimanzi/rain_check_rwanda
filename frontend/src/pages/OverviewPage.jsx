import ChartInfo from '../components/ChartInfo'
import DryMonthsChart from '../components/DryMonthsChart'
import DryPatternCharts from '../components/DryPatternCharts'
import GapChart from '../components/GapChart'
import RainDeviationChart from '../components/RainDeviationChart'
import StatCard from '../components/StatCard'
import { CHART_COLORS } from '../utils'

const inWindow = (month, window) => {
  const key = `${month.year}-${String(month.month).padStart(2, '0')}`
  return key >= window.start && key <= window.end
}

const correlationText = (value) => {
  if (value === null) return ''
  const strength = Math.abs(value) < 0.3 ? 'weakly' : Math.abs(value) < 0.6 ? 'moderately' : 'strongly'
  return `Across all 30 districts the two rankings agree only ${strength} (correlation ${value}, where 1 is a perfect match and 0 is no relationship).`
}

export default function OverviewPage({ districts, overview }) {
  const { national, window, by_year: byYear, by_calendar_month: byMonth, rank_correlation: correlation } = overview

  const periodMonths = national.filter((m) => inWindow(m, window))
  const dryMonths = periodMonths.filter((m) => m.satellite_drought).length
  const driestYear = [...byYear].sort((a, b) => b.dry_months - a.dry_months)[0]
  const highRisk = districts.filter((d) => d.summary.risk_level === 'high').length

  return (
    <>
      <div className="stats">
        <StatCard label="Districts covered" value={districts.length} hint="All 30 districts of Rwanda" />
        <StatCard
          label="Dry months across Rwanda"
          value={dryMonths}
          hint={`Out of ${periodMonths.length} months, April 2023 to March 2024`}
        />
        <StatCard
          label="Driest year, 2014 to 2024"
          value={driestYear?.year ?? '-'}
          hint={driestYear ? `${driestYear.dry_months} dry months per district on average` : ''}
        />
        <StatCard
          label="High basis risk districts"
          value={`${highRisk} of ${districts.length}`}
          hint="Satellite and households disagree strongly"
        />
      </div>

      <div className="panel">
        <h3>Where satellite rainfall and households disagree</h3>
        <p className="muted">
          Red: more households reported drought than the satellite shows. Blue: the satellite shows more
          drought than households reported.
        </p>
        <GapChart districts={districts} />
        <ChartInfo
          shows={`For each district, how its rank on satellite dry months differs from its rank on the share of households reporting drought (NISR CFSVA 2024), in percentile points. ${correlationText(correlation)}`}
          howToRead="A bar near zero means the two agree, so rainfall-based insurance should work. A long red bar means farmers suffered drought the satellite did not see, so a satellite-paid policy could leave them unpaid. A long blue bar means the satellite flagged drought many households did not report. This gap is called basis risk."
          sources={['rainfall', 'cfsva']}
        />
      </div>

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
          <h3>Dry months seen by the satellite</h3>
          <p className="muted">All 30 districts, April 2023 to March 2024.</p>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.summary.satellite_drought_months}
            unit="dry months"
            color={CHART_COLORS.dry}
          />
          <ChartInfo
            shows="Months in the last 12 before the CFSVA 2024 survey when satellite rainfall was at least 20% below normal."
            howToRead="Longer bar, more dry months. Compare with the next chart: the districts do not line up, which is the basis risk problem."
            sources={['rainfall', 'boundaries']}
          />
        </div>

        <div className="panel">
          <h3>Households reporting drought</h3>
          <p className="muted">Share of households in each district, 2024.</p>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.household_drought_pct}
            unit="% of households"
            color={CHART_COLORS.normal}
          />
          <ChartInfo
            shows="Percentage of households that said drought affected them in the 12 months before the April 2024 CFSVA survey."
            howToRead="Longer bar, more households hit by drought. Values were read from the published chart and are accurate to about one percentage point."
            sources={['cfsva']}
          />
        </div>
      </div>

      <div className="grid-2 even">
        <div className="panel">
          <h3>Long-term drought risk by district</h3>
          <p className="muted">Average dry months per year, 2014 to 2024.</p>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.summary.avg_dry_months_per_year}
            unit="dry months a year"
            color={CHART_COLORS.dry}
          />
          <ChartInfo
            shows="On average, how many months a year each district has rainfall at least 20% below its normal."
            howToRead="Longer bar, more drought-prone. This is the long-run risk an insurer or planner should price in, not just one year."
            sources={['rainfall', 'boundaries']}
          />
        </div>

        <div className="panel">
          <h3>Poverty rate by district</h3>
          <p className="muted">Share of people living in poverty, 2023/24.</p>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.poverty_rate}
            unit="% in poverty"
            color={CHART_COLORS.rain}
          />
          <ChartInfo
            shows="The official headcount poverty rate of each district from the EICV7 household survey."
            howToRead="Longer bar, higher poverty. Districts with high poverty and high basis risk are where weak insurance matters most."
            sources={['eicvPoverty']}
          />
        </div>
      </div>
    </>
  )
}
