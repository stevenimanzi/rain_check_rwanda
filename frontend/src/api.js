import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

export const fetchOverview = () => client.get('/overview').then((res) => res.data)

export const fetchDistricts = () => client.get('/districts').then((res) => res.data.data)

export const fetchDistrict = (id) => client.get(`/districts/${id}`).then((res) => res.data.data)
