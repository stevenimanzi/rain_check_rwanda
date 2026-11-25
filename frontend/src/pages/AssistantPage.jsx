import AssistantChat from '../components/AssistantChat'

export default function AssistantPage({ chat }) {
  return (
    <div className="panel assistant-page">
      <h3>Ask the AI assistant</h3>
      <p className="muted">
        It answers from the same data as the dashboard: rainfall, households that reported drought, and mismatch risk
        for all 30 districts.
      </p>
      <AssistantChat chat={chat} />
    </div>
  )
}
