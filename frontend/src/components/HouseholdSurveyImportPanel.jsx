import { useState } from 'react'
import { importHouseholdSurvey, loginHouseholdSurveyImporter, logoutHouseholdSurveyImporter } from '../api'

export default function HouseholdSurveyImportPanel({ districts, accessToken, onImported, onPreview, onLogin, onLogout }) {
  // "save": kept permanently and merged into the dashboards. "preview": shown only until it is closed.
  const [mode, setMode] = useState('save')
  const [surveyYear, setSurveyYear] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const template = [
    'district,household_drought_pct',
    ...districts.map((district) => `${district.name},`),
  ].join('\r\n')
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`

  const signIn = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFeedback(null)

    try {
      const session = await loginHouseholdSurveyImporter({ email, password })
      onLogin?.(session.token)
      setPassword('')
      setFeedback({ type: 'success', text: 'Signed in. You can now upload survey data.' })
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Sign-in failed. Check your connection and try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true)
    setFeedback(null)

    try {
      const imported = await importHouseholdSurvey({ file, surveyYear, sourceName, token: accessToken, mode })

      if (mode === 'preview') {
        setFeedback({
          type: 'success',
          text: `Previewing ${imported.observations.length} district values from ${imported.source_name} (${imported.survey_year}). Nothing was saved.`,
        })
        onPreview?.(imported, file)
      } else {
        setFeedback({
          type: 'success',
          text: `Saved ${imported.observations.length} district values from ${imported.source_name} (${imported.survey_year}).`,
        })
        onImported?.(imported)
      }

      setFile(null)
      form.reset()
      setSurveyYear('')
      setSourceName('')
    } catch (error) {
      if (error.response?.status === 401) {
        onLogout?.()
        setFeedback({ type: 'error', text: 'Your sign-in expired. Sign in again to continue.' })
        return
      }

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

  const signOut = async () => {
    setBusy(true)
    setFeedback(null)

    try {
      await logoutHouseholdSurveyImporter(accessToken)
    } catch (error) {
      if (error.response?.status !== 401) {
        setFeedback({
          type: 'error',
          text: error.response?.data?.message || 'Could not sign out. Check your connection and try again.',
        })
        setBusy(false)
        return
      }
    }

    onLogout?.()
    setFeedback({ type: 'success', text: 'Signed out.' })
    setBusy(false)
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

      {accessToken ? (
        <>
          <div className="survey-import-account">
            <span>Signed in to upload surveys</span>
            <button type="button" className="survey-sign-out" onClick={signOut} disabled={busy}>
              Sign out
            </button>
          </div>
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

            <fieldset className="survey-mode">
              <legend>What should happen to this data?</legend>
              <label className={mode === 'save' ? 'survey-mode-option active' : 'survey-mode-option'}>
                <input type="radio" name="survey-mode" value="save" checked={mode === 'save'} onChange={() => setMode('save')} />
                <span>
                  <strong>Save and merge</strong>
                  <small>Keep it permanently and show it with the existing data on the dashboards.</small>
                </span>
              </label>
              <label className={mode === 'preview' ? 'survey-mode-option active' : 'survey-mode-option'}>
                <input type="radio" name="survey-mode" value="preview" checked={mode === 'preview'} onChange={() => setMode('preview')} />
                <span>
                  <strong>View only, don't save</strong>
                  <small>Look at this report alone. It disappears when you close the preview or reload the page.</small>
                </span>
              </label>
            </fieldset>

            <button className="primary-button" type="submit" disabled={busy || !file}>
              {busy ? 'Working...' : mode === 'preview' ? 'Preview survey' : 'Save survey'}
            </button>
          </form>
        </>
      ) : (
        <form className="survey-login-form" onSubmit={signIn}>
          <p className="muted">Sign in with the survey uploader account to continue.</p>
          <label className="filter-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      )}

      {feedback && (
        <p className={`survey-feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </p>
      )}
    </div>
  )
}
