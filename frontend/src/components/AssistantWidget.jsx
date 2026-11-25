import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import AssistantChat from './AssistantChat'
import NewChatButton from './NewChatButton'

/**
 * Floating button in the bottom right corner that opens the assistant in a small panel.
 */
export default function AssistantWidget({ chat }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="assistant-widget">
      {open && (
        <section className="assistant-panel" aria-label="AI assistant">
          <header>
            <span>
              <SparklesIcon className="icon" /> AI Assistant
            </span>
            <div className="assistant-header-actions">
              <NewChatButton chat={chat} />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">
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
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={open}
      >
        {open ? <XMarkIcon className="icon" /> : <SparklesIcon className="icon" />}
      </button>
    </div>
  )
}
