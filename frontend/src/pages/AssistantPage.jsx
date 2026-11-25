import AssistantChat from '../components/AssistantChat'
import NewChatButton from '../components/NewChatButton'

export default function AssistantPage({ chat }) {
  return (
    <div className="panel assistant-page">
      <div className="assistant-page-header">
        <h3>Ask the AI assistant</h3>
        <NewChatButton chat={chat} />
      </div>
      <p className="muted">
        It answers from the same data as the dashboard: rainfall, households that reported drought, and mismatch risk
        for all 30 districts.
      </p>
      <AssistantChat chat={chat} />
    </div>
  )
}
