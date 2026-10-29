import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { SOURCES } from '../sources'

const USERS = [
  {
    who: 'MINAGRI and RAB (National Agriculture Insurance Scheme)',
    decision: 'Which districts to expand and subsidise drought cover in first.',
    gets: 'Long-term drought risk and the worst drought years for every district.',
    page: 'districts',
    pageLabel: 'Districts',
  },
  {
    who: 'Insurers and reinsurers',
    decision: 'When cover must be sold and where drought triggers can be trusted.',
    gets: 'Which months of the year are most often dry, and where satellite and households disagree.',
    page: 'overview',
    pageLabel: 'Overview',
  },
  {
    who: 'National Bank of Rwanda and MINECOFIN (Financial Inclusion Roadmap 2025-2030)',
    decision: 'Where to focus agriculture insurance and financial health policy.',
    gets: 'A national map of drought exposure next to poverty, with sourced context.',
    page: 'map',
    pageLabel: 'Map',
  },
  {
    who: 'SACCOs, microfinance, NGOs and farmer programmes',
    decision: 'When farmers are most at risk, so loans, savings and cover can be timed.',
    gets: 'Calendar-month dry frequency and district history, free to download.',
    page: 'districts',
    pageLabel: 'Districts',
  },
  {
    who: 'NISR',
    decision: 'How its EICV7 survey can be used with satellite data for official statistics.',
    gets: 'A worked method linking household survey shocks with satellite rainfall.',
    page: 'overview',
    pageLabel: 'Overview',
  },
]

export default function InstitutionsPage({ districts, overview, onNavigate }) {
  const { settings } = overview
  const years = overview.by_year

  const hasReports = districts.some((d) => d.summary.months_tested > 0)
  const hasPoverty = districts.some((d) => d.poverty_rate !== null)

  const datasets = [
    {
      name: 'Satellite rainfall',
      use: 'Dry months, drought years, risky months',
      source: 'rainfall',
      status: `Loaded: ${years[0]?.year} to ${years[years.length - 1]?.year}, all 30 districts`,
      loaded: true,
    },
    {
      name: 'District boundaries',
      use: 'Maps and district averages',
      source: 'boundaries',
      status: 'Loaded: 30 districts',
      loaded: true,
    },
    {
      name: 'Household drought reports',
      use: 'Comparing satellite with what households experienced (basis risk)',
      source: 'eicv7',
      status: hasReports ? 'Loaded' : 'Pending import',
      loaded: hasReports,
    },
    {
      name: 'Poverty rate by district',
      use: 'Showing where drought and poverty overlap',
      source: 'eicv7',
      status: hasPoverty ? 'Loaded' : 'Pending import',
      loaded: hasPoverty,
    },
  ]

  return (
    <>
      <div className="panel">
        <h3>Who this is for</h3>
        <div className="table-scroll">
          <table className="table plain">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Decision it supports</th>
                <th>What RainCheck gives it</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {USERS.map((user) => (
                <tr key={user.who}>
                  <td>
                    <strong>{user.who}</strong>
                  </td>
                  <td>{user.decision}</td>
                  <td>{user.gets}</td>
                  <td>
                    <button className="link-button" onClick={() => onNavigate(user.page)}>
                      Open {user.pageLabel}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3>Download the data</h3>
        <p className="muted">
          Open data for any institution. Both files are CSV, one row per district or per district and month.
        </p>
        <div className="downloads">
          <a className="download" href="/api/export/districts" download>
            <ArrowDownTrayIcon className="icon" />
            <span>
              <strong>District summary</strong>
              <small>Drought history, poverty and basis risk for all 30 districts</small>
            </span>
          </a>
          <a className="download" href="/api/export/rainfall" download>
            <ArrowDownTrayIcon className="icon" />
            <span>
              <strong>Monthly rainfall</strong>
              <small>Rainfall, normal and dry-month flag, every district and month</small>
            </span>
          </a>
        </div>
      </div>

      <div className="panel">
        <h3>Data used and where it comes from</h3>
        <div className="table-scroll">
          <table className="table plain">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Used for</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((dataset) => (
                <tr key={dataset.name}>
                  <td>
                    <strong>{dataset.name}</strong>
                  </td>
                  <td>{dataset.use}</td>
                  <td>
                    <a href={SOURCES[dataset.source].url} target="_blank" rel="noreferrer">
                      {SOURCES[dataset.source].label}
                    </a>
                  </td>
                  <td>
                    <span className={dataset.loaded ? 'status ok' : 'status pending'}>{dataset.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel prose">
        <h3>How we measure</h3>
        <ol>
          <li>
            <strong>Normal rainfall</strong> for a calendar month is the typical (median) rainfall of that
            month in the other years, 2014 to 2024.
          </li>
          <li>
            A <strong>dry month</strong> is one where rainfall is {settings.rainfall_deficit_threshold}% or more
            below normal. Months that normally get under {settings.minimum_normal_mm} mm (the June to August dry
            season) are not judged, because small changes look huge there.
          </li>
          <li>
            A <strong>reported drought</strong> is a month where {settings.reported_drought_threshold}% or more of
            surveyed households in a district say drought was a main problem.
          </li>
          <li>
            <strong>Basis risk</strong> is the share of months where the satellite and households disagree:
            below {settings.basis_risk_medium}% is low, up to {settings.basis_risk_high}% medium, above that high.
          </li>
        </ol>
        <p className="muted">
          Limits: satellite rainfall is an estimate, not a farm measurement, and household reports are
          self-reported. The thresholds can be changed in <code>backend/config/raincheck.php</code>.
        </p>
      </div>

      <div className="panel prose">
        <h3>How to use the dashboard</h3>
        <ul>
          <li>
            <strong>Overview:</strong> national charts. Read the box under each chart for what it shows.
          </li>
          <li>
            <strong>Districts:</strong> search and filter all 30 districts, then click one for its history.
          </li>
          <li>
            <strong>Map:</strong> switch between long-term risk, the survey period and basis risk; click a district.
          </li>
        </ul>
      </div>
    </>
  )
}
