import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import AssistantChat from './AssistantChat'
import NewChatButton from './NewChatButton'

/**
 * Floating button in the bottom right corner that opens the assistant in a small panel.
 * The expand button in the panel header makes the chat fill the whole screen.
 */
export default function AssistantWidget({ chat }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Escape leaves full screen, unless a dialog (for example a data source) is open on top of the chat.
  useEffect(() => {
    if (!expanded) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setExpanded(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  const close = () => {
    setOpen(false)
    setExpanded(false)
  }

  return (
    <div className={expanded ? 'assistant-widget expanded' : 'assistant-widget'}>
      {open && (
        <section className="assistant-panel" aria-label="AI assistant">
          <header>
            <span>
              <SparklesIcon className="icon" /> AI Assistant
            </span>
            <div className="assistant-header-actions">
              <NewChatButton chat={chat} />
              <button
                type="button"
                className="assistant-expand"
                onClick={() => setExpanded((value) => !value)}
                title={expanded ? 'Exit full screen' : 'Full screen'}
                aria-label={expanded ? 'Exit full screen' : 'Open assistant in full screen'}
                aria-pressed={expanded}
              >
                {expanded ? <ArrowsPointingInIcon className="icon" /> : <ArrowsPointingOutIcon className="icon" />}
              </button>
              <button type="button" onClick={close} aria-label="Close assistant">
                <XMarkIcon className="icon" />
              </button>
            </div>
          </header>
          <AssistantChat chat={chat} compact />
        </section>
      )}

      <button
        type="button"
        className="assistant-fab"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={open}
      >
        {open ? <XMarkIcon className="icon" /> : <SparklesIcon className="icon" />}
      </button>
    </div>
  )
}
