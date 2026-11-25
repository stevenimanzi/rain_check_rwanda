import { useEffect, useState } from 'react'
import { fetchDistrictRainfall } from '../api'
import { formatPercent, monthYear } from '../utils'
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
  const periodLabel = `${monthYear(comparisonWindow.start)} to ${monthYear(comparisonWindow.end)}`
  const householdScore = summary.household_rank_pct == null
    ? 'Not available'
    : `Score ${Math.round(summary.household_rank_pct)} out of 100`
  const satelliteScore = summary.satellite_rank_pct == null
    ? 'Not available'
    : `Score ${Math.round(summary.satellite_rank_pct)} out of 100`
  const gapValue = summary.basis_risk_pct == null ? 'Not available' : `${summary.basis_risk_pct} points`
  const verdict = VERDICTS[summary.direction] ?? 'There is not enough household survey data to compare this district.'

  return (
    <>
      <div className="panel district-hero">
        <div className="district-hero-title">
          <div>
            <h2>{districtDetails.name}</h2>
            <p className="muted">{districtDetails.province}</p>
          </div>
          <RiskBadge level={summary.risk_level} />
        </div>

        <h3 className="district-summary-heading">Satellite and households compared</h3>
        <div className="stats">
          <StatCard
            label="Households that reported drought"
            value={districtDetails.household_drought_pct == null ? 'No data' : formatPercent(districtDetails.household_drought_pct)}
            hint={householdScore}
          />
          <StatCard
            label="Dry months seen by the satellite"
            value={summary.satellite_drought_months ?? 'No data'}
            hint={`${periodLabel}. ${satelliteScore}`}
          />
          <StatCard
            label="Satellite data coverage"
            value={`${summary.satellite_window_months} of 12 months`}
            hint={periodLabel}
          />
          <StatCard
            label="Gap between scores"
            value={gapValue}
            hint="Under 25: low. 25 to under 50: medium. 50 or more: high."
          />
        </div>
        <div className="verdict">
          <strong>What this means</strong>
          <p>{verdict}</p>
        </div>
        <ChartInfo
          shows={`Two ways of measuring drought for the same period (${periodLabel}): the share of households that reported drought and the dry months the satellite saw.`}
          howToRead={summary.basis_risk_pct == null
            ? 'A comparison score is not available because household survey data is missing for this district.'
            : `Each score ranks the district from 0 to 100 against the other districts. The gap is ${summary.basis_risk_pct} points: under 25 is low mismatch risk, 25 to under 50 is medium, and 50 or more is high.`}
          sources={['rainfall', 'cfsva']}
        />

        <ExpandableChart className="chart-block">
          <h3>Rain compared to normal</h3>
          <RainDeviationChart series={periodRainfall} maxMonths={12} />
          <ChartInfo
            shows={`Monthly rainfall in ${districtDetails.name} compared with normal rainfall, ${periodLabel}.`}
            howToRead="Each month has two bars: rainfall and its historical normal for that calendar month. Red rainfall bars are at least 20% below normal; grey bars are normally very dry and are not assessed."
            sources={['rainfall', 'boundaries']}
          />
        </ExpandableChart>
      </div>
    </>
  )
}
