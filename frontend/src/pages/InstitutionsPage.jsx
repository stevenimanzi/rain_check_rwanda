import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { API_BASE } from '../api'
import { SOURCES } from '../sources'

const USERS = [
  {
    who: 'MINAGRI and RAB (National Agriculture Insurance Scheme)',
    decision: 'Which districts should get drought insurance and support first.',
    gets: 'How often each district has drought, and which years were worst.',
    page: 'districts',
    pageLabel: 'Districts',
  },
  {
    who: 'Insurers and reinsurers',
    decision: 'When to sell insurance, and where rain data can be trusted to trigger payouts.',
    gets: 'Which months are most often dry, and where the satellite and households disagree.',
    page: 'overview',
    pageLabel: 'Overview',
  },
  {
    who: 'National Bank of Rwanda and MINECOFIN (Financial Inclusion Roadmap 2025-2030)',
    decision: 'Where to focus farm insurance and financial health policies.',
    gets: 'A national map of drought and poverty for all 30 districts.',
    page: 'map',
    pageLabel: 'Map',
  },
  {
    who: 'SACCOs, microfinance, NGOs and farmer programmes',
    decision: 'When farmers are most at risk, so loans, savings and insurance can be timed well.',
    gets: 'The months most often dry and each district history, free to download.',
    page: 'districts',
    pageLabel: 'Districts',
  },
  {
    who: 'NISR',
    decision: 'How household surveys (EICV7, CFSVA) can be used together with satellite data.',
    gets: 'A working method that compares household drought reports with satellite rain, district by district.',
    page: 'overview',
    pageLabel: 'Overview',
  },
]

const QUALITY = [
  {
    data: 'Poverty rate by district',
    publisher: 'NISR, EICV7 Poverty Profile (official statistic)',
    period: '2023/24, by district',
    checked:
      'All 30 district values match Annex B of the report. The national rate shown, 27.4%, is the figure printed in the report (95% confidence range 26.4% to 28.4%).',
    limit: 'District rates come from a survey sample, so each has a margin of error.',
  },
  {
    data: 'Households that reported drought',
    publisher: 'NISR and WFP, CFSVA 2024 (official survey)',
    period: 'Asked in April 2024 about the 12 months before, by district',
    checked:
      'The report prints these values only as a bar chart. We measured each bar and cross-checked against figures quoted in the report text (for example Gisagara: 39% in the text, 38.4% measured).',
    limit: 'Accurate to about 1 percentage point. Households answered from memory.',
  },
  {
    data: 'Satellite rainfall',
    publisher: 'Climate Hazards Center, UC Santa Barbara (CHIRPS v3)',
    period: 'Monthly, 2014 to 2024, averaged over each district',
    checked: 'Every district uses the same rule: normal rain is the typical middle value of that month in the other years.',
    limit: 'An estimate on a 5 km grid, not a measurement on a farm. Dry spells shorter than a month are not visible.',
  },
  {
    data: 'District boundaries',
    publisher: 'geoBoundaries (open data)',
    period: '30 districts',
    checked: 'All 30 districts match the districts in both NISR surveys.',
    limit: 'Open boundary file, so edges may differ slightly from official survey boundaries.',
  },
]

export default function InstitutionsPage({ districts, overview, onNavigate }) {
  const { settings } = overview
  const years = overview.by_year

  const hasHouseholds = districts.every((d) => d.household_drought_pct !== null)
  const hasPoverty = districts.every((d) => d.poverty_rate !== null)

  const datasets = [
    {
      name: 'Satellite rainfall',
      use: 'Finding dry months, drought years and risky months',
      source: 'rainfall',
      status: `Loaded: ${years[0]?.year} to ${years[years.length - 1]?.year}, all 30 districts`,
      loaded: true,
    },
    {
      name: 'District boundaries',
      use: 'Drawing maps and averaging by district',
      source: 'boundaries',
      status: 'Loaded: 30 districts',
      loaded: true,
    },
    {
      name: 'Households that reported drought, by district',
      use: 'Comparing the satellite with what households lived through',
      source: 'cfsva',
      status: hasHouseholds ? 'Loaded: 30 districts (measured from a chart, can be off by about 1 point)' : 'Not loaded yet',
      loaded: hasHouseholds,
    },
    {
      name: 'Poverty rate by district',
      use: 'Showing where drought and poverty meet',
      source: 'eicvPoverty',
      status: hasPoverty ? 'Loaded: 30 districts' : 'Not loaded yet',
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
                <th>Decision it helps with</th>
                <th>What RainCheck gives them</th>
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
          Free data for anyone. Both files are CSV files you can open in Excel.
        </p>
        <div className="downloads">
          <a className="download" href={`${API_BASE}/export/districts`} download>
            <ArrowDownTrayIcon className="icon" />
            <span>
              <strong>District summary</strong>
              <small>Drought, poverty and mismatch risk for all 30 districts</small>
            </span>
          </a>
          <a className="download" href={`${API_BASE}/export/rainfall`} download>
            <ArrowDownTrayIcon className="icon" />
            <span>
              <strong>Monthly rainfall</strong>
              <small>Rain, normal rain and dry months for every district and month</small>
            </span>
          </a>
        </div>
      </div>

      <div className="panel">
        <h3>The data we use and where it comes from</h3>
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

      <div className="panel">
        <h3>Data quality and standards</h3>
        <p className="muted">
          Where each number comes from, what we checked, and how accurate it is. Two of the four datasets are
          official NISR statistics.
        </p>
        <div className="table-scroll">
          <table className="table plain">
            <thead>
              <tr>
                <th>Data</th>
                <th>Publisher</th>
                <th>Period and level</th>
                <th>What we checked</th>
                <th>Known limit</th>
              </tr>
            </thead>
            <tbody>
              {QUALITY.map((row) => (
                <tr key={row.data}>
                  <td>
                    <strong>{row.data}</strong>
                  </td>
                  <td>{row.publisher}</td>
                  <td>{row.period}</td>
                  <td>{row.checked}</td>
                  <td>{row.limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4>What this analysis can and cannot show</h4>
        <ul className="plain-list">
          <li>
            <strong>It can show</strong> where satellite rainfall and household reports of drought agree or disagree
            in each district for one year (April 2023 to March 2024).
          </li>
          <li>
            <strong>It cannot show</strong> what an insurance product would have paid, or whether one year is typical.
            It is a first test that tells insurers and ministries where to look more closely.
          </li>
          <li>
            <strong>Open and repeatable:</strong> every number on the charts can be downloaded as a CSV, and the
            thresholds (20% below normal, 50 mm, 25 and 50 points) are in one settings file, so anyone can rerun it.
          </li>
        </ul>
      </div>

      <div className="panel prose">
        <h3>How we measure</h3>
        <ol>
          <li>
            <strong>Normal rain</strong> for a month is the usual amount of rain in that month in the other
            years, 2014 to 2024.
          </li>
          <li>
            A <strong>dry month</strong> is a month with {settings.rainfall_deficit_threshold}% or more less rain than
            normal. We do not judge months that normally get under {settings.minimum_normal_mm} mm of rain (June
            to August), because a tiny change in rain looks like a huge change there.
          </li>
          <li>
            <strong>Households that reported drought</strong> is the share of households in each district that
            said drought hurt them in the 12 months before the April 2024 CFSVA survey (April 2023 to March 2024).
          </li>
          <li>
            Each district gets a score from 0 to 100 for satellite dry months in that same period, and another
            for households that reported drought. <strong>Mismatch risk</strong> (also called basis risk) is the
            gap between the two scores. Under {settings.basis_risk_medium} points is low, up to{' '}
            {settings.basis_risk_high} is medium, and above that is high.
          </li>
        </ol>
        <p className="muted">
          Limits: satellite rain is an estimate for 5 km squares, not a measurement on a farm. Households
          answered from memory. A dry spell shorter than a month does not show up in monthly rain. We measured the
          household numbers from a published chart, so they can be off by about 1 point. You can change the
          settings in <code>backend/config/raincheck.php</code>.
        </p>
      </div>

      <div className="panel prose">
        <h3>How to use the dashboard</h3>
        <ul>
          <li>
            <strong>Overview:</strong> charts for all of Rwanda. Read the box under each chart to see what it shows.
          </li>
          <li>
            <strong>Districts:</strong> search all 30 districts, then click one to see more.
          </li>
          <li>
            <strong>Map:</strong> pick a tab to change what the map shows, then click a district.
          </li>
        </ul>
      </div>
    </>
  )
}
