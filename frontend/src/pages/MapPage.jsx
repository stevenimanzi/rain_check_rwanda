import { useState } from 'react'
import DistrictDetail from '../components/DistrictDetail'
import DistrictMap from '../components/DistrictMap'

const METRICS = {
  history: 'Drought over many years',
  drought: 'Dry months, Apr 2023 to Mar 2024',
  households: 'Households that reported drought',
  risk: 'Mismatch risk',
}

export default function MapPage({ districts, selectedId, onSelect }) {
  const [metric, setMetric] = useState('history')

  return (
    <>
      <div className="tabs">
        {Object.entries(METRICS).map(([id, label]) => (
          <button key={id} className={metric === id ? 'tab active' : 'tab'} onClick={() => setMetric(id)}>
            {label}
          </button>
        ))}
      </div>
      <DistrictMap districts={districts} metric={metric} onSelect={onSelect} />
      {selectedId && <DistrictDetail districtId={selectedId} />}
    </>
  )
}
