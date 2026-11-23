import { useEffect, useState } from 'react'
import { fetchDistrict } from '../api'
import { formatPercent } from '../utils'
import ChartInfo from './ChartInfo'
import DryPatternCharts from './DryPatternCharts'
import RainDeviationChart from './RainDeviationChart'
import RiskBadge from './RiskBadge'
import StatCard from './StatCard'
import Takeaway from './Takeaway'

const VERDICTS = {
  agrees:
    'The satellite and households tell the same story here. Insurance based on rain looks reliable in this district.',
  satellite_understates:
    'More households reported drought than the satellite saw. Insurance based on rain could leave farmers who lose crops here unpaid.',
  satellite_overstates:
    'The satellite saw more drought than households reported. Insurance based on rain could pay out when many farmers did not have a drought.',
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

        <h3>Satellite and households compared</h3>
        <div className="stats">
          <StatCard
            label="Households that reported drought"
            value={formatPercent(district.household_drought_pct)}
            hint={`Score ${Math.round(summary.household_rank_pct)} out of 100`}
          />
          <StatCard
            label="Dry months seen by the satellite"
            value={summary.satellite_drought_months}
            hint={`Apr 2023 to Mar 2024. Score ${Math.round(summary.satellite_rank_pct)} out of 100`}
          />
          <StatCard
            label="Poverty rate"
            value={formatPercent(district.poverty_rate)}
            hint="EICV7 survey, 2023/24"
          />
          <StatCard
            label="Dry months each year"
            value={summary.avg_dry_months_per_year}
            hint="Average, 2014 to 2024"
          />
        </div>
        <Takeaway>{VERDICTS[summary.direction]}</Takeaway>
        <ChartInfo
          shows="Two ways of measuring drought for the same 12 months: the share of households that reported drought, and the dry months the satellite saw."
          howToRead={`Each one gets a score from 0 (lowest) to 100 (highest) compared with the other 29 districts. The gap between the two scores is ${summary.basis_risk_pct} points. Under 25 is low mismatch risk, 25 to 50 is medium, and over 50 is high.`}
          calculation={[
            `Households: ${district.name} ranks ${Math.round(summary.household_rank_pct)} out of 100 among the 30 districts for the share of households that reported drought (0 = lowest share, 100 = highest).`,
            `Satellite: ${district.name} ranks ${Math.round(summary.satellite_rank_pct)} out of 100 for dry months from April 2023 to March 2024 (0 = fewest, 100 = most).`,
            `The gap is the difference between the two scores: ${summary.basis_risk_pct} points.`,
          ]}
          sources={['rainfall', 'cfsva', 'eicvPoverty']}
        />

        <h3>Rain compared to normal</h3>
        <Takeaway>
          {`Between April 2023 and March 2024, ${district.name} had ${summary.satellite_drought_months} dry ${summary.satellite_drought_months === 1 ? 'month' : 'months'} (a dry month has at least 20% less rain than normal).`}
        </Takeaway>
        <RainDeviationChart series={district.rainfall} />
        <ChartInfo
          shows={`How much more or less rain ${district.name} had each month compared with a normal month, last 3 years.`}
          howToRead="Blue bar: more rain than normal. Red bar: a dry month, at least 20% less rain than normal. Grey bar: June to August, when it is normally very dry, so we do not judge it."
          calculation={[
            `Take the rain that fell in ${district.name} in the month.`,
            'Work out a normal month: the typical middle value (the median) of that same calendar month in the other years, 2014 to 2024.',
            'Bar height = (rain - normal) / normal x 100. Above 0% is wetter than normal, below 0% is drier.',
            'If the bar is 20% or more below normal, it is a dry month and turns red. June to August are grey and not judged.',
          ]}
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
