import { useState } from 'react'
import DistrictDetail from '../components/DistrictDetail'
import DistrictMap from '../components/DistrictMap'

const METRICS = {
  history: 'Long-term drought risk',
  drought: 'Dry months, survey period',
  risk: 'Basis risk',
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
