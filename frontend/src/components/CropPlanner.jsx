import { ChevronDownIcon, ChevronUpIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useState } from 'react'
import { fetchCropRanking, fetchPredictCrops } from '../api'

const VERDICT_LABELS = { good: 'Good', marginal: 'Marginal', poor: 'Poor' }
const CONFIDENCE = {
  high: { label: 'High confidence', badge: 'badge-low' },
  medium: { label: 'Medium confidence', badge: 'badge-medium' },
  low: { label: 'Low confidence', badge: 'badge-high' },
}
const TRUST_LABELS = {
  verified: 'Satellite checked against households: agrees',
  usable: 'Satellite checked against households: medium gap',
  unverified: 'No household value: satellite not checked',
}

const monthShort = (name) => name.slice(0, 3)

/** The chance as a dot with its plausible range behind it, so a short record never looks more certain than it is. */
function ChanceBar({ good }) {
  return (
    <div className="predict-chance" title={`${good.count} of ${good.years} past years. Plausible range ${good.low}% to ${good.high}%.`}>
      <div className="predict-chance-track">
        <span className="predict-chance-range" style={{ left: `${good.low}%`, width: `${Math.max(good.high - good.low, 1)}%` }} />
        <span className="predict-chance-dot" style={{ left: `${good.pct}%` }} />
      </div>
      <div className="predict-chance-text">
        <strong>{Math.round(good.pct)}%</strong>
        <span>
          {good.count} of {good.years} years
        </span>
      </div>
    </div>
  )
}

/** For one district: every planting month, with how many past years were good, marginal or poor. */
function MonthChart({ months, bestMonth }) {
  return (
    <figure className="predict-months">
      <figcaption>Past years by planting month</figcaption>
      <div className="predict-months-plot">
        {months.map((month) => {
          const years = Math.max(month.years, 1)
          const good = (month.good.count / years) * 100
          const marginal = (month.marginal / years) * 100
          const poor = (month.poor / years) * 100

          return (
            <div
              key={month.month}
              className={`predict-month${month.usual ? ' usual' : ''}${month.month === bestMonth ? ' best' : ''}`}
              title={`Planting in ${month.name}: good in ${month.good.count} of ${month.years} years, marginal in ${month.marginal}, poor in ${month.poor}. Average season rain ${month.average_season_mm ?? 'n/a'} mm.`}
            >
              <span className="predict-month-pct">{month.years ? `${Math.round(month.good.pct)}%` : '-'}</span>
              <div className="predict-month-stack">
                <span style={{ height: `${poor}%`, background: 'var(--verdict-poor)' }} />
                <span style={{ height: `${marginal}%`, background: 'var(--verdict-marginal)' }} />
                <span style={{ height: `${good}%`, background: 'var(--verdict-good)' }} />
              </div>
              <span className="predict-month-name">{monthShort(month.name)}</span>
            </div>
          )
        })}
      </div>
      <div className="predict-legend">
        <span><i style={{ background: 'var(--verdict-good)' }} />Good</span>
        <span><i style={{ background: 'var(--verdict-marginal)' }} />Marginal</span>
        <span><i style={{ background: 'var(--verdict-poor)' }} />Poor</span>
        <span className="predict-legend-note">Bold months are the usual planting months.</span>
      </div>
    </figure>
  )
}

function DistrictDetail({ row, crop, onAsk }) {
  const best = row.best
  const good = best.good

  return (
    <div className="predict-detail">
      <p className="predict-sentence">
        Planted in <strong>{best.name}</strong> (harvest in {best.harvest_name}), {crop.name.toLowerCase()} had the rain it needs in{' '}
        <strong>
          {good.count} of {good.years}
        </strong>{' '}
        past seasons. The plausible range is {good.low}% to {good.high}%: with so few years, one more bad year can move this a lot.
      </p>

      {row.caveat && <p className="predict-caveat">{row.caveat}</p>}

      <MonthChart months={row.by_month} bestMonth={best.month} />

      <div className="predict-table-wrap">
        <table className="predict-table">
          <caption>Year by year, planting in {best.name}</caption>
          <thead>
            <tr>
              <th>Season</th>
              <th>Rain</th>
              <th>Result</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {best.seasons.map((season) => (
              <tr key={season.year}>
                <td>{season.label}</td>
                <td>{Math.round(season.total_mm)} mm</td>
                <td>
                  <span className={`predict-verdict ${season.verdict}`}>{VERDICT_LABELS[season.verdict]}</span>
                </td>
                <td>{season.reasons.length ? season.reasons.join(' ') : 'All the needs were met.'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="predict-evidence">
        {row.household_drought_pct !== null
          ? `${row.household_drought_pct}% of households here reported drought (CFSVA 2024). Mismatch between satellite and households: ${row.basis_risk_pct} points (${row.risk_level}).`
          : 'There is no household survey value for this district.'}
      </p>

      <button type="button" className="predict-ask" onClick={() => onAsk(`Is ${crop.name.toLowerCase()} a good choice in ${row.name}? Which month should I plant and how sure are you?`)}>
        <SparklesIcon className="icon" aria-hidden="true" />
        Ask the AI about {row.name}
      </button>
    </div>
  )
}

/**
 * Pick a crop and see every usable district ranked by how often the rain suited it in 2014 to 2024.
 * All percentages come from the server; nothing is calculated here.
 */
export default function CropPlanner({ onAsk }) {
  const [crops, setCrops] = useState([])
  const [cropId, setCropId] = useState('maize')
  const [results, setResults] = useState({})
  const [failed, setFailed] = useState({})
  const [openId, setOpenId] = useState(null)
  const [province, setProvince] = useState('all')

  useEffect(() => {
    fetchPredictCrops().then(setCrops).catch(() => setFailed((previous) => ({ ...previous, list: true })))
  }, [])

  // Rankings are cached by the api module, so going back to a crop is instant.
  useEffect(() => {
    let current = true

    fetchCropRanking(cropId)
      .then((result) => current && setResults((previous) => ({ ...previous, [cropId]: result })))
      .catch(() => current && setFailed((previous) => ({ ...previous, [cropId]: true })))

    return () => {
      current = false
    }
  }, [cropId])

  const selectCrop = (id) => {
    setCropId(id)
    setOpenId(null)
  }

  const data = results[cropId] ?? null
  const error = Boolean(failed[cropId] || failed.list)

  const provinces = useMemo(() => [...new Set((data?.ranking ?? []).map((row) => row.province))].sort(), [data])
  const rows = (data?.ranking ?? []).filter((row) => province === 'all' || row.province === province)
  const crop = data?.crop

  return (
    <div className="panel predict-planner">
      <h3>Crop planner: where and when did the rain suit a crop?</h3>
      <p className="muted">
        Each district is replayed over {data ? `${data.period.first_year} to ${data.period.last_year}` : 'the years of satellite rainfall'}: in how many
        years would the crop have had the rain it needs? Click a district for the details.
      </p>

      <div className="predict-crops" role="tablist" aria-label="Crop">
        {(crops.length ? crops : [{ id: 'maize', name: 'Maize' }]).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={cropId === item.id}
            className={cropId === item.id ? 'active' : ''}
            onClick={() => selectCrop(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      {error && <p className="predict-error">Could not load the predictions. Please try again in a moment.</p>}
      {!data && !error && <p className="muted">Calculating from the rainfall records...</p>}

      {crop && (
        <>
          <div className="predict-needs">
            <strong>What {crop.name.toLowerCase()} needs from the rain</strong>
            <ul>
              <li>
                {crop.good_mm[0]} to {crop.good_mm[1]} mm over the {crop.cycle_months} months from planting to harvest
              </li>
              <li>At least {crop.min_monthly_mm} mm in every growing month</li>
              <li>
                At least {crop.flowering_min_mm} mm in month {crop.flowering_month} (flowering)
              </li>
            </ul>
            <span className="muted">
              Rounded FAO-style reference values, not measured data. Only rain is judged: sunshine, temperature and soil are not in the data. {crop.note}
            </span>
          </div>

          <div className="predict-toolbar">
            <label>
              Province
              <select value={province} onChange={(event) => setProvince(event.target.value)}>
                <option value="all">All provinces</option>
                {provinces.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <span className="muted">Ranked by the low end of the plausible range, so a lucky short record does not win.</span>
          </div>

          <ol className="predict-list">
            {rows.map((row) => {
              const open = openId === row.id
              const confidence = CONFIDENCE[row.confidence]

              return (
                <li key={row.id} className={open ? 'open' : ''}>
                  <button type="button" className="predict-row" aria-expanded={open} onClick={() => setOpenId(open ? null : row.id)}>
                    <span className="predict-rank">{row.rank}</span>
                    <span className="predict-name">
                      <strong>{row.name}</strong>
                      <small>{row.province}</small>
                    </span>
                    <span className="predict-plant">
                      Plant in <strong>{row.best.name}</strong>
                      <small>harvest {row.best.harvest_name}</small>
                    </span>
                    <ChanceBar good={row.best.good} />
                    <span className="predict-tags">
                      <span className={`badge ${confidence.badge}`}>{confidence.label}</span>
                      <small>{TRUST_LABELS[row.trust]}</small>
                    </span>
                    {open ? <ChevronUpIcon className="icon predict-chevron" aria-hidden="true" /> : <ChevronDownIcon className="icon predict-chevron" aria-hidden="true" />}
                  </button>
                  {open && <DistrictDetail row={row} crop={crop} onAsk={onAsk} />}
                </li>
              )
            })}
          </ol>

          {data.excluded.length > 0 && (
            <details className="predict-excluded">
              <summary>
                {data.excluded.length} districts left out because the satellite cannot be trusted there
              </summary>
              <p className="muted">
                Where households and the satellite disagree strongly (high mismatch risk), a prediction from satellite rain would be misleading, so none is made.
              </p>
              <ul>
                {data.excluded.map((row) => (
                  <li key={row.id}>
                    <strong>{row.name}</strong> ({row.province}): {row.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}
