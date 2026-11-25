import { useState } from 'react'
import DistrictDetail from '../components/DistrictDetail'
import DistrictMap from '../components/DistrictMap'
import { monthYear } from '../utils'

export default function MapPage({ districts, selectedId, onSelect, comparisonWindow }) {
  const [metric, setMetric] = useState('drought')
  const selectedDistrict = districts.find((district) => district.id === selectedId)
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
      <DistrictMap
        districts={districts}
        metric={metric}
        onSelect={onSelect}
        periodLabel={periodLabel}
        selectedDistrictId={selectedId}
      />
      {selectedDistrict && <DistrictDetail district={selectedDistrict} comparisonWindow={comparisonWindow} />}
    </>
  )
}
