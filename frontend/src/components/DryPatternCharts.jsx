import { CHART_COLORS, MONTH_NAMES, monthShort } from '../utils'
import ChartInfo from './ChartInfo'
import SimpleBarChart from './SimpleBarChart'
import Takeaway from './Takeaway'

/**
 * Two long-term charts for one area (the whole country or a single district):
 * which years and which months of the year were most often dry.
 * `area` is "Rwanda" or a district name; `isAverage` is true when values are averaged across districts.
 */
export default function DryPatternCharts({ byYear, byMonth, area, isAverage }) {
  const yearData = byYear.map((row) => ({ label: String(row.year), value: row.dry_months }))
  const monthData = byMonth.map((row) => ({
    label: monthShort(row.month),
    fullLabel: MONTH_NAMES[row.month - 1],
    value: row.dry_pct,
  }))

  const maxYear = Math.max(...byYear.map((row) => row.dry_months))
  const driestYears = byYear.filter((row) => row.dry_months === maxYear).map((row) => row.year)
  const judgedMonths = byMonth.filter((row) => row.dry_pct !== null)
  const maxPct = Math.max(...judgedMonths.map((row) => row.dry_pct))
  const riskiestMonths = judgedMonths.filter((row) => row.dry_pct === maxPct).map((row) => MONTH_NAMES[row.month - 1])

  const yearTakeaway = byYear.length
    ? `${area}'s driest ${driestYears.length > 1 ? 'years were' : 'year was'} ${driestYears.join(' and ')}, with ${maxYear} dry months${isAverage ? ' per district on average' : ''}.`
    : null
  const monthTakeaway = judgedMonths.length
    ? `${riskiestMonths.join(' and ')} ${riskiestMonths.length > 1 ? 'are the months' : 'is the month'} most often dry in ${area}: dry in ${maxPct}% of the years from 2014 to 2024.`
    : null

  return (
    <div className="grid-2 even">
      <div className="panel">
        <h3>Which years were driest in {area}?</h3>
        <p className="muted">
          {isAverage ? 'Average number of dry months in each district' : 'Number of dry months'} each year, 2014 to 2024.
        </p>
        <Takeaway>{yearTakeaway}</Takeaway>
        <SimpleBarChart data={yearData} color={CHART_COLORS.dry} legendLabel="Number of dry months in the year" />
        <ChartInfo
          shows={`How many months each year had at least 20% less rain than normal${
            isAverage ? ' (the average of all 30 districts)' : ''
          }. We do not count June to August, because it is normally very dry.`}
          howToRead="A tall bar is a drought year. In those years farmers lose the most, and drought insurance should pay."
          calculation={[
            `Go through every month of the year, from 2014 to 2024, for ${area}.`,
            'Mark a month as dry if it had at least 20% less rain than normal for that calendar month.',
            isAverage
              ? 'Count the dry months in each year for every district, then take the average across the 30 districts.'
              : 'Count the dry months in each year.',
            'June to August are skipped because they are normally very dry.',
          ]}
          sources={['rainfall', 'boundaries']}
        />
      </div>

      <div className="panel">
        <h3>Which months are most often dry in {area}?</h3>
        <p className="muted">Share of years when each month was dry, 2014 to 2024.</p>
        <Takeaway>{monthTakeaway}</Takeaway>
        <SimpleBarChart
          data={monthData}
          color={CHART_COLORS.normal}
          unit="%"
          legendLabel="Share of years when the month was dry"
        />
        <ChartInfo
          shows={`For each month of the year, the share of years (2014 to 2024) when rain was at least 20% below normal${
            isAverage ? ' (the average of all districts)' : ''
          }.`}
          howToRead="A tall bar is a risky month. Grey 'n/a' bars are June to August, which we do not judge. Use this to plan when to sell insurance and run savings campaigns."
          calculation={[
            'Take one calendar month, for example April, and look at it in each year from 2014 to 2024.',
            'Count the years when that April had at least 20% less rain than normal.',
            'Divide by the number of years and multiply by 100 to get a percentage.',
            ...(isAverage ? ['Take the average of the 30 districts.'] : []),
          ]}
          example="If April was dry in 4 of 11 years, the bar shows 4 / 11 x 100 = 36%."
          sources={['rainfall', 'boundaries']}
        />
      </div>
    </div>
  )
}
