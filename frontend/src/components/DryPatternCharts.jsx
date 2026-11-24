import { CHART_COLORS, MONTH_NAMES, monthShort } from '../utils'
import ChartInfo from './ChartInfo'
import SimpleBarChart from './SimpleBarChart'

/**
 * Two long-term charts for one area (the whole country or a single district):
 * which years and which months of the year were most often dry.
 * `area` is "Rwanda" or a district name; `isAverage` is true when values are averaged across districts.
 */
export default function DryPatternCharts({
  byYear,
  byMonth,
  area,
  isAverage,
  averageDistrictCount,
  isAllDistricts,
  startYear = 2014,
  endYear = 2024,
}) {
  const averageScope = isAllDistricts
    ? 'all 30 districts'
    : `${averageDistrictCount} selected district${averageDistrictCount === 1 ? '' : 's'}`
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
          {isAverage ? 'Average number of dry months per district each year' : 'Number of dry months'} in {startYear} to {endYear}.
        </p>
        <SimpleBarChart data={yearData} color={CHART_COLORS.dry} />
        <ChartInfo
          shows={`How many months each year had at least 20% less rain than normal${
            isAverage ? `, averaged across ${averageScope}` : ''
          }. We do not count months that are normally very dry.`}
          howToRead="A tall bar is a drought year. In those years farmers lose the most, and drought insurance should pay."
          sources={['rainfall', 'boundaries']}
        />
      </div>

      <div className="panel">
        <h3>Which months are most often dry in {area}?</h3>
        <p className="muted">
          {isAverage
            ? `Share of assessed years when average rainfall across ${averageScope} was dry in each month`
            : 'Share of assessed years when this district was dry in each month'}
          , {startYear} to {endYear}.
        </p>
        <SimpleBarChart data={monthData} color={CHART_COLORS.normal} unit="%" />
        <ChartInfo
          shows={`For each month of the year, the share of years (${startYear} to ${endYear}) when rain was at least 20% below normal${
            isAverage ? ` using average rainfall across ${averageScope}` : ''
          }.`}
          howToRead="A tall bar is a risky month. Grey 'n/a' bars are June to August, which we do not judge. Use this to plan when to sell insurance and run savings campaigns."
          sources={['rainfall', 'boundaries']}
        />
      </div>
    </div>
  )
}
