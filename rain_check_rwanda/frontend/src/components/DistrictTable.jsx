import { useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { formatPercent } from '../utils'
import ChartInfo from './ChartInfo'
import RiskBadge from './RiskBadge'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'High risk' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

export default function DistrictTable({ districts, selectedId, onSelect }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const visible = districts.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' || d.summary.risk_level === filter),
  )

  return (
    <div className="panel">
      <div className="toolbar">
        <div className="tabs">
          {FILTERS.map(({ id, label }) => (
            <button key={id} className={filter === id ? 'tab active' : 'tab'} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <MagnifyingGlassIcon className="icon" />
          <input
            placeholder="Search district"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>District</th>
              <th>Province</th>
              <th>Poverty rate</th>
              <th>Households that reported drought</th>
              <th>Dry months each year</th>
              <th>Dry months, Apr 2023 to Mar 2024</th>
              <th>Gap with households</th>
              <th>Mismatch risk</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((district) => (
              <tr
                key={district.id}
                className={district.id === selectedId ? 'selected' : ''}
                onClick={() => onSelect(district.id)}
              >
                <td>{district.name}</td>
                <td>{district.province}</td>
                <td>{formatPercent(district.poverty_rate)}</td>
                <td>{formatPercent(district.household_drought_pct)}</td>
                <td>{district.summary.avg_dry_months_per_year}</td>
                <td>{district.summary.satellite_drought_months}</td>
                <td>{district.summary.basis_risk_pct} points</td>
                <td>
                  <RiskBadge level={district.summary.risk_level} />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8}>No districts match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ChartInfo
        shows="One row for each district: poverty rate, households that reported drought, dry months seen by the satellite, and the gap between the satellite and households."
        howToRead="Click a district to see its charts. The gap is the difference between two scores from 0 to 100: one for the satellite's dry months and one for households that reported drought. Under 25 is low mismatch risk, 25 to 50 is medium, and over 50 is high."
        sources={['rainfall', 'cfsva', 'eicvPoverty']}
      />
    </div>
  )
}
