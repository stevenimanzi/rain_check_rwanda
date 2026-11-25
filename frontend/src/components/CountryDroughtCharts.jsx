import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import ChartInfo from './ChartInfo'
import { CHART_COLORS } from '../utils'

const COLORS = {
  drought: CHART_COLORS.dry,
  noDrought: CHART_COLORS.rain,
}

function PercentagePie({ label, data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const chartData = total
    ? data.map((item) => ({ ...item, value: (item.value / total) * 100 }))
    : []

  return (
    <>
      {chartData.length ? (
        <div
          className="country-pie"
          role="img"
          aria-label={`${label}: ${chartData.map(({ name, value }) => `${name} ${value.toFixed(1)}%`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={88}
                labelLine={false}
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

      <ul className="pie-legend" aria-label={`${label} legend`}>
        {data.map(({ name, color, value }) => (
          <li key={name}>
            <span className="pie-legend-swatch" style={{ backgroundColor: color }} />
            <span>{name}</span>
            <strong>{total ? `${((value / total) * 100).toFixed(1)}%` : '—'}</strong>
          </li>
        ))}
      </ul>
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

  return (
    <div className="grid-2 even country-pies">
      <section className="panel">
        <h3>How many months did the satellite see drought in {isAllDistricts ? 'Rwanda' : area}?</h3>
        <p className="muted">
          {satelliteDrought} of {satelliteMonths.length} months judged were drought months, {periodLabel}.
        </p>
        <PercentagePie
          label="Satellite rainfall"
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
      </section>

      <section className="panel">
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
      </section>
    </div>
  )
}
