import { useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { formatPercent } from '../utils'
import RiskBadge from './RiskBadge'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'High risk' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
  { id: 'no_data', label: 'No survey data' },
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

      <table className="table">
        <thead>
          <tr>
            <th>District</th>
            <th>Province</th>
            <th>Poverty rate</th>
            <th>Satellite drought months</th>
            <th>Mismatch with households</th>
            <th>Basis risk</th>
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
              <td>{district.summary.satellite_drought_months}</td>
              <td>{formatPercent(district.summary.basis_risk_pct)}</td>
              <td>
                <RiskBadge level={district.summary.risk_level} />
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={6}>No districts match.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
