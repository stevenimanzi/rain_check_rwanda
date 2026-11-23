import ChartInfo from '../components/ChartInfo'
import DryMonthsChart from '../components/DryMonthsChart'
import DryPatternCharts from '../components/DryPatternCharts'
import GapChart from '../components/GapChart'
import RainDeviationChart from '../components/RainDeviationChart'
import StatCard from '../components/StatCard'
import Takeaway from '../components/Takeaway'
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
  const biggestGap = districts
    .filter((d) => d.summary.rank_gap !== undefined)
    .sort((a, b) => b.summary.rank_gap - a.summary.rank_gap)[0]
  const judgedMonths = periodMonths.filter((m) => m.judged).length

  // "Highest: A (n unit). Lowest: B (m unit)." Built from the data, with ties listed together.
  const namesAt = (getValue, value) => {
    const names = districts.filter((d) => getValue(d) === value).map((d) => d.name)
    return names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')
  }
  const highLow = (getValue, format) => {
    const values = districts.map(getValue).filter((v) => v !== null && v !== undefined)
    if (!values.length) return null
    const max = Math.max(...values)
    const min = Math.min(...values)
    return `Highest: ${namesAt(getValue, max)} (${format(max)}). Lowest: ${namesAt(getValue, min)} (${format(min)}).`
  }

  const gapExample = biggestGap
    ? `In ${biggestGap.name}, ${biggestGap.household_drought_pct}% of households reported drought, but the satellite saw only ${biggestGap.summary.satellite_drought_months} dry ${biggestGap.summary.satellite_drought_months === 1 ? 'month' : 'months'} there. That is the biggest disagreement in the country.`
    : null

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
        <Takeaway>{gapExample}</Takeaway>
        <GapChart districts={districts} />
        <ChartInfo
          shows={`Each district gets a score from 0 to 100 for the dry months the satellite saw, and another score for the share of households that reported drought. The bar is the difference between the two scores. ${matchText(matchScore)}`}
          howToRead="A short bar means the two agree, so insurance based on rain should work. A long red bar means farmers had drought that the satellite missed, so they may not get paid. A long blue bar means the satellite saw drought that many households did not report. We call this gap mismatch risk (some people call it basis risk)."
          calculation={[
            'Count the dry months the satellite saw in each district (April 2023 to March 2024).',
            'Rank all 30 districts from fewest to most dry months and give each a score from 0 (fewest) to 100 (most).',
            'Do the same for the share of households that reported drought: 0 is the lowest share, 100 the highest.',
            'Bar = household score minus satellite score. Above 0 (red): households had more drought than the satellite saw. Below 0 (blue): the satellite saw more.',
            'Under 25 points apart is low mismatch risk, 25 to 50 is medium, and over 50 is high.',
          ]}
          example="If a district scores 90 for households and 10 for the satellite, the bar is 90 - 10 = +80 and it is drawn in red."
          sources={['rainfall', 'cfsva']}
        />
      </div>

      <div className="panel">
        <h3>Was each month wetter or drier than normal?</h3>
        <p className="muted">Average for all of Rwanda, last 3 years.</p>
        <Takeaway>
          {`Between April 2023 and March 2024, Rwanda had ${dryMonths} dry ${dryMonths === 1 ? 'month' : 'months'} out of ${judgedMonths} months judged (a dry month has at least 20% less rain than normal).`}
        </Takeaway>
        <RainDeviationChart series={national} />
        <ChartInfo
          shows="How much more or less rain fell each month compared with a normal month. We average all 30 districts."
          howToRead="Blue bar: more rain than normal. Red bar: a dry month, at least 20% less rain than normal (below the red dashed line). Grey bar: June to August, when it is normally very dry, so we do not judge it. Move your mouse over a bar to see the exact rain."
          calculation={[
            'Take the rain that fell in the month, averaged over all 30 districts.',
            'Work out a normal month: the typical middle value (the median) of that same calendar month in the other years, 2014 to 2024.',
            'Bar height = (rain - normal) / normal x 100. Above 0% is wetter than normal, below 0% is drier.',
            'If the bar is 20% or more below normal, the month counts as a dry month and turns red.',
            'Months that are normally under 50 mm (June to August) are grey and not judged.',
          ]}
          example="If a normal May has 100 mm and this May had 60 mm, the bar is (60 - 100) / 100 x 100 = -40%. That is below the -20% line, so it is a dry month."
          sources={['rainfall', 'boundaries']}
        />
      </div>

      <DryPatternCharts byYear={byYear} byMonth={byMonth} area="Rwanda" isAverage />

      <div className="grid-2 even">
        <div className="panel">
          <h3>Dry months seen by the satellite</h3>
          <p className="muted">All 30 districts, April 2023 to March 2024.</p>
          <Takeaway>{highLow((d) => d.summary.satellite_drought_months, (v) => `${v} dry ${v === 1 ? 'month' : 'months'}`)}</Takeaway>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.summary.satellite_drought_months}
            unit="dry months"
            color={CHART_COLORS.dry}
            legendLabel="Dry months seen by the satellite"
          />
          <ChartInfo
            shows="How many months had at least 20% less rain than normal, in the 12 months before the April 2024 survey."
            howToRead="A longer bar means more dry months. Now compare with the next chart. The two charts do not match well. That is the mismatch problem."
            calculation={[
              'For each district, look at the 12 months from April 2023 to March 2024.',
              'Count the months with at least 20% less rain than normal (not counting June to August).',
              'Show the districts from the most dry months to the fewest.',
            ]}
            sources={['rainfall', 'boundaries']}
          />
        </div>

        <div className="panel">
          <h3>Households that reported drought</h3>
          <p className="muted">Share of households in each district, 2024.</p>
          <Takeaway>{highLow((d) => d.household_drought_pct, (v) => `${v}% of households`)}</Takeaway>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.household_drought_pct}
            unit="% of households"
            color={CHART_COLORS.normal}
            legendLabel="Share of households that reported drought"
          />
          <ChartInfo
            shows="The share of households that said drought hurt them in the 12 months before the April 2024 survey (CFSVA)."
            howToRead="A longer bar means more households were hit by drought. We measured these numbers from a published chart, so they can be off by about 1 point."
            calculation={[
              'The survey asked households whether drought hurt them in the 12 months before April 2024.',
              'The report shows the share that said yes for each district as a bar in a chart, without printing the numbers.',
              'We measured each bar against its axis to get the percentage, then rounded it.',
            ]}
            sources={['cfsva']}
          />
        </div>
      </div>

      <div className="grid-2 even">
        <div className="panel">
          <h3>Drought risk over many years</h3>
          <p className="muted">Average dry months each year, 2014 to 2024.</p>
          <Takeaway>{highLow((d) => d.summary.avg_dry_months_per_year, (v) => `${v} dry months a year`)}</Takeaway>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.summary.avg_dry_months_per_year}
            unit="dry months a year"
            color={CHART_COLORS.dry}
            legendLabel="Average dry months each year"
          />
          <ChartInfo
            shows="On average, how many months each year have at least 20% less rain than normal."
            howToRead="A longer bar means the district is dry more often. Insurers and planners should look at this long-term risk, not just one year."
            calculation={[
              'For each district, count the dry months in every year from 2014 to 2024.',
              'Add them up and divide by the number of years to get the average dry months per year.',
              'A dry month is one with at least 20% less rain than normal (not counting June to August).',
            ]}
            sources={['rainfall', 'boundaries']}
          />
        </div>

        <div className="panel">
          <h3>Poverty rate by district</h3>
          <p className="muted">Share of people living in poverty, 2023/24.</p>
          <Takeaway>
            {highLow((d) => d.poverty_rate, (v) => `${v}% in poverty`)}
            {' '}For comparison, the national rate is 27.4%.
          </Takeaway>
          <DryMonthsChart
            districts={districts}
            getValue={(d) => d.poverty_rate}
            unit="% in poverty"
            color={CHART_COLORS.rain}
            legendLabel="Share of people living in poverty"
          />
          <ChartInfo
            shows="The official poverty rate of each district, from NISR's EICV7 survey."
            howToRead="A longer bar means more poverty. Districts with high poverty and a big mismatch need the most attention."
            calculation={[
              'NISR surveyed households across the country (EICV7, 2023/24).',
              'A person is counted as poor if their household spending per adult is below the national poverty line. NISR sets that line at the cost of 2,400 calories a day plus basic non-food needs.',
              'The bar is the share of people who are poor in each district (Annex B of the NISR report). Nationally it is 27.4%.',
              'We copy these official numbers as printed. We do not calculate them.',
            ]}
            sources={['eicvPoverty']}
          />
        </div>
      </div>
    </>
  )
}
