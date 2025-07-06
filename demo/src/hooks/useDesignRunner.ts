import useDesignRunnerServer from './useDesignRunnerServer'
import useDesignRunnerClient from './useDesignRunnerClient'
import type { ApiKeys } from '../components/ApiKeysForm'
import { DesignState, LLMRequest } from '../types'

interface Options {
  onStateUpdate: (state: DesignState | null) => void
  onLLMRequest: (request: LLMRequest) => void
  apiKeys?: ApiKeys
}

export function useDesignRunner(options: Options) {
  if (options.apiKeys && Object.values(options.apiKeys).some(k => k)) {
    return useDesignRunnerClient({ ...options, apiKeys: options.apiKeys })
  }
  return useDesignRunnerServer(options)
}
