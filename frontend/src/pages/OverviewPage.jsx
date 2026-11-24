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

const matchText = (value) => {
  if (value === null) return ''
  const strength = Math.abs(value) < 0.3 ? 'only a little' : Math.abs(value) < 0.6 ? 'fairly well' : 'very well'
  return `Overall, the satellite and households match ${strength} (match score ${value}, where 1 is a perfect match and 0 is no match).`
}

export default function OverviewPage({ districts, overview }) {
  const { national, window, by_year: byYear, by_calendar_month: byMonth, rank_correlation: matchScore } = overview

  const periodMonths = national.filter((m) => inWindow(m, window))
  const dryMonths = periodMonths.filter((m) => m.satellite_drought).length
  const driestYear = [...byYear].sort((a, b) => b.dry_months - a.dry_months)[0]
  const highRisk = districts.filter((d) => d.summary.risk_level === 'high').length

  return (
    <>
      <p className="intro">
        A dry month is a month with at least 20% less rain than normal. This page compares the dry months that
        satellites measured with what households told NISR about drought.
      </p>

      <div className="stats">
        <StatCard label="Districts covered" value={districts.length} hint="All 30 districts of Rwanda" />
        <StatCard
          label="Dry months in Rwanda"
          value={dryMonths}
          hint={`Out of ${periodMonths.length} months, April 2023 to March 2024`}
        />
        <StatCard
          label="Driest year, 2014 to 2024"
          value={driestYear?.year ?? '-'}
          hint={driestYear ? `On average ${driestYear.dry_months} dry months in each district` : ''}
        />
        <StatCard
          label="Districts with a big mismatch"
          value={`${highRisk} of ${districts.length}`}
          hint="Satellite and households disagree a lot"
        />
      </div>

      <div className="panel">
        <h3>Where the satellite and households disagree</h3>
        <p className="muted">
          Red: more households reported drought than the satellite saw. Blue: the satellite saw more drought
          than households reported.
        </p>
        <GapChart districts={districts} />
        <ChartInfo
          shows={`Each district gets a score from 0 to 100 for the dry months the satellite saw, and another score for the share of households that reported drought. The bar is the difference between the two scores. ${matchText(matchScore)}`}
          howToRead="A short bar means the two agree, so insurance based on rain should work. A long red bar means farmers had drought that the satellite missed, so they may not get paid. A long blue bar means the satellite saw drought that many households did not report. We call this gap mismatch risk (some people call it basis risk)."
          sources={['rainfall', 'cfsva']}
        />
      </div>

      <div className="panel">
        <h3>Was each month wetter or drier than normal?</h3>
        <p className="muted">Average for all of Rwanda, last 3 years.</p>
        <RainDeviationChart series={national} />
        <ChartInfo
          shows="How much more or less rain fell each month compared with a normal month. We average all 30 districts."
          howToRead="Blue bar: more rain than normal. Red bar: a dry month, at least 20% less rain than normal (below the red dashed line). Grey bar: June to August, when it is normally very dry, so we do not judge it. Move your mouse over a bar to see the exact rain."
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
            shows="How many months had at least 20% less rain than normal, in the 12 months before the April 2024 survey."
            howToRead="A longer bar means more dry months. Now compare with the next chart. The two charts do not match well. That is the mismatch problem."
            sources={['rainfall', 'boundaries']}
          />
        </div>

        <div className="panel">
          <h3>Households that reported drought</h3>
          <p className="muted">Share of households in each district, 2024.</p>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.household_drought_pct}
            unit="% of households"
            color={CHART_COLORS.normal}
          />
          <ChartInfo
            shows="The share of households that said drought hurt them in the 12 months before the April 2024 survey (CFSVA)."
            howToRead="A longer bar means more households were hit by drought. We measured these numbers from a published chart, so they can be off by about 1 point."
            sources={['cfsva']}
          />
        </div>
      </div>

      <div className="grid-2 even">
        <div className="panel">
          <h3>Drought risk over many years</h3>
          <p className="muted">Average dry months each year, 2014 to 2024.</p>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.summary.avg_dry_months_per_year}
            unit="dry months a year"
            color={CHART_COLORS.dry}
          />
          <ChartInfo
            shows="On average, how many months each year have at least 20% less rain than normal."
            howToRead="A longer bar means the district is dry more often. Insurers and planners should look at this long-term risk, not just one year."
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
            shows="The official poverty rate of each district, from NISR's EICV7 survey."
            howToRead="A longer bar means more poverty. Districts with high poverty and a big mismatch need the most attention."
            sources={['eicvPoverty']}
          />
        </div>
      </div>
    </>
  )
}
