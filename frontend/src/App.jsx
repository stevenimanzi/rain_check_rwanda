import { useEffect, useState } from 'react'
import { fetchDistricts, fetchOverview } from './api'
import Notice from './components/Notice'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import { PAGES } from './navigation'
import DistrictsPage from './pages/DistrictsPage'
import InstitutionsPage from './pages/InstitutionsPage'
import MapPage from './pages/MapPage'
import OverviewPage from './pages/OverviewPage'
import WhyItMattersPage from './pages/WhyItMattersPage'
import './App.css'

export default function App() {
  const [page, setPage] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [districts, setDistricts] = useState(null)
  const [overview, setOverview] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([fetchDistricts(), fetchOverview()])
      .then(([districtList, overviewData]) => {
        setDistricts(districtList)
        setOverview(overviewData)
      })
      .catch(() => setError(true))
  }, [])

  const goTo = (id) => {
    setPage(id)
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }

  // Picking a district from the overview jumps to its detail page.
  const openDistrict = (id) => {
    setSelectedId(id)
    if (page === 'overview') setPage('districts')
  }

  const renderPage = () => {
    if (error) {
      return <Notice title="Could not load data">Check that the Laravel backend is running on port 8000.</Notice>
    }
    if (!districts || !overview) return <p>Loading...</p>

    const pages = {
      overview: <OverviewPage districts={districts} overview={overview} onSelect={openDistrict} />,
      districts: <DistrictsPage districts={districts} selectedId={selectedId} onSelect={openDistrict} />,
      map: <MapPage districts={districts} selectedId={selectedId} onSelect={openDistrict} />,
      why: <WhyItMattersPage />,
      institutions: <InstitutionsPage districts={districts} overview={overview} onNavigate={goTo} />,
    }
    return pages[page]
  }

  const title = PAGES.find((p) => p.id === page).label

  return (
    <div className="layout">
      <Sidebar page={page} open={menuOpen} onChange={goTo} onClose={() => setMenuOpen(false)} />

      <div className="main">
        <TopBar title={title} onMenuClick={() => setMenuOpen(true)} />
        <main className="content">{renderPage()}</main>
      </div>
    </div>
  )
}
