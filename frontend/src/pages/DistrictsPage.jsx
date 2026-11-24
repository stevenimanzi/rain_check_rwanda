import DistrictDetail from '../components/DistrictDetail'
import DistrictTable from '../components/DistrictTable'

export default function DistrictsPage({ districts, selectedId, onSelect }) {
  const selectedDistrict = districts.find((district) => district.id === selectedId)

  return (
    <>
      <DistrictTable districts={districts} selectedId={selectedId} onSelect={onSelect} />
      {selectedDistrict && <DistrictDetail district={selectedDistrict} />}
    </>
  )
}
