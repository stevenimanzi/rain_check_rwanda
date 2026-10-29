import { useEffect, useState } from 'react'
import { fetchDistricts, fetchOverview } from './api'
import Notice from './components/Notice'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import DistrictsPage from './pages/DistrictsPage'
import MapPage from './pages/MapPage'
import MethodPage from './pages/MethodPage'
import OverviewPage from './pages/OverviewPage'
import { PAGES } from './navigation'
import './App.css'

export default function App() {
  const [page, setPage] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [districts, setDistricts] = useState([])
  const [national, setNational] = useState([])
  const [survey, setSurvey] = useState({ start: '', end: '' })
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([fetchDistricts(), fetchOverview()])
      .then(([districtList, overview]) => {
        setDistricts(districtList)
        setNational(overview.national)
        setSurvey(overview.survey)
      })
      .catch(() => setError(true))
  }, [])

  const goTo = (id) => {
    setPage(id)
    setMenuOpen(false)
  }

  // Picking a district from the overview jumps to its detail page.
  const openDistrict = (id) => {
    setSelectedId(id)
    if (page === 'overview') setPage('districts')
  }

  const pages = {
    overview: <OverviewPage districts={districts} national={national} survey={survey} onSelect={openDistrict} />,
    districts: <DistrictsPage districts={districts} selectedId={selectedId} onSelect={openDistrict} />,
    map: <MapPage districts={districts} selectedId={selectedId} onSelect={openDistrict} />,
    method: <MethodPage />,
  }

  const title = PAGES.find((p) => p.id === page).label

  return (
    <div className="layout">
      <Sidebar page={page} open={menuOpen} onChange={goTo} onClose={() => setMenuOpen(false)} />

      <div className="main">
        <TopBar title={title} onMenuClick={() => setMenuOpen(true)} />
        <main className="content">
          {error ? (
            <Notice title="Could not load data">Check that the Laravel backend is running on port 8000.</Notice>
          ) : (
            pages[page]
          )}
        </main>
      </div>
    </div>
  )
}
