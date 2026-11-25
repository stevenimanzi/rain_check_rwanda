import { useEffect, useRef, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * Details for a clicked chart segment: optional summary cards and one or more tabs, each a table.
 * tabs: [{ id, label, columns: [{ key, label }], rows: [{ id, cells: { [key]: node }, highlight? }] }]
 */
export default function ChartDetailsDialog({ title, subtitle, summary = [], tabs, onClose }) {
  const dialogRef = useRef(null)
  const [activeTab, setActiveTab] = useState(tabs[0]?.id)
  const tab = tabs.find((item) => item.id === activeTab) ?? tabs[0]

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="chart-details-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // Clicks inside the dialog never close it; only clicks on the backdrop do.
        const box = event.currentTarget.getBoundingClientRect()
        const inside =
          event.clientX >= box.left && event.clientX <= box.right &&
          event.clientY >= box.top && event.clientY <= box.bottom

        if (!inside) onClose()
      }}
    >
      <header className="chart-details-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button type="button" className="chart-fullscreen-close" aria-label="Close details" onClick={onClose}>
          <XMarkIcon className="icon" />
        </button>
      </header>

      <div className="chart-details-body">
        {summary.length > 0 && (
          <div className="chart-details-summary">
            {summary.map((item) => (
              <div key={item.label} className="chart-details-stat">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        )}

        {tabs.length > 1 && (
          <div className="tabs chart-details-tabs" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === tab.id}
                className={item.id === tab.id ? 'tab active' : 'tab'}
                onClick={() => setActiveTab(item.id)}
              >
                {item.label} ({item.rows.length})
              </button>
            ))}
          </div>
        )}

        <div className="table-scroll">
          <table className="table plain chart-details-table">
            <thead>
              <tr>
                {tab.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tab.rows.map((row) => (
                <tr key={row.id} className={row.highlight ? 'chart-details-highlight' : undefined}>
                  {tab.columns.map((column) => (
                    <td key={column.key}>{row.cells[column.key] ?? '-'}</td>
                  ))}
                </tr>
              ))}
              {tab.rows.length === 0 && (
                <tr>
                  <td colSpan={tab.columns.length}>Nothing to show.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </dialog>
  )
}
