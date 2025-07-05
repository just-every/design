import { Conversation } from '@just-every/demo-ui'
import { prepareConversationData } from '../utils/conversationAdapter'
import './ConversationView.scss'

interface ConversationViewProps {
  messages: any[]
  isCompactView: boolean
}

export default function ConversationView({ messages, isCompactView }: ConversationViewProps) {
  // Convert design messages to demo-ui MessageData format
  const messageData = prepareConversationData(messages);

  return (
    <div className="conversation-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Conversation
        messages={messageData}
        isStreaming={false}
        showAvatars={true}
        showMetadata={!isCompactView}
        showTimestamps={!isCompactView}
        showModels={false}
        showTools={!isCompactView}
        showThinking={!isCompactView}
        showThreadInfo={!isCompactView}
        isCompact={isCompactView}
        autoScroll={true}
        maxHeight="100%"
        emptyMessage="No messages yet. Run a design to start the conversation."
        className="design-conversation"
      />
    </div>
  )
}