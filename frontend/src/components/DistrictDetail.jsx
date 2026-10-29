import { useEffect, useState } from 'react'
import { fetchDistrict } from '../api'
import { formatPercent } from '../utils'
import ChartInfo from './ChartInfo'
import DryPatternCharts from './DryPatternCharts'
import RainDeviationChart from './RainDeviationChart'
import RiskBadge from './RiskBadge'
import StatCard from './StatCard'

const VERDICTS = {
  agrees:
    'The satellite and households tell a similar story here, so rainfall-based insurance looks reliable in this district.',
  satellite_understates:
    'More households reported drought than the satellite ranking suggests. Rainfall-based insurance could leave farmers who lose crops here unpaid.',
  satellite_overstates:
    'The satellite shows more drought than households reported. Rainfall-based insurance could pay out when many farmers did not report a drought.',
}

export default function DistrictDetail({ districtId }) {
  const [district, setDistrict] = useState(null)

  useEffect(() => {
    fetchDistrict(districtId).then(setDistrict)
  }, [districtId])

  if (!district) return <div className="panel">Loading...</div>

  const { summary, history } = district

  return (
    <>
      <div className="panel">
        <h2>
          {district.name} <RiskBadge level={summary.risk_level} />
        </h2>
        <p className="muted">{district.province}</p>

        <h3>Satellite rainfall against what households reported</h3>
        <div className="stats">
          <StatCard
            label="Households reporting drought"
            value={formatPercent(district.household_drought_pct)}
            hint={`Rank score ${Math.round(summary.household_rank_pct)} out of 100`}
          />
          <StatCard
            label="Dry months seen by the satellite"
            value={summary.satellite_drought_months}
            hint={`Apr 2023 to Mar 2024. Rank score ${Math.round(summary.satellite_rank_pct)} out of 100`}
          />
          <StatCard
            label="Poverty rate"
            value={formatPercent(district.poverty_rate)}
            hint="EICV7 2023/24"
          />
          <StatCard
            label="Dry months a year, long term"
            value={summary.avg_dry_months_per_year}
            hint="Average 2014 to 2024"
          />
        </div>
        <p className="verdict">{VERDICTS[summary.direction]}</p>
        <ChartInfo
          shows="Two measures of drought in this district for the same 12 months: the share of households that reported drought (survey) and the number of dry months the satellite saw."
          howToRead={`Each is given a rank score against the other 29 districts (0 is the lowest, 100 the highest). The gap between the two ranks is ${summary.basis_risk_pct} points: below 25 is low basis risk, up to 50 medium, above that high.`}
          sources={['rainfall', 'cfsva', 'eicvPoverty']}
        />

        <h3>Rain compared to normal</h3>
        <RainDeviationChart series={district.rainfall} />
        <ChartInfo
          shows={`How much more or less rain fell in ${district.name} each month than in a normal year, last 36 months.`}
          howToRead="Blue bars: more rain than normal. Red bars: a dry month, at least 20% below normal. Grey bars: June to August, normally very dry, so not judged."
          sources={['rainfall', 'boundaries']}
        />
      </div>

      <DryPatternCharts
        byYear={history.by_year}
        byMonth={history.by_calendar_month}
        area={district.name}
        isAverage={false}
      />
    </>
  )
}
