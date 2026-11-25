import { PlusIcon } from '@heroicons/react/24/outline'

/**
 * Round plus button that clears the conversation. `chat` comes from useAssistantChat.
 */
export default function NewChatButton({ chat }) {
  const empty = chat.messages.length === 0 && !chat.error

  return (
    <button
      type="button"
      className="assistant-new-chat"
      onClick={chat.reset}
      disabled={empty}
      title="New chat"
      aria-label="Start a new chat"
    >
      <PlusIcon className="icon" />
    </button>
  )
}
