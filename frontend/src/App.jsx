import { useEffect, useState } from 'react'
import { fetchOverview, sendPredictMessages } from './api'
import AssistantWidget from './components/AssistantWidget'
import Notice from './components/Notice'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import useAssistantChat from './components/useAssistantChat'
import { PAGES } from './navigation'
import AssistantPage from './pages/AssistantPage'
import DistrictsPage from './pages/DistrictsPage'
import InstitutionsPage from './pages/InstitutionsPage'
import MapPage from './pages/MapPage'
import OverviewPage from './pages/OverviewPage'
import PredictPage from './pages/PredictPage'
import './App.css'

export default function App() {
  const [page, setPage] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [districts, setDistricts] = useState(null)
  const [overview, setOverview] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState(false)
  const chat = useAssistantChat()
  const predictChat = useAssistantChat(sendPredictMessages)

  useEffect(() => {
    fetchOverview()
      .then((overviewData) => {
        setDistricts(overviewData.districts)
        setOverview(overviewData)
      })
      .catch(() => setError(true))
  }, [])

  const goTo = (id) => {
    setPage(id)
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }


  const renderPage = () => {
    if (page === 'assistant') {
      return <AssistantPage chat={chat} />
    }
    if (page === 'predict') {
      return <PredictPage chat={predictChat} />
    }
    if (error) {
      return <Notice title="Could not load the data">The server did not answer. Please refresh the page in a minute.</Notice>
    }
    if (!districts || !overview) {
      return <Notice title="Loading the data">The server may need up to a minute to wake up if nobody has used the site recently.</Notice>
    }

    const pages = {
      overview: <OverviewPage districts={districts} overview={overview} />,
      districts: <DistrictsPage districts={districts} overview={overview} selectedId={selectedId} onSelect={setSelectedId} />,
      map: <MapPage districts={districts} selectedId={selectedId} onSelect={setSelectedId} comparisonWindow={overview.window} />,
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

      {page !== 'assistant' && page !== 'predict' && <AssistantWidget chat={chat} />}
    </div>
  )
}
