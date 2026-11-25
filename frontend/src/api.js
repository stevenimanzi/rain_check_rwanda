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

export const sendAssistantMessages = (messages) =>
  client.post('/assistant', { messages }).then((res) => res.data.reply)

export const fetchDistricts = () => client.get('/districts').then((res) => res.data.data)

export const fetchDistrict = (id) => client.get(`/districts/${id}`).then((res) => res.data.data)

export const fetchDistrictRainfall = (ids, signal) =>
  client.get('/districts/rainfall', { params: { ids }, signal }).then((res) => res.data.data)

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
