import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import ChartInfo from './ChartInfo'
import ExpandableChart, { useChartHeight } from './ExpandableChart'
import { CHART_COLORS, formatPercent } from '../utils'
import ChartDetailsDialog from './ChartDetailsDialog'
import ChartClickHint from './ChartClickHint'
import { districtRow, monthColumns, monthRow } from './chartDetails'

const COLORS = {
  drought: CHART_COLORS.dry,
  noDrought: CHART_COLORS.rain,
}

// `buildDetails(sliceName)` returns the props of the table dialog shown when a slice (or legend row) is clicked.
function PercentagePie({ label, unit, data, buildDetails }) {
  const height = useChartHeight(230)
  const [selected, setSelected] = useState(null)
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const chartData = total
    ? data.map((item) => ({ ...item, value: (item.value / total) * 100 }))
    : []

  return (
    <>
      {chartData.length > 0 && buildDetails && (
        <ChartClickHint>Click a slice or a label to see the districts and months behind it.</ChartClickHint>
      )}

      {chartData.length ? (
        <div
          className="country-pie clickable-chart"
          style={{ height }}
          role="img"
          aria-label={`${label}: ${chartData.map(({ name, value }) => `${name} ${value.toFixed(1)}%`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="76.5%"
                labelLine={false}
                onClick={(_, index) => setSelected(chartData[index]?.name ?? null)}
                stroke="var(--card)"
                strokeWidth={3}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                  if (percent < 0.07) return null
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.58
                  const angle = (-midAngle * Math.PI) / 180
                  const x = cx + radius * Math.cos(angle)
                  const y = cy + radius * Math.sin(angle)

                  return (
                    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700}>
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  )
                }}
              >
                {chartData.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted country-pie-empty">No data is available for this comparison.</p>
      )}

      {unit && <p className="chart-unit">Unit: {unit}</p>}

      <ul className="pie-legend" aria-label={`${label} legend`}>
        {data.map(({ name, color, value }) => (
          <li key={name}>
            <button type="button" className="legend-button" onClick={() => setSelected(name)}>
              <span className="pie-legend-swatch" style={{ backgroundColor: color }} />
              <span>{name}</span>
              <strong>{total ? `${((value / total) * 100).toFixed(1)}%` : '—'}</strong>
            </button>
          </li>
        ))}
      </ul>

      {selected && buildDetails && <ChartDetailsDialog {...buildDetails(selected)} onClose={() => setSelected(null)} />}
    </>
  )
}

export default function CountryDroughtCharts({
  districts,
  series,
  startYear,
  endYear,
  area,
  isAllDistricts,
  isSingleDistrict,
  districtCount,
  householdSurveyLabel,
  householdSurveyNote,
  householdSourceName,
  includeCfsvaSource,
}) {
  const satelliteMonths = series.filter((month) => month.year >= startYear && month.year <= endYear && month.judged)
  const periodLabel = startYear === endYear ? String(startYear) : `${startYear} to ${endYear}`
  const satelliteDrought = satelliteMonths.filter((month) => month.satellite_drought).length
  const householdValues = districts
    .map((district) => district.household_drought_pct)
    .filter((value) => value !== null && value !== undefined)
  const householdDrought = householdValues.length
    ? householdValues.reduce((sum, value) => sum + value, 0) / householdValues.length
    : null

  // Satellite pie: the months behind the slice, then every judged month.
  const satelliteDetails = (name) => {
    const wantDrought = name === 'Drought'
    const columns = monthColumns()
    const matches = (month) => Boolean(month.satellite_drought) === wantDrought
    const focus = satelliteMonths.filter(matches)

    return {
      title: `${name} months: ${isAllDistricts ? 'Rwanda' : area}`,
      subtitle: `${focus.length} of ${satelliteMonths.length} judged months, ${periodLabel}`,
      summary: [
        { label: 'Months in this group', value: `${focus.length} of ${satelliteMonths.length}` },
        { label: 'Share of judged months', value: `${satelliteMonths.length ? ((focus.length / satelliteMonths.length) * 100).toFixed(1) : 0}%` },
      ],
      tabs: [
        { id: 'focus', label: `${name} months`, columns, rows: focus.map((month) => monthRow(month, { highlight: true })) },
        {
          id: 'all',
          label: 'All judged months',
          columns,
          rows: satelliteMonths.map((month) => monthRow(month, { highlight: matches(month) })),
        },
      ],
    }
  }

  // Household pie: every district's value, with the clicked side first.
  const householdDetails = (name) => {
    const reported = name === 'Reported drought'
    const columns = [
      { key: 'name', label: 'District' },
      { key: 'province', label: 'Province' },
      { key: 'reported', label: 'Reported drought' },
      { key: 'not', label: 'Did not report drought' },
      { key: 'source', label: 'Source' },
    ]
    const rowFor = (district) => ({
      ...districtRow(district),
      cells: {
        name: district.name,
        province: district.province ?? '-',
        reported: formatPercent(district.household_drought_pct),
        not: formatPercent(Math.round((100 - district.household_drought_pct) * 10) / 10),
        source: district.household_source ?? '-',
      },
    })
    const ranked = [...districts].sort((a, b) =>
      reported ? b.household_drought_pct - a.household_drought_pct : a.household_drought_pct - b.household_drought_pct,
    )

    return {
      title: `${name}: households by district`,
      subtitle: `${districts.length} districts. ${reported ? 'Highest first' : 'Most households without drought first'}.`,
      summary: [
        { label: 'Average across districts', value: householdDrought === null ? '-' : `${(reported ? householdDrought : 100 - householdDrought).toFixed(1)}%` },
        { label: 'Districts with a value', value: String(districts.length) },
      ],
      tabs: [
        { id: 'ranked', label: reported ? 'Highest to lowest' : 'Lowest drought first', columns, rows: ranked.map(rowFor) },
        {
          id: 'alpha',
          label: 'A to Z',
          columns,
          rows: [...districts].sort((a, b) => a.name.localeCompare(b.name)).map(rowFor),
        },
      ],
    }
  }

  return (
    <div className="grid-2 even country-pies">
      <ExpandableChart as="section">
        <h3>How many months did the satellite see drought in {isAllDistricts ? 'Rwanda' : area}?</h3>
        <p className="muted">
          {satelliteDrought} of {satelliteMonths.length} months judged were drought months, {periodLabel}.
        </p>
        <PercentagePie
          label="Satellite rainfall"
          unit="% of the months judged (each slice is a share of 100%)"
          buildDetails={satelliteDetails}
          data={[
            { name: 'Drought', value: satelliteDrought, color: COLORS.drought },
            { name: 'Not drought', value: satelliteMonths.length - satelliteDrought, color: COLORS.noDrought },
          ]}
        />
        <ChartInfo
          shows={`The share of months in ${periodLabel} that the satellite judged to be drought months. ${
            isAllDistricts
              ? 'Each month uses average rainfall across all 30 districts.'
              : isSingleDistrict
                ? `It uses ${area}'s monthly rainfall.`
                : `Each month uses average rainfall across ${districtCount} selected districts.`
          }`}
          howToRead="Red is drought months, blue is months that were not drought. Drought means at least 20% less rain than normal; months that are normally very dry (June to August) are not judged."
          sources={['rainfall']}
        />
      </ExpandableChart>

      <ExpandableChart as="section">
        <h3>How many households said drought hurt them{isAllDistricts ? '' : ` in ${area}`}?</h3>
        <p className="muted">
          {householdDrought === null
            ? 'No household survey data is available.'
            : `${householdDrought.toFixed(1)}% of households ${
                isSingleDistrict ? '' : 'in the average district '
              }reported drought. Source: ${householdSurveyLabel}.`}
        </p>
        <PercentagePie
          label="Household drought reports"
          unit="% of households (each slice is a share of 100%)"
          buildDetails={householdDetails}
          data={[
            {
              name: 'Reported drought',
              value: householdDrought ?? 0,
              color: COLORS.drought,
            },
            {
              name: 'Did not report drought',
              value: householdDrought === null ? 0 : 100 - householdDrought,
              color: COLORS.noDrought,
            },
          ]}
        />
        <ChartInfo
          shows={
            isSingleDistrict
              ? householdSurveyNote
              : `Equal-weighted average of ${householdValues.length} available district percentages, not a population-weighted national estimate. ${householdSurveyNote}`
          }
          howToRead="Red is the share of households that reported drought; blue is the share that did not."
          sourceLabel={householdSourceName}
          sources={includeCfsvaSource ? ['cfsva'] : []}
        />
      </ExpandableChart>
    </div>
  )
}
