import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/react/24/outline'

// True while a chart is drawn inside the full-screen dialog, so fixed-height charts can grow.
const FullscreenContext = createContext(false)

export const useChartFullscreen = () => useContext(FullscreenContext)

// Height to draw a fixed-height chart: its normal height, or a tall one in the full-screen view.
export const useChartHeight = (normal, fullscreen = 540) => (useContext(FullscreenContext) ? fullscreen : normal)

function FullscreenDialog({ heading, onClose, children }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="chart-fullscreen-dialog"
      aria-label={heading}
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
      <header className="chart-fullscreen-header">
        <h2>{heading}</h2>
        <button type="button" className="chart-fullscreen-close" aria-label="Close full screen" onClick={onClose}>
          <XMarkIcon className="icon" />
        </button>
      </header>
      <div className="chart-fullscreen-body">
        <FullscreenContext.Provider value>{children}</FullscreenContext.Provider>
      </div>
    </dialog>
  )
}

/**
 * A chart block (usually a panel) with an expand icon in its top-right corner. Clicking the icon shows the same
 * content in a full-width dialog. The dialog title is `title`, or the first <h3> inside the block.
 */
export default function ExpandableChart({ as: Tag = 'div', className = 'panel', title, children, ...rest }) {
  const [heading, setHeading] = useState(null)
  const ref = useRef(null)

  const open = () => setHeading(title ?? ref.current?.querySelector('h3')?.textContent ?? 'Chart')

  return (
    <>
      <Tag ref={ref} className={`${className} chart-expandable`} {...rest}>
        <button type="button" className="chart-expand-button" aria-label="View full screen" title="View full screen" onClick={open}>
          <ArrowsPointingOutIcon className="icon" />
        </button>
        {children}
      </Tag>
      {heading !== null && (
        <FullscreenDialog heading={heading} onClose={() => setHeading(null)}>
          {children}
        </FullscreenDialog>
      )}
    </>
  )
}
