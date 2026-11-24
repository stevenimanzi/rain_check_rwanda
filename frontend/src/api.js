import axios from 'axios'

// In development the Vite proxy forwards /api. When the site is hosted, VITE_API_URL points at the API.
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

const client = axios.create({ baseURL: API_BASE })

export const fetchOverview = () => client.get('/overview').then((res) => res.data)

export const fetchDistricts = () => client.get('/districts').then((res) => res.data.data)

export const fetchDistrict = (id) => client.get(`/districts/${id}`).then((res) => res.data.data)
