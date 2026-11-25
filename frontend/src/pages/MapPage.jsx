import { useState } from 'react'
import DistrictMap from '../components/DistrictMap'
import { monthYear } from '../utils'

export default function MapPage({ districts, comparisonWindow }) {
  const [metric, setMetric] = useState('drought')
  const periodLabel = `${monthYear(comparisonWindow.start)} to ${monthYear(comparisonWindow.end)}`
  const metrics = [
    { id: 'drought', label: `Satellite dry months (${periodLabel})` },
    { id: 'households', label: 'Households reporting drought' },
    { id: 'risk', label: 'Mismatch risk' },
  ]

  return (
    <>
      <div className="tabs" role="group" aria-label="Choose what the map shows">
        {metrics.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={metric === id ? 'tab active' : 'tab'}
            aria-pressed={metric === id}
            onClick={() => setMetric(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <DistrictMap districts={districts} metric={metric} periodLabel={periodLabel} />
    </>
  )
}
