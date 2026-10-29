import { useState } from 'react'
import DistrictDetail from '../components/DistrictDetail'
import DistrictMap from '../components/DistrictMap'
import { METRICS } from '../utils'

export default function MapPage({ districts, selectedId, onSelect }) {
  const [metric, setMetric] = useState('drought')

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
