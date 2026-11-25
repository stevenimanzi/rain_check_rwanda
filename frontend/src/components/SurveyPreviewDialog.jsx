import { useEffect, useRef, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { fetchSurveyComparison } from '../api'
import { CHART_COLORS, monthYear } from '../utils'
import DistrictMultiSelect from './DistrictMultiSelect'
import DryMonthsChart from './DryMonthsChart'
import MismatchOverview from './MismatchOverview'
import Notice from './Notice'
import RiskBadge from './RiskBadge'
import StatCard from './StatCard'

/**
 * Large view of an imported survey that has NOT been saved. It shows only what was uploaded, on its own,
 * and disappears when closed. "Save and merge" turns it into a permanent import.
 */
export default function SurveyPreviewDialog({ preview, districts, saving, message, onSave, onClose }) {
  const dialogRef = useRef(null)
  const [comparison, setComparison] = useState(null)
  // null = every district; otherwise the ids shown in this preview
  const [selectedIds, setSelectedIds] = useState(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    fetchSurveyComparison(
      { surveyYear: preview.survey_year, view: 'imported', observations: preview.observations },
      controller.signal,
    )
      .then((result) => {
        if (active) setComparison(result)
      })
      .catch((error) => {
        if (active && error.name !== 'CanceledError') setComparison({ failed: true })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [preview])

  const isSelected = (id) => selectedIds === null || selectedIds.includes(id)
  const rows = preview.observations.filter((row) => isSelected(row.district_id))
  const shownDistrictCount = selectedIds === null ? districts.length : selectedIds.length
  const values = rows.map((row) => Number(row.household_drought_pct))
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  const ranked = [...rows].sort((a, b) => b.household_drought_pct - a.household_drought_pct)
  const highest = ranked[0]
  const lowest = ranked[ranked.length - 1]
  const provinceById = new Map(districts.map((district) => [district.id, district.province]))
  const comparedById = new Map((comparison?.districts ?? []).map((district) => [district.id, district]))
  const compared = comparison && !comparison.failed && comparison.window.complete
  const period = compared ? `${monthYear(comparison.window.start)} to ${monthYear(comparison.window.end)}` : null
  const comparedDistricts = compared
    ? comparison.districts.filter((district) => isSelected(district.id) && district.household_drought_pct !== null)
    : []
  const highMismatch = comparedDistricts.filter((district) => district.summary.risk_level === 'high').length
  const chartRows = rows.map((row) => ({
    id: row.district_id,
    name: row.district_name,
    household_drought_pct: Number(row.household_drought_pct),
  }))

  return (
    <dialog
      ref={dialogRef}
      className="survey-preview-dialog"
      aria-labelledby="survey-preview-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // Clicks inside the dialog never close it; only clicks on the backdrop do.
        const box = event.currentTarget.getBoundingClientRect()
        const inside =
          event.clientX >= box.left && event.clientX <= box.right &&
          event.clientY >= box.top && event.clientY <= box.bottom

        if (!inside && !saving) onClose()
      }}
    >
      <header className="survey-preview-header">
        <div>
          <h2 id="survey-preview-title">
            {preview.source_name} ({preview.survey_year})
            <span className="survey-preview-tag">Preview, not saved</span>
          </h2>
          <p>
            This report shows only the file you uploaded. It is not stored and disappears when you close it or reload
            the page.
          </p>
        </div>
        <div className="survey-preview-actions">
          <button type="button" className="survey-preview-save" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save and merge'}
          </button>
          <button
            type="button"
            className="survey-preview-x"
            aria-label="Close preview"
            onClick={onClose}
            disabled={saving}
          >
            <XMarkIcon className="icon" />
          </button>
        </div>
      </header>

      <div className="survey-preview-filter">
        <DistrictMultiSelect districts={districts} selectedIds={selectedIds} onChange={setSelectedIds} />
      </div>

      <div className="survey-preview-body">
        {message && <p className="survey-feedback error" role="alert">{message}</p>}

        <div className="stats">
          <StatCard
            label="Districts with a value"
            value={`${rows.length} of ${shownDistrictCount}`}
            hint="Blank rows in the file are skipped"
          />
          <StatCard
            label="Average households reporting drought"
            value={average === null ? '-' : `${average.toFixed(1)}%`}
            hint="Equal-weighted across the districts in the file"
          />
          <StatCard label="Highest" value={highest ? `${highest.household_drought_pct}%` : '-'} hint={highest?.district_name} />
          <StatCard label="Lowest" value={lowest ? `${lowest.household_drought_pct}%` : '-'} hint={lowest?.district_name} />
          {compared && (
            <StatCard label="High-mismatch districts" value={`${highMismatch} of ${comparedDistricts.length}`} hint={period} />
          )}
        </div>

        {selectedIds !== null && selectedIds.length === 0 && (
          <Notice title="No districts selected">Select one or more districts to see the preview.</Notice>
        )}
        {compared && comparedDistricts.length > 0 && <MismatchOverview districts={comparedDistricts} period={period} />}
        {comparison && !comparison.failed && !comparison.window.complete && (
          <Notice title="No satellite rainfall for this survey's period yet">
            Satellite rainfall is missing for {monthYear(comparison.window.start, 'long')} to{' '}
            {monthYear(comparison.window.end, 'long')}, so this preview can't be compared with the satellite. The
            household values are shown below.
          </Notice>
        )}
        {comparison?.failed && (
          <Notice title="Could not compare with the satellite">The household values are shown below.</Notice>
        )}

        <div className="grid-2 even survey-preview-grid">
          <div className="panel">
            <h3>Households that reported drought</h3>
            <p className="muted">
              {preview.source_name} ({preview.survey_year}), every district in the file.
            </p>
            <DryMonthsChart
              districts={chartRows}
              getValue={(district) => district.household_drought_pct}
              unit="% of households"
              color={CHART_COLORS.normal}
            />
          </div>

          <div className="panel">
            <h3>Uploaded values</h3>
            <p className="muted">
              {compared
                ? `Compared with satellite dry months for ${period}.`
                : 'Satellite comparison is not available for this survey period.'}
            </p>
            <div className="table-scroll">
              <table className="table plain">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Province</th>
                    <th>Households</th>
                    {compared && <th>Dry months</th>}
                    {compared && <th>Gap</th>}
                    {compared && <th>Mismatch</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...rows]
                    .sort((a, b) => a.district_name.localeCompare(b.district_name))
                    .map((row) => {
                      const match = comparedById.get(row.district_id)

                      return (
                        <tr key={row.district_id}>
                          <td>{row.district_name}</td>
                          <td>{provinceById.get(row.district_id) ?? '-'}</td>
                          <td>{row.household_drought_pct}%</td>
                          {compared && <td>{match?.summary.satellite_drought_months ?? '-'}</td>}
                          {compared && <td>{match?.summary.basis_risk_pct != null ? `${match.summary.basis_risk_pct} points` : '-'}</td>}
                          {compared && (
                            <td>{match?.summary.risk_level ? <RiskBadge level={match.summary.risk_level} /> : '-'}</td>
                          )}
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  )
}
