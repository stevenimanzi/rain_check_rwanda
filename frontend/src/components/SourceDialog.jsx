import { createPortal } from 'react-dom'
import ChartDetailsDialog from './ChartDetailsDialog'

const isLink = (value) => typeof value === 'string' && /^https?:\/\//.test(value)

/**
 * Full details of one data source behind an assistant answer: what it is and how it is used on one tab,
 * the rows stored in the database on the other. `source` comes from GET /assistant/sources.
 */
export default function SourceDialog({ source, onClose }) {
  const tabs = [
    {
      id: 'about',
      label: 'About this source',
      columns: [
        { key: 'name', label: 'Detail' },
        { key: 'value', label: 'Information' },
      ],
      rows: source.about.map(([name, value]) => ({
        id: name,
        cells: {
          name: <strong>{name}</strong>,
          value: isLink(value) ? (
            <a href={value} target="_blank" rel="noreferrer">
              {value}
            </a>
          ) : (
            value
          ),
        },
      })),
    },
    { id: 'data', label: 'Data in the database', columns: source.columns, rows: source.rows },
  ]

  // Portal: the chat bubbles are not translated by the page translator, the dialog should be.
  return createPortal(
    <ChartDetailsDialog title={source.title} subtitle={source.subtitle} summary={source.summary} tabs={tabs} onClose={onClose} />,
    document.body,
  )
}
