import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { SOURCES } from '../sources'
import { CHART_COLORS } from '../utils'

const COLORS = {
  drought: CHART_COLORS.dry,
  noDrought: CHART_COLORS.rain,
}

const inWindow = (month, window) => {
  const key = `${month.year}-${String(month.month).padStart(2, '0')}`
  return key >= window.start && key <= window.end
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

export default function CountryDroughtCharts({ districts, national, window }) {
  const satelliteMonths = national.filter((month) => inWindow(month, window) && month.judged)
  const satelliteDrought = satelliteMonths.filter((month) => month.satellite_drought).length
  const householdValues = districts
    .map((district) => district.household_drought_pct)
    .filter((value) => value !== null && value !== undefined)
  const averageHouseholdDrought = householdValues.length
    ? householdValues.reduce((sum, value) => sum + value, 0) / householdValues.length
    : null

  return (
    <div className="grid-2 even country-pies">
      <section className="panel">
        <h3>Satellite rainfall: drought vs. not drought</h3>
        <p className="muted">Share of assessable months for Rwanda, April 2023 to March 2024.</p>
        <PercentagePie
          label="Satellite rainfall"
          data={[
            { name: 'Drought', value: satelliteDrought, color: COLORS.drought },
            { name: 'Not drought', value: satelliteMonths.length - satelliteDrought, color: COLORS.noDrought },
          ]}
        />
        <p className="pie-note">
          Each month uses average rainfall across all 30 districts. Drought means at least 20% below normal; normally very dry months are excluded.
        </p>
        <a className="pie-source" href={SOURCES.rainfall.url} target="_blank" rel="noreferrer">
          Source: CHIRPS v3 satellite rainfall
        </a>
      </section>

      <section className="panel">
        <h3>Households reporting drought</h3>
        <p className="muted">Average district estimate for the same comparison period.</p>
        <PercentagePie
          label="Household drought reports"
          data={[
            {
              name: 'Reported drought',
              value: averageHouseholdDrought ?? 0,
              color: COLORS.drought,
            },
            {
              name: 'Did not report drought',
              value: averageHouseholdDrought === null ? 0 : 100 - averageHouseholdDrought,
              color: COLORS.noDrought,
            },
          ]}
        />
        <p className="pie-note">
          Equal-weighted average of the 30 district percentages, not a population-weighted national estimate.
        </p>
        <a className="pie-source" href={SOURCES.cfsva.url} target="_blank" rel="noreferrer">
          Source: NISR and WFP CFSVA 2024, Figure 8.4
        </a>
      </section>
    </div>
  )
}
