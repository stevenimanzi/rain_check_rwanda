import axios from 'axios'

// In development the Vite proxy forwards /api. When the site is hosted, VITE_API_URL points at the API.
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

const client = axios.create({ baseURL: API_BASE })

export const fetchOverview = () => client.get('/overview').then((res) => res.data)

export const fetchDistricts = () => client.get('/districts').then((res) => res.data.data)

export const fetchDistrict = (id) => client.get(`/districts/${id}`).then((res) => res.data.data)

export const fetchHouseholdSurveyImports = () =>
  client.get('/imports/household-drought').then((res) => res.data.data)

export const loginHouseholdSurveyImporter = ({ email, password }) =>
  client.post('/imports/household-drought/login', { email, password }).then((res) => res.data.data)

export const logoutHouseholdSurveyImporter = (token) =>
  client.post('/imports/household-drought/logout', null, {
    headers: { Authorization: `Bearer ${token}` },
  })

export const importHouseholdSurvey = ({ file, surveyYear, sourceName, token }) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('survey_year', surveyYear)
  formData.append('source_name', sourceName)

  return client.post('/imports/household-drought', formData, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => res.data.data)
}
