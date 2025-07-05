import { GlassButton } from '@just-every/demo-ui'
import { DesignExample } from '../types'
import type { DESIGN_ASSET_TYPES } from '../../../src/constants.js'

const DESIGN_EXAMPLES: DesignExample[] = [
  {
    id: 'tech-logo',
    title: 'Tech Startup Logo',
    prompt: 'Create a modern logo for a tech startup called "DataFlow" that specializes in data analytics',
    assetType: 'primary_logo' as DESIGN_ASSET_TYPES,
    withInspiration: true,
    description: 'Modern, minimal tech logo design'
  },
  {
    id: 'shopping-icon',
    title: 'Shopping Cart Icon',
    prompt: 'Design a clean, flat-style shopping cart icon for an e-commerce mobile app',
    assetType: 'system_icon_library' as DESIGN_ASSET_TYPES,
    withInspiration: true,
    description: 'Flat design icon for mobile'
  },
  {
    id: 'login-ui',
    title: 'Login Screen UI',
    prompt: 'Create a modern login screen design with email and password fields, remember me checkbox, and social login options',
    assetType: 'authentication_page_mockup' as DESIGN_ASSET_TYPES,
    withInspiration: true,
    description: 'Clean login interface design'
  },
  {
    id: 'nature-background',
    title: 'Nature Background',
    prompt: 'Design an abstract nature-inspired background with soft gradients and organic shapes',
    assetType: 'background_textures' as DESIGN_ASSET_TYPES,
    withInspiration: true,
    description: 'Abstract nature background'
  },
  {
    id: 'social-media-template',
    title: 'Social Media Post',
    prompt: 'Create an Instagram post template for a coffee shop promotion with space for text and product image',
    assetType: 'open_graph_card' as DESIGN_ASSET_TYPES,
    withInspiration: true,
    description: 'Instagram post template'
  }
]

interface DesignExamplesProps {
  selectedExample: string
  onSelectExample: (example: string) => void
  selectedAssetType: string
  onSelectAssetType: (assetType: string) => void
  customPrompt: string
  onCustomPromptChange: (prompt: string) => void
  withInspiration: boolean
  onWithInspirationChange: (value: boolean) => void
  onRunDesign: () => void
  onStop: () => void
  isRunning: boolean
  canRun: boolean
  compact?: boolean
}

export default function DesignExamples({
  selectedExample,
  onSelectExample,
  selectedAssetType,
  onSelectAssetType,
  customPrompt,
  onCustomPromptChange,
  withInspiration,
  onWithInspirationChange,
  onRunDesign,
  onStop,
  isRunning,
  canRun,
  compact = false
}: DesignExamplesProps) {
  const handleExampleSelect = (example: DesignExample) => {
    onSelectExample(example.prompt)
    onSelectAssetType(example.assetType)
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          marginBottom: '12px',
          color: 'var(--text)'
        }}>
          Examples
        </h3>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px' 
        }}>
          {DESIGN_EXAMPLES.map(example => (
            <button
              key={example.id}
              onClick={() => handleExampleSelect(example)}
              style={{
                padding: '12px 16px',
                background: selectedExample === example.prompt 
                  ? 'linear-gradient(135deg, rgba(74, 158, 255, 0.15), rgba(74, 158, 255, 0.05))'
                  : 'var(--surface-glass)',
                border: selectedExample === example.prompt
                  ? '1px solid rgba(74, 158, 255, 0.3)'
                  : '1px solid var(--border-glass)',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '500', 
                color: 'var(--text)',
                marginBottom: '4px'
              }}>
                {example.title}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: 'var(--text-secondary)'
              }}>
                {example.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          marginBottom: '12px',
          color: 'var(--text)'
        }}>
          Custom Prompt
        </h3>
        <textarea
          value={customPrompt}
          onChange={(e) => {
            onCustomPromptChange(e.target.value)
            if (e.target.value) onSelectExample('')
          }}
          placeholder="Enter your design prompt..."
          style={{
            width: '100%',
            minHeight: compact ? '80px' : '100px',
            padding: '12px',
            background: 'var(--surface-glass)',
            border: '1px solid var(--border-glass)',
            borderRadius: '8px',
            color: 'var(--text)',
            fontSize: '14px',
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
        />
        
        {customPrompt && (
          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text)' }}>
              Asset Type:
            </label>
            <select
              value={selectedAssetType}
              onChange={(e) => onSelectAssetType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginTop: '8px',
                background: 'var(--surface-glass)',
                border: '1px solid var(--border-glass)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '14px'
              }}
            >
              <option value="">Select asset type...</option>
              <option value="primary_logo">Primary Logo</option>
              <option value="system_icon_library">Icon Library</option>
              <option value="homepage_mockup">Homepage Mockup</option>
              <option value="authentication_page_mockup">Login Page</option>
              <option value="dashboard_page_mockup">Dashboard</option>
              <option value="background_textures">Background Textures</option>
              <option value="spot_illustrations">Illustrations</option>
              <option value="open_graph_card">Social Media Card</option>
              <option value="loading_indicator">Loading Indicator</option>
            </select>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          color: 'var(--text)'
        }}>
          <input
            type="checkbox"
            checked={withInspiration}
            onChange={(e) => onWithInspirationChange(e.target.checked)}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer'
            }}
          />
          Search for inspiration images
        </label>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          marginTop: '4px',
          marginLeft: '24px'
        }}>
          When enabled, the system will search for reference images before generating designs
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '8px' 
      }}>
        {isRunning ? (
          <GlassButton 
            onClick={onStop}
            variant="danger"
            style={{ flex: 1 }}
          >
            Stop
          </GlassButton>
        ) : (
          <GlassButton 
            onClick={onRunDesign}
            disabled={!canRun}
            style={{ flex: 1 }}
          >
            Generate Design
          </GlassButton>
        )}
      </div>
    </div>
  )
}