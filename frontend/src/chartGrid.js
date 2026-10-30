// Dashed lines drawn between bars, so each column or row reads as its own piece of data.
export const linesBetweenColumns = (count) => ({ width, offset }) => {
  const step = (width - offset.left - offset.right) / count
  return Array.from({ length: count - 1 }, (_, i) => offset.left + step * (i + 1))
}

export const linesBetweenRows = (count) => ({ height, offset }) => {
  const step = (height - offset.top - offset.bottom) / count
  return Array.from({ length: count - 1 }, (_, i) => offset.top + step * (i + 1))
}

export const GRID_LINE = { stroke: '#cbd5e1', strokeDasharray: '5 4' }
