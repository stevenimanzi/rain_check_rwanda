import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AssistantMarkdown from './AssistantMarkdown'

const SUGGESTIONS = [
  'What does this project show?',
  'Which districts have the biggest mismatch?',
  'What is a dry month?',
  'Why do the satellite and households disagree in Gatsibo?',
]

/**
 * The conversation: messages, suggested questions and the input box.
 * `chat` comes from useAssistantChat.
 */
export default function AssistantChat({
  chat,
  compact = false,
  suggestions = SUGGESTIONS,
  welcome = 'Hello! I can explain the RainCheck Rwanda results in simple words. Ask me about a district, a chart or how a number is calculated.',
  placeholder = 'Ask a question about the data',
  footer = 'AI can make mistakes. Check important numbers on the charts.',
  className = '',
  composerSlot,
}) {
  const { messages, loading, error, send } = chat
  const [text, setText] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, loading, error])

  const submit = (event) => {
    event.preventDefault()
    if (!text.trim()) return
    send(text)
    setText('')
  }


  const composer = (
    <div className="assistant-composer">
      <form className="assistant-form" onSubmit={submit}>
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          maxLength={500}
          aria-label="Your question"
        />
        <button type="submit" disabled={loading || !text.trim()} aria-label="Send">
          <PaperAirplaneIcon className="icon" />
        </button>
      </form>

      <div className="assistant-footer">
        <span>{footer}</span>
      </div>
    </div>
  )

  // composerSlot: a page can pass its own element to keep the input bar there (for example pinned to the bottom of the screen).
  // null means the element is not ready yet, so nothing is shown until it is.
  const inline = composerSlot === undefined

  return (
    <div className={`${compact ? 'assistant-chat compact' : 'assistant-chat'} ${className}`.trim()}>
      <div className="assistant-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="assistant-welcome">
            <p>{welcome}</p>
            <div className="assistant-suggestions">
              {suggestions.map((question) => (
                <button key={question} type="button" onClick={() => send(question)}>
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`assistant-message ${message.role}`} translate="no">
            {message.role === 'assistant' ? <AssistantMarkdown>{message.content}</AssistantMarkdown> : message.content}
          </div>
        ))}

        {loading && <div className="assistant-message assistant assistant-typing">Thinking...</div>}
        {error && <div className="assistant-error">{error}</div>}
        <div ref={endRef} />
      </div>

      {inline ? composer : composerSlot && createPortal(composer, composerSlot)}
    </div>
  )
}
