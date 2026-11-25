import { useState } from 'react'
import { CHART_COLORS, MONTH_NAMES, monthShort } from '../utils'
import ChartDetailsDialog from './ChartDetailsDialog'
import { monthColumns, monthRow } from './chartDetails'
import ChartInfo from './ChartInfo'
import ExpandableChart from './ExpandableChart'
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
  districts = [],
  series = [],
}) {
  // { kind: 'year' | 'month', value } of the clicked bar
  const [selected, setSelected] = useState(null)
  const averageScope = isAllDistricts
    ? 'all 30 districts'
    : `${averageDistrictCount} selected district${averageDistrictCount === 1 ? '' : 's'}`
  const yearData = byYear.map((row) => ({ label: String(row.year), value: row.dry_months }))
  const monthData = byMonth.map((row) => ({
    label: monthShort(row.month),
    fullLabel: MONTH_NAMES[row.month - 1],
    value: row.dry_pct,
  }))
  const periodLabel = startYear === endYear ? String(startYear) : `${startYear} to ${endYear}`

  // Details of a clicked bar: a table of districts when several are shown, otherwise the months behind the bar.
  const buildDetails = () => {
    const perDistrict = districts.length > 1
    const byName = (a, b) => a.name.localeCompare(b.name)

    if (selected.kind === 'year') {
      const year = Number(selected.value)

      if (perDistrict) {
        const rows = districts
          .map((district) => ({
            district,
            dry: district.history.by_year.find((row) => Number(row.year) === year)?.dry_months,
          }))
          .filter((item) => item.dry !== undefined)
          .sort((a, b) => b.dry - a.dry || byName(a.district, b.district))
        const withDry = rows.filter((item) => item.dry > 0).length

        return {
          title: `Dry months in ${year}`,
          subtitle: `${area}. Districts with the most dry months first.`,
          summary: [
            { label: 'Districts with a dry month', value: `${withDry} of ${rows.length}` },
            { label: 'Average dry months', value: rows.length ? (rows.reduce((sum, item) => sum + item.dry, 0) / rows.length).toFixed(1) : '-' },
          ],
          tabs: [
            {
              id: 'districts',
              label: 'All districts',
              columns: [
                { key: 'name', label: 'District' },
                { key: 'province', label: 'Province' },
                { key: 'dry', label: `Dry months in ${year}` },
              ],
              rows: rows.map((item) => ({
                id: item.district.id,
                highlight: item.dry > 0,
                cells: { name: item.district.name, province: item.district.province ?? '-', dry: item.dry },
              })),
            },
          ],
        }
      }

      const months = series.filter((month) => Number(month.year) === year)

      return {
        title: `Months of ${year}`,
        subtitle: `${area}. Each month compared with its normal rainfall.`,
        summary: [
          { label: 'Dry months', value: String(months.filter((month) => month.satellite_drought).length) },
          { label: 'Judged months', value: String(months.filter((month) => month.judged).length) },
        ],
        tabs: [
          {
            id: 'months',
            label: 'All months',
            columns: monthColumns(),
            rows: months.map((month) => monthRow(month, { highlight: Boolean(month.satellite_drought) })),
          },
        ],
      }
    }

    const monthNumber = MONTH_NAMES.indexOf(selected.value) + 1
    const monthName = MONTH_NAMES[monthNumber - 1]

    if (perDistrict) {
      const rows = districts
        .map((district) => ({
          district,
          pct: district.history.by_calendar_month.find((row) => row.month === monthNumber)?.dry_pct,
        }))
        .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || byName(a.district, b.district))

      return {
        title: `${monthName}: how often it is dry`,
        subtitle: `${area}. Share of assessed years when the month was dry. Districts most often dry first.`,
        summary: [
          {
            label: 'Average share',
            value: rows.some((item) => item.pct != null)
              ? `${(rows.filter((item) => item.pct != null).reduce((sum, item) => sum + item.pct, 0) / rows.filter((item) => item.pct != null).length).toFixed(1)}%`
              : 'Not assessed',
          },
        ],
        tabs: [
          {
            id: 'districts',
            label: 'All districts',
            columns: [
              { key: 'name', label: 'District' },
              { key: 'province', label: 'Province' },
              { key: 'pct', label: `Years when ${monthName} was dry` },
            ],
            rows: rows.map((item) => ({
              id: item.district.id,
              highlight: item.pct != null && item.pct >= 50,
              cells: {
                name: item.district.name,
                province: item.district.province ?? '-',
                pct: item.pct == null ? 'Not assessed' : `${item.pct}%`,
              },
            })),
          },
        ],
      }
    }

    const months = series.filter((month) => month.month === monthNumber)

    return {
      title: `${monthName} in each year`,
      subtitle: `${area}. Every ${monthName} compared with its normal rainfall.`,
      summary: [
        { label: 'Dry years', value: String(months.filter((month) => month.satellite_drought).length) },
        { label: 'Judged years', value: String(months.filter((month) => month.judged).length) },
      ],
      tabs: [
        {
          id: 'months',
          label: `All ${monthName}s`,
          columns: monthColumns('Year'),
          rows: months.map((month) => monthRow(month, { label: String(month.year), highlight: Boolean(month.satellite_drought) })),
        },
      ],
    }
  }

  return (
    <div className="grid-2 even">
      {selected && <ChartDetailsDialog {...buildDetails()} onClose={() => setSelected(null)} />}
      <ExpandableChart>
        <h3>Which years were driest in {area}?</h3>
        <p className="muted">
          {isAverage ? 'Average number of dry months per district each year' : 'Number of dry months'} in {periodLabel}.
        </p>
        <SimpleBarChart
          data={yearData}
          color={CHART_COLORS.dry}
          legendLabel="Dry months"
          onBarClick={(row) => setSelected({ kind: 'year', value: row.label })}
        />
        <ChartInfo
          shows={`How many months each year had at least 20% less rain than normal${
            isAverage ? `, averaged across ${averageScope}` : ''
          }. We do not count months that are normally very dry.`}
          howToRead="A tall bar is a drought year. In those years farmers lose the most, and drought insurance should pay."
          sources={['rainfall', 'boundaries']}
        />
      </ExpandableChart>

      <ExpandableChart>
        <h3>Which months are most often dry in {area}?</h3>
        <p className="muted">
          {isAverage
            ? `Share of assessed years when average rainfall across ${averageScope} was dry in each month`
            : 'Share of assessed years when this district was dry in each month'}
          , {periodLabel}.
        </p>
        <SimpleBarChart
          data={monthData}
          color={CHART_COLORS.normal}
          unit="%"
          legendLabel="Share of assessed years with dry months"
          onBarClick={(row) => setSelected({ kind: 'month', value: row.fullLabel })}
        />
        <ChartInfo
          shows={`For each month of the year, the share of years (${periodLabel}) when rain was at least 20% below normal${
            isAverage ? ` using average rainfall across ${averageScope}` : ''
          }.`}
          howToRead="A tall bar is a risky month. Grey 'n/a' bars are June to August, which we do not judge. Use this to plan when to sell insurance and run savings campaigns."
          sources={['rainfall', 'boundaries']}
        />
      </ExpandableChart>
    </div>
  )
}
