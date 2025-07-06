import { useCallback } from 'react'
import { runDesignAgentStreaming } from '../../../src/index.js'
import { DesignState, LLMRequest } from '../types'
import type { ApiKeys } from '../components/ApiKeysForm'

interface Options {
  onStateUpdate: (state: DesignState | null) => void
  onLLMRequest: (request: LLMRequest) => void
  apiKeys: ApiKeys
}

export default function useDesignRunnerClient({ onStateUpdate, onLLMRequest, apiKeys }: Options) {
  const runDesign = useCallback(async (prompt: string, assetType?: string, withInspiration = true) => {
    if (apiKeys.openai) (process.env as any).OPENAI_API_KEY = apiKeys.openai
    if (apiKeys.anthropic) (process.env as any).ANTHROPIC_API_KEY = apiKeys.anthropic
    if (apiKeys.google) (process.env as any).GOOGLE_API_KEY = apiKeys.google
    if (apiKeys.xai) (process.env as any).XAI_API_KEY = apiKeys.xai

    const state: DesignState = {
      id: `design_${Date.now()}`,
      prompt,
      assetType: assetType as any,
      withInspiration,
      startTime: new Date(),
      status: 'running',
      messages: [],
      phases: []
    }
    onStateUpdate({ ...state })

    try {
      for await (const event of runDesignAgentStreaming(assetType as any, prompt, withInspiration)) {
        if (event.type === 'message') {
          state.messages.push(event.data)
        } else if (event.type === 'stream-event' && event.data.type === 'text') {
          // no-op for now
        }
      }
      state.status = 'completed'
      state.endTime = new Date()
    } catch (err: any) {
      state.status = 'error'
      state.error = err.message
    }
    onStateUpdate({ ...state })
  }, [apiKeys, onStateUpdate])

  const stopDesign = useCallback(() => {
    // client run cannot be stopped yet
  }, [])

  return { runDesign, stopDesign, getImage: () => {}, connect: () => {} }
}
