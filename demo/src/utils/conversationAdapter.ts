import { MessageData } from '@just-every/demo-ui';

export function convertMessageToMessageData(message: any): MessageData {
  // Filter out system messages as demo-ui doesn't support them
  if (message.role === 'system' || message.role === 'developer') {
    return null as any; // Will be filtered out
  }

  const messageData: MessageData = {
    role: message.role as 'user' | 'assistant',
    content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
    timestamp: Date.now()
  };

  // Extract tool calls if present
  if (message.content && Array.isArray(message.content)) {
    const toolUses = message.content.filter((c: any) => c.type === 'tool_use');
    if (toolUses.length > 0) {
      messageData.tools = toolUses.map((tu: any) => ({
        id: tu.id,
        function: {
          name: tu.name,
          arguments: JSON.stringify(tu.input)
        },
        result: null
      }));
      
      // Extract text content
      const textContent = message.content.filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');
      messageData.content = textContent;
    }
  }

  return messageData;
}

export function prepareConversationData(messages: any[]): MessageData[] {
  if (!messages || !Array.isArray(messages)) {
    return [];
  }

  const messageDataList: MessageData[] = [];
  
  for (const message of messages) {
    const messageData = convertMessageToMessageData(message);
    
    if (messageData && (messageData.role === 'user' || messageData.role === 'assistant')) {
      messageDataList.push(messageData);
    }
  }

  return messageDataList;
}

// Helper to merge consecutive items from the same thread/role into single messages
export function mergeConsecutiveMessages(messages: MessageData[]): MessageData[] {
  if (messages.length === 0) return [];

  const merged: MessageData[] = [];
  let current = { ...messages[0] };

  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];
    
    // Check if we can merge with current
    if (
      msg.role === current.role &&
      msg.threadId === current.threadId &&
      !msg.tools && !current.tools && // Don't merge messages with tools
      !msg.thinking_content && !current.thinking_content // Don't merge thinking states
    ) {
      // Merge content
      current.content = current.content + '\n\n' + msg.content;
    } else {
      // Can't merge, push current and start new
      merged.push(current);
      current = { ...msg };
    }
  }
  
  // Don't forget the last one
  merged.push(current);
  
  return merged;
}