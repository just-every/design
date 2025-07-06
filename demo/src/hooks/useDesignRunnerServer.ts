import { useRef, useCallback, useState } from 'react'
import { DesignState, LLMRequest } from '../types'

interface UseDesignRunnerOptions {
  onStateUpdate: (state: DesignState | null) => void
  onLLMRequest: (request: LLMRequest) => void
}

export function useDesignRunner({ onStateUpdate, onLLMRequest }: UseDesignRunnerOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const isConnectedRef = useRef(false)
  const [, setLLMRequests] = useState<LLMRequest[]>([])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const ws = new WebSocket('ws://localhost:3456')

    ws.onopen = () => {
      console.log('Connected to design server')
      isConnectedRef.current = true
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'design_state':
            onStateUpdate(data.state)
            break
            
          case 'design_complete':
            onStateUpdate(data.state)
            break
            
          case 'design_error':
            onStateUpdate(data.state)
            break
            
          case 'llm_request':
            const newRequest: LLMRequest = {
              id: data.id,
              agentId: data.agentId,
              provider: data.provider,
              model: data.model,
              timestamp: data.timestamp,
              messages: data.messages,
              temperature: data.temperature,
              maxTokens: data.maxTokens
            }
            setLLMRequests(prev => [...prev, newRequest])
            onLLMRequest(newRequest)
            break
            
          case 'llm_response':
            // Find and update the request
            setLLMRequests(requests => {
              const updated = requests.map(req => 
                req.id === data.requestId 
                  ? {
                      ...req,
                      response: {
                        content: data.content,
                        usage: data.usage,
                        duration: data.duration
                      }
                    }
                  : req
              )
              // Also notify via callback
              const updatedReq = updated.find(r => r.id === data.requestId)
              if (updatedReq) onLLMRequest(updatedReq)
              return updated
            })
            break
            
          case 'llm_error':
            // Find and update the request with error
            setLLMRequests(requests => {
              const updated = requests.map(req => 
                req.id === data.requestId 
                  ? {
                      ...req,
                      error: data.error
                    }
                  : req
              )
              // Also notify via callback
              const updatedReq = updated.find(r => r.id === data.requestId)
              if (updatedReq) onLLMRequest(updatedReq)
              return updated
            })
            break
            
          case 'stream_text':
            // Handle streaming text if needed
            console.log('Stream text:', data.text)
            break
            
          case 'tool_use':
            console.log('Tool use:', data.tool, data.input)
            break
            
          case 'tool_result':
            console.log('Tool result:', data.tool, data.result)
            break
        }
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('Disconnected from design server')
      isConnectedRef.current = false
    }

    wsRef.current = ws
  }, [onStateUpdate, onLLMRequest])

  const runDesign = useCallback(async (prompt: string, assetType?: string, withInspiration: boolean = true) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connect()
      // Wait for connection
      await new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection)
            resolve(true)
          }
        }, 100)
      })
    }

    wsRef.current?.send(JSON.stringify({
      type: 'run_design',
      prompt,
      assetType,
      withInspiration
    }))
  }, [connect])

  const stopDesign = useCallback(() => {
    wsRef.current?.send(JSON.stringify({
      type: 'stop_design'
    }))
  }, [])

  const getImage = useCallback((path: string) => {
    wsRef.current?.send(JSON.stringify({
      type: 'get_image',
      path
    }))
  }, [])

  return {
    runDesign,
    stopDesign,
    getImage,
    connect
  }
}
