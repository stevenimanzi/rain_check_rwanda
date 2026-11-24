import DistrictDetail from '../components/DistrictDetail'
import DistrictTable from '../components/DistrictTable'

export default function DistrictsPage({ districts, selectedId, onSelect }) {
  return (
    <>
      <DistrictTable districts={districts} selectedId={selectedId} onSelect={onSelect} />
      {selectedId && <DistrictDetail districtId={selectedId} />}
    </>
  )
}
