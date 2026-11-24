import { useState } from 'react'
import { importHouseholdSurvey } from '../api'

export default function HouseholdSurveyImportPanel({ districts, onImported }) {
  const [surveyYear, setSurveyYear] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [token, setToken] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const template = [
    'district,household_drought_pct',
    ...districts.map((district) => `${district.name},`),
  ].join('\r\n')
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`

  const submit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true)
    setFeedback(null)

    try {
      const imported = await importHouseholdSurvey({ file, surveyYear, sourceName, token })
      setFeedback({
        type: 'success',
        text: `Imported ${imported.observations.length} district values from ${imported.source_name} (${imported.survey_year}).`,
      })
      onImported?.(imported)
      setFile(null)
      setToken('')
      form.reset()
      setSurveyYear('')
      setSourceName('')
    } catch (error) {
      const errors = error.response?.data?.errors
      const detail = errors ? Object.values(errors).flat()[0] : error.response?.data?.message
      setFeedback({
        type: 'error',
        text: detail || 'The upload failed. Check your connection and try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h3 id="survey-import-title">Add household survey data</h3>
      <p className="muted">
        Upload district household drought percentages. Imports keep their source and survey year; they never replace
        existing CFSVA values or get averaged with another source.
      </p>

      <p className="survey-template">
        <a href={templateHref} download="household_drought_template.csv">Download the CSV template</a>
        <span className="muted">
          Required columns: district, household_drought_pct. Blank percentages are skipped; values must be 0-100.
        </span>
      </p>

      <form className="survey-import-form" onSubmit={submit}>
        <label className="filter-field">
          <span>Survey year</span>
          <input
            type="number"
            min="1900"
            max="2100"
            required
            value={surveyYear}
            onChange={(event) => setSurveyYear(event.target.value)}
          />
        </label>

        <label className="filter-field">
          <span>Source name</span>
          <input
            type="text"
            maxLength="120"
            required
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
            placeholder="e.g. Household survey 2025"
          />
        </label>

        <label className="filter-field survey-file">
          <span>CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <label className="filter-field survey-token">
          <span>Private import token</span>
          <input
            type="password"
            autoComplete="off"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Enter the backend IMPORT_TOKEN"
          />
        </label>

        <button className="primary-button" type="submit" disabled={busy || !file}>
          {busy ? 'Importing...' : 'Import survey'}
        </button>
      </form>

      {feedback && (
        <p className={`survey-feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </p>
      )}
      <p className="muted survey-security-note">
        Imports are protected by a backend-only IMPORT_TOKEN. Configure it privately in the backend environment
        before uploading; never commit or share the token.
      </p>
    </div>
  )
}
