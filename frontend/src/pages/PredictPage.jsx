import { useRef } from 'react'
import AssistantChat from '../components/AssistantChat'
import CropPlanner from '../components/CropPlanner'
import NewChatButton from '../components/NewChatButton'

const SUGGESTIONS = [
  'Which district is best for growing maize, and when should I plant?',
  'What rain does maize need, and which months had it?',
  'Where is maize too risky to grow?',
  'Compare maize and beans in Musanze',
  'How likely is a dry March in Huye?',
]

export default function PredictPage({ chat }) {
  const chatRef = useRef(null)

  // The planner can hand a question to the AI: send it and bring the conversation into view.
  const ask = (question) => {
    chat.send(question)
    chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="predict-page">
      <div className="panel predict-intro">
        <h2>Predict the future from the past</h2>
        <p>
          Ask which district or month suits a crop, or how likely a dry month is. Every answer is counted from what the rain actually did
          in each district, using the satellite rainfall that households agree with.
        </p>
        <ul className="predict-honest">
          <li>
            <strong>A chance is a count of past years.</strong> &quot;9 of 10 years&quot; is not a promise for next year, and it is not a weather forecast.
          </li>
          <li>
            <strong>Only about 10 years exist,</strong> so every chance comes with a plausible range. A short record is never presented as certain.
          </li>
          <li>
            <strong>Only trusted districts are used.</strong> Where households and the satellite disagree strongly (high mismatch risk), no prediction is made.
          </li>
          <li>
            <strong>Only rain is judged.</strong> Sunshine, temperature, soil and pests are not in our data, so the AI will say so.
          </li>
        </ul>
      </div>

      <div className="panel assistant-page predict-chat" ref={chatRef}>
        <div className="assistant-page-header">
          <h3>Ask the prediction AI</h3>
          <NewChatButton chat={chat} />
        </div>
        <p className="muted">It explains numbers that were calculated from the database. It does not make them up.</p>
        <AssistantChat
          chat={chat}
          suggestions={SUGGESTIONS}
          welcome="Hello! Ask me where and when a crop would have had the rain it needs, or how likely a wet or dry month is. I answer with how many past years it happened, and how sure we can be."
          placeholder="Ask about a crop, a district or a month"
          footer="Chances are counted from 2014 to 2024. They are not a weather forecast. The AI can make mistakes."
        />
      </div>

      <CropPlanner onAsk={ask} />
    </div>
  )
}
