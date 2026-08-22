import { useState } from 'react'
import { ConversationList } from './components/ConversationList'
import { ChatView } from './components/ChatView'
import { ToastContainer } from './components/Toast'

function App(): JSX.Element {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  return (
    <>
      <ToastContainer />
      {selectedConversationId ? (
        <ChatView
          conversationId={selectedConversationId}
          onBack={() => setSelectedConversationId(null)}
        />
      ) : (
        <ConversationList onSelectConversation={setSelectedConversationId} />
      )}
    </>
  )
}

export default App
