import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { VERDICTS } from '../components/DistrictDetail'
import DistrictTable from '../components/DistrictTable'
import RiskBadge from '../components/RiskBadge'
import StatCard from '../components/StatCard'
import { formatPercent } from '../utils'
import OverviewPage from './OverviewPage'

export default function DistrictsPage({ districts, overview, selectedId, onSelect }) {
  const district = districts.find((item) => item.id === selectedId)

  if (!district) {
    return <DistrictTable districts={districts} selectedId={selectedId} onSelect={onSelect} />
  }

  const { summary } = district

  return (
    <>
      <div className="panel district-hero">
        <button
          type="button"
          className="district-back"
          onClick={() => {
            onSelect(null)
            window.scrollTo(0, 0)
          }}
        >
          <ArrowLeftIcon className="icon" aria-hidden="true" />
          All districts
        </button>

        <div className="district-hero-title">
          <div>
            <h2>{district.name}</h2>
            <p className="muted">{district.province}</p>
          </div>
          <RiskBadge level={summary.risk_level} />
        </div>

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
            label="Satellite data coverage"
            value={`${summary.satellite_window_months} of 12 months`}
            hint="April 2023 to March 2024"
          />
          <StatCard label="Gap with households" value={`${summary.basis_risk_pct} points`} hint="Under 25 low, 25 to 50 medium, over 50 high" />
        </div>
        <p className="verdict">{VERDICTS[summary.direction]}</p>
      </div>

      {/* Keyed by district so the page starts fresh (survey choice, years) for each district. */}
      <OverviewPage key={district.id} districts={districts} overview={overview} lockedDistrictId={district.id} />
    </>
  )
}
