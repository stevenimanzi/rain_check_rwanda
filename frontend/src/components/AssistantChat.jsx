import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { useEffect, useRef, useState } from 'react'

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
export default function AssistantChat({ chat, compact = false }) {
  const { messages, loading, error, send, reset } = chat
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

  return (
    <div className={compact ? 'assistant-chat compact' : 'assistant-chat'}>
      <div className="assistant-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="assistant-welcome">
            <p>
              Hello! I can explain the RainCheck Rwanda results in simple words. Ask me about a district, a chart or
              how a number is calculated.
            </p>
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((question) => (
                <button key={question} type="button" onClick={() => send(question)}>
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`assistant-message ${message.role}`}>
            {message.content}
          </div>
        ))}

        {loading && <div className="assistant-message assistant assistant-typing">Thinking...</div>}
        {error && <div className="assistant-error">{error}</div>}
        <div ref={endRef} />
      </div>

      <form className="assistant-form" onSubmit={submit}>
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask a question about the data"
          maxLength={500}
          aria-label="Your question"
        />
        <button type="submit" disabled={loading || !text.trim()} aria-label="Send">
          <PaperAirplaneIcon className="icon" />
        </button>
      </form>

      <div className="assistant-footer">
        <span>AI can make mistakes. Check important numbers on the charts.</span>
        {messages.length > 0 && (
          <button type="button" className="link-button" onClick={reset}>
            New chat
          </button>
        )}
      </div>
    </div>
  )
}
