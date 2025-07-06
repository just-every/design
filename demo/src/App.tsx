import { useState, useCallback, useEffect } from 'react'
import { 
  Card, 
  formatNumber,
  formatCurrency
} from '@just-every/demo-ui'
import DesignExamples from './components/DesignExamples'
import ImageGallery from './components/ImageGallery'
import LLMRequestLog from './components/LLMRequestLog'
import ReportView from './components/ReportView'
import ConversationView from './components/ConversationView'
import ApiKeysForm, { ApiKeys } from './components/ApiKeysForm'
import { useDesignRunner } from './hooks/useDesignRunner'
import { DesignState, LLMRequest } from './types'
import './App.scss'

type TabType = 'images' | 'conversation' | 'requests' | 'reports'

function App() {
  const [designState, setDesignState] = useState<DesignState | null>(null)
  const [llmRequests, setLLMRequests] = useState<LLMRequest[]>([])
  const [selectedExample, setSelectedExample] = useState<string>('')
  const [selectedAssetType, setSelectedAssetType] = useState<string>('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('images')
  const [totalTokens, setTotalTokens] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [withInspiration, setWithInspiration] = useState(true)
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(localStorage.getItem('demo_api_keys') || '{}')
    } catch {
      return {}
    }
  })

  const { runDesign, stopDesign, connect } = useDesignRunner({
    onStateUpdate: setDesignState,
    onLLMRequest: (request) => {
      setLLMRequests(prev => {
        // Check if this is an update to an existing request
        const existingIndex = prev.findIndex(r => r.id === request.id)
        if (existingIndex >= 0) {
          // Update existing request
          const updated = [...prev]
          updated[existingIndex] = request
          return updated
        } else {
          // Add new request
          return [...prev, request]
        }
      })
      
      // Update stats when we have a response
      if (request.response?.usage) {
        setTotalTokens(prev => prev + request.response!.usage.totalTokens)
        setTotalCost(prev => prev + (request.response!.usage.totalTokens * 0.00001)) // Mock cost calculation
      }
    },
    apiKeys
  })

  // Connect to WebSocket on mount
  useEffect(() => {
    connect()
  }, [connect])

  const handleRunDesign = useCallback(async () => {
    const prompt = selectedExample || customPrompt
    if (!prompt) return

    setIsRunning(true)
    setDesignState(null)
    setLLMRequests([])
    setTotalTokens(0)
    setTotalCost(0)

    try {
      await runDesign(prompt, selectedAssetType, withInspiration)
    } catch (error) {
      console.error('Design generation failed:', error)
    } finally {
      setIsRunning(false)
    }
  }, [selectedExample, customPrompt, selectedAssetType, withInspiration, runDesign])

  const handleStop = useCallback(() => {
    stopDesign()
    setIsRunning(false)
  }, [stopDesign])


  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left Sidebar - Examples and Stats */}
      <div
        style={{
          width: '350px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          height: '100vh',
          overflow: 'auto'
        }}
      >
        <div style={{ 
          fontSize: '24px', 
          fontWeight: '700', 
          color: 'var(--accent-primary)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(74, 158, 255, 0.1), rgba(74, 158, 255, 0.05))',
          border: '1px solid rgba(74, 158, 255, 0.2)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          🎨 Design Demo
        </div>

        <Card>
          <ApiKeysForm apiKeys={apiKeys} onChange={setApiKeys} />
        </Card>

        <Card>
          <DesignExamples
            selectedExample={selectedExample}
            onSelectExample={setSelectedExample}
            selectedAssetType={selectedAssetType}
            onSelectAssetType={setSelectedAssetType}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
            withInspiration={withInspiration}
            onWithInspirationChange={setWithInspiration}
            onRunDesign={handleRunDesign}
            onStop={handleStop}
            isRunning={isRunning}
            canRun={!!(selectedExample || customPrompt)}
            compact
          />
        </Card>

        <Card>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            <div style={{
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {formatNumber(totalTokens)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tokens</div>
            </div>
            
            <div style={{
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {formatCurrency(totalCost)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cost</div>
            </div>
            
            <div style={{
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {llmRequests.length.toString()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Requests</div>
            </div>
            
            <div style={{
              padding: '12px',
              background: 'var(--surface-glass)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                {designState?.images ? 
                  (designState.images.inspiration.length + 
                   designState.images.drafts.length + 
                   designState.images.medium.length + 
                   designState.images.final.length).toString() : '0'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Images</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Panel - Full Height Tabs */}
      <div style={{ 
        flex: 1,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px'
      }}>
        <Card style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}>
          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-glass)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <button
              className={`nav-tab ${activeTab === 'images' ? 'active' : ''}`}
              onClick={() => setActiveTab('images')}
              style={{
                border: 'none',
                background: activeTab === 'images' 
                  ? 'linear-gradient(135deg, rgba(74, 158, 255, 0.2), rgba(74, 158, 255, 0.1))'
                  : 'var(--surface-glass)',
                color: activeTab === 'images' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🖼️ Images
            </button>

            <button
              className={`nav-tab ${activeTab === 'conversation' ? 'active' : ''}`}
              onClick={() => setActiveTab('conversation')}
              style={{
                border: 'none',
                background: activeTab === 'conversation' 
                  ? 'linear-gradient(135deg, rgba(74, 158, 255, 0.2), rgba(74, 158, 255, 0.1))'
                  : 'var(--surface-glass)',
                color: activeTab === 'conversation' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              💬 Conversation
            </button>

            <button
              className={`nav-tab ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
              style={{
                border: 'none',
                background: activeTab === 'requests'
                  ? 'linear-gradient(135deg, rgba(74, 158, 255, 0.2), rgba(74, 158, 255, 0.1))'
                  : 'var(--surface-glass)',
                color: activeTab === 'requests' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📋 Requests {llmRequests.length > 0 && `(${llmRequests.length})`}
            </button>
            
            <button
              className={`nav-tab ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
              style={{
                border: 'none',
                background: activeTab === 'reports'
                  ? 'linear-gradient(135deg, rgba(74, 158, 255, 0.2), rgba(74, 158, 255, 0.1))'
                  : 'var(--surface-glass)',
                color: activeTab === 'reports' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📄 Reports
            </button>
          </div>

          {/* Tab Content */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflow: 'auto',
            minHeight: 0
          }}>
            {activeTab === 'images' && (
              <div style={{ height: '100%' }}>
                {designState?.images ? (
                  <ImageGallery
                    images={designState.images}
                    outputDir={designState.outputDir}
                  />
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-secondary)'
                  }}>
                    No images yet. Run a design to generate images.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'conversation' && (
              <div style={{ height: '100%' }}>
                {designState?.messages ? (
                  <ConversationView
                    messages={designState.messages}
                    isCompactView={false}
                  />
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-secondary)'
                  }}>
                    No conversation yet. Run a design to start.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'requests' && (
              <div style={{ height: '100%' }}>
                {llmRequests.length > 0 ? (
                  <LLMRequestLog requests={llmRequests} />
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-secondary)'
                  }}>
                    No LLM requests yet.
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'reports' && (
              <div style={{ height: '100%' }}>
                {designState?.researchReport ? (
                  <ReportView
                    report={designState.researchReport}
                    metadata={designState.metadata}
                  />
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-secondary)'
                  }}>
                    No research report yet. Run a design to generate reports.
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default App