import { useEffect, useState } from 'react'
import { fetchDistrictRainfall } from '../api'
import { formatPercent } from '../utils'
import ChartInfo from './ChartInfo'
import ExpandableChart from './ExpandableChart'
import RainDeviationChart from './RainDeviationChart'
import RiskBadge from './RiskBadge'
import StatCard from './StatCard'

export const VERDICTS = {
  agrees:
    'The satellite and households tell the same story here. Insurance based on rain looks reliable in this district.',
  satellite_understates:
    'More households reported drought than the satellite saw. Insurance based on rain could leave farmers who lose crops here unpaid.',
  satellite_overstates:
    'The satellite saw more drought than households reported. Insurance based on rain could pay out when many farmers did not have a drought.',
}

export default function DistrictDetail({ district, comparisonWindow }) {
  const [districtData, setDistrictData] = useState({ districtId: null, rainfall: null, error: null })

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    fetchDistrictRainfall([district.id], controller.signal, comparisonWindow)
      .then((details) => {
        const selected = details.find((item) => item.id === district.id)
        if (!selected) throw new Error('The selected district rainfall was not returned.')
        if (active) setDistrictData({ districtId: district.id, rainfall: selected.rainfall, error: null })
      })
      .catch((error) => {
        if (active) setDistrictData({
          districtId: district.id,
          rainfall: null,
          error: error.message || 'The district rainfall could not be loaded.',
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [district.id, comparisonWindow])

  const currentDistrictData = districtData.districtId === district.id ? districtData : null
  const rainfall = currentDistrictData?.rainfall ?? null
  const periodRainfall = rainfall?.filter((month) => {
    const key = `${month.year}-${String(month.month).padStart(2, '0')}`

    return key >= comparisonWindow.start && key <= comparisonWindow.end
  })
  const loadError = currentDistrictData?.error

  if (loadError) {
    return <div className="panel" role="alert">Could not load district rainfall: {loadError}</div>
  }
  if (!rainfall) return <div className="panel" role="status">Loading {district.name} rainfall...</div>

  const districtDetails = { ...district, rainfall }
  const { summary } = districtDetails

  return (
    <>
      <div className="panel">
        <h2>
          {districtDetails.name} <RiskBadge level={summary.risk_level} />
        </h2>
        <p className="muted">{districtDetails.province}</p>

        <h3>Satellite and households compared</h3>
        <div className="stats">
          <StatCard
            label="Households that reported drought"
            value={formatPercent(districtDetails.household_drought_pct)}
            hint={`Score ${Math.round(summary.household_rank_pct)} out of 100`}
          />
          <StatCard
            label="Dry months seen by the satellite"
            value={summary.satellite_drought_months}
            hint={`Apr 2023 to Mar 2024. Score ${Math.round(summary.satellite_rank_pct)} out of 100`}
          />
          <StatCard
            label="Satellite data coverage"
            value={`${summary.satellite_window_months} of 12 months`}
            hint="April 2023 to March 2024"
          />
        </div>
        <p className="verdict">{VERDICTS[summary.direction]}</p>
        <ChartInfo
          shows="Two ways of measuring drought for the same 12 months: the share of households that reported drought, and the dry months the satellite saw."
          howToRead={`Each one gets a score from 0 (lowest) to 100 (highest) compared with the other 29 districts. The gap between the two scores is ${summary.basis_risk_pct} points. Under 25 is low mismatch risk, 25 to 50 is medium, and over 50 is high.`}
          sources={['rainfall', 'cfsva']}
        />

        <ExpandableChart className="chart-block">
          <h3>Rain compared to normal</h3>
          <RainDeviationChart series={periodRainfall} maxMonths={12} />
          <ChartInfo
            shows={`Monthly rainfall in ${districtDetails.name} compared with normal rainfall, April 2023 to March 2024.`}
            howToRead="Each month has two bars: rainfall and its historical normal for that calendar month. Red rainfall bars are at least 20% below normal; grey bars are normally very dry and are not assessed."
            sources={['rainfall', 'boundaries']}
          />
        </ExpandableChart>
      </div>
    </>
  )
}
