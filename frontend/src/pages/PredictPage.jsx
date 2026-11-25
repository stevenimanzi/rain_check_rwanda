import { useState } from 'react'
import AssistantChat from '../components/AssistantChat'
import NewChatButton from '../components/NewChatButton'

const SUGGESTIONS = [
  'Which district is best for growing maize, and when should I plant?',
  'What rain does maize need, and which planting months get it?',
  'Where is maize too risky to grow?',
  'Compare maize and beans in Musanze',
  'How dry was March in Huye compared with normal?',
]

export default function PredictPage({ chat }) {
  // The question box is drawn here, at the end of the page, and pinned to the bottom of the screen.
  const [composerSlot, setComposerSlot] = useState(null)

  return (
    <div className="predict-page">
      <div className="panel predict-intro">
        <h2>Predict from the household window</h2>
        <p>
          Ask which district or month suits a crop. Households are the main data. The satellite rain is kept only for the same months households
          were asked about, and only where households agree with it.
        </p>
        <ul className="predict-honest">
          <li>
            <strong>Two views of the rain.</strong> A <em>normal year</em> (the typical rain of each month) and the <em>observed season</em> (what really
            fell in the household window), both compared with what the crop needs.
          </li>
          <li>
            <strong>Percentages are measurements, not chances.</strong> Only one observed season exists, so no probability of success can be calculated.
            The AI shows rain as a % of the crop&apos;s need and the % of households that reported drought.
          </li>
          <li>
            <strong>Only trusted districts are used.</strong> Where households and the satellite disagree strongly (high mismatch risk), no prediction is made.
          </li>
          <li>
            <strong>Only rain is judged.</strong> Sunshine, temperature, soil and pests are not in our data, so the AI will say so.
          </li>
        </ul>
      </div>

      <div className="panel assistant-page predict-chat">
        <div className="assistant-page-header">
          <h3>Ask the prediction AI</h3>
          <NewChatButton chat={chat} />
        </div>
        <p className="muted">It explains numbers that were calculated from the database. It does not make them up.</p>
        <AssistantChat
          chat={chat}
          suggestions={SUGGESTIONS}
          welcome="Hello! Ask me where and when the rain suits a crop. I compare a normal year and the observed season with what the crop needs, show what households reported, and tell you how sure we can be."
          placeholder="Ask about a crop, a district or a month"
          footer="One observed season only, so these are measurements, not probabilities or a weather forecast. The AI can make mistakes."
          composerSlot={composerSlot}
        />
      </div>

      <div ref={setComposerSlot} className="predict-composer-slot" />
    </div>
  )
}
