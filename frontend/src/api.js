import axios from 'axios'

// In development the Vite proxy forwards /api. When the site is hosted, VITE_API_URL points at the API.
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

const client = axios.create({ baseURL: API_BASE })

let overviewRequest
export const fetchOverview = () => {
  if (!overviewRequest) {
    overviewRequest = client.get('/overview')
      .then((res) => res.data)
      .finally(() => {
        overviewRequest = null
      })
  }

  return overviewRequest
}

// The language picked in the page menu is kept in the Google Translate cookie (/en/rw).
const pageLanguage = () => {
  const code = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/)?.[1]
  return ['en', 'rw', 'fr'].includes(code) ? code : 'en'
}

export const sendAssistantMessages = (messages) =>
  client.post('/assistant', { messages, page_language: pageLanguage() }).then((res) => res.data.reply)

export const sendPredictMessages = (messages) =>
  client.post('/predict', { messages, page_language: pageLanguage() }).then((res) => res.data.reply)

// Details of the data sources behind the assistant's answers. They rarely change, so one request is enough.
let sourcesRequest = null

export const fetchAssistantSources = () => {
  sourcesRequest ??= client
    .get('/assistant/sources')
    .then((res) => res.data.data)
    .catch((error) => {
      sourcesRequest = null
      throw error
    })

  return sourcesRequest
}

export const fetchDistricts = () => client.get('/districts').then((res) => res.data.data)

export const fetchDistrict = (id) => client.get(`/districts/${id}`).then((res) => res.data.data)

export const fetchDistrictRainfall = (ids, signal, window) =>
  client.get('/districts/rainfall', {
    params: { ids, ...(window ? { start: window.start, end: window.end } : {}) },
    signal,
  }).then((res) => res.data.data)

export const fetchHouseholdSurveyImports = () =>
  client.get('/imports/household-drought').then((res) => res.data.data)

export const loginHouseholdSurveyImporter = ({ email, password }) =>
  client.post('/imports/household-drought/login', { email, password }).then((res) => res.data.data)

export const logoutHouseholdSurveyImporter = (token) =>
  client.post('/imports/household-drought/logout', null, {
    headers: { Authorization: `Bearer ${token}` },
  })

// mode "save" stores the survey permanently; "preview" validates it and returns it without storing anything.
export const importHouseholdSurvey = ({ file, surveyYear, sourceName, token, mode = 'save' }) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('survey_year', surveyYear)
  formData.append('source_name', sourceName)
  formData.append('mode', mode)

  return client.post('/imports/household-drought', formData, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => res.data.data)
}

// Re-runs the satellite vs household comparison with a survey's values (saved or previewed). Nothing is stored.
export const fetchSurveyComparison = ({ surveyYear, view, observations }, signal) =>
  client
    .post(
      '/survey-comparison',
      {
        survey_year: surveyYear,
        view,
        observations: observations.map(({ district_id, household_drought_pct }) => ({ district_id, household_drought_pct })),
      },
      { signal },
    )
    .then((res) => res.data.data)
