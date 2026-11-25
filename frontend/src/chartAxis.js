// Axis titles that state the measurement unit, shared by every bar chart.
const TITLE_STYLE = { fontSize: 11, fontWeight: 600, fill: '#475569', textAnchor: 'middle' }

export const yAxisTitle = (value) => ({ value, angle: -90, position: 'insideLeft', offset: 4, style: TITLE_STYLE })

export const xAxisTitle = (value) => ({ value, position: 'insideBottom', offset: 0, style: TITLE_STYLE })
