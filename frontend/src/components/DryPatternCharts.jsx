import { CHART_COLORS, MONTH_NAMES, monthShort } from '../utils'
import ChartInfo from './ChartInfo'
import SimpleBarChart from './SimpleBarChart'

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

  return (
    <div className="grid-2 even">
      <div className="panel">
        <h3>Which years were driest in {area}?</h3>
        <p className="muted">
          {isAverage ? 'Average number of dry months per district' : 'Number of dry months'} each year, 2014 to 2024.
        </p>
        <SimpleBarChart data={yearData} color={CHART_COLORS.dry} />
        <ChartInfo
          shows={`For each year, how many months the satellite saw rainfall at least 20% below normal${
            isAverage ? ', averaged over all 30 districts' : ''
          }. Months that are normally very dry (under 50 mm) are not counted.`}
          howToRead="A tall bar is a drought year. Years with many dry months are the ones when index insurance should have paid out and when farmers lost most."
          sources={['rainfall', 'boundaries']}
        />
      </div>

      <div className="panel">
        <h3>Which months are most often dry in {area}?</h3>
        <p className="muted">Share of years in which each calendar month was dry, 2014 to 2024.</p>
        <SimpleBarChart data={monthData} color={CHART_COLORS.normal} unit="%" />
        <ChartInfo
          shows={`For each month of the year, the percentage of years (2014 to 2024) in which rainfall was at least 20% below normal${
            isAverage ? ', averaged over all districts' : ''
          }.`}
          howToRead="A tall bar is a risky month. Grey 'n/a' bars are June to August, the normal dry season, which is too dry to judge. Use this to time insurance cover and savings campaigns."
          sources={['rainfall', 'boundaries']}
        />
      </div>
    </div>
  )
}
