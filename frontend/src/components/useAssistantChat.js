import { useState } from 'react'
import { sendAssistantMessages } from '../api'

const FALLBACK_ERROR = 'The assistant could not answer right now. Please try again in a moment.'

/**
 * Conversation state for the AI assistant. It lives in App so the page and the floating
 * button share one conversation.
 */
export default function useAssistantChat(sender = sendAssistantMessages) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const send = async (text) => {
    const content = text.trim()
    if (!content || loading) return

    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setLoading(true)
    setError('')

    try {
      const reply = await sender(next)
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err.response?.data?.message ?? FALLBACK_ERROR)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setMessages([])
    setError('')
  }

  return { messages, loading, error, send, reset }
}
