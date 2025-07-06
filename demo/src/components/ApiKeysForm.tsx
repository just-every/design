import { useState } from 'react'
import { GlassButton, Card } from '@just-every/demo-ui'

export interface ApiKeys {
  openai?: string
  anthropic?: string
  google?: string
  xai?: string
}

interface Props {
  apiKeys: ApiKeys
  onChange: (keys: ApiKeys) => void
}

export default function ApiKeysForm({ apiKeys, onChange }: Props) {
  const [openai, setOpenai] = useState(apiKeys.openai || '')
  const [anthropic, setAnthropic] = useState(apiKeys.anthropic || '')
  const [google, setGoogle] = useState(apiKeys.google || '')
  const [xai, setXai] = useState(apiKeys.xai || '')

  const save = () => {
    const newKeys = { openai, anthropic, google, xai }
    onChange(newKeys)
    if (typeof window !== 'undefined') {
      localStorage.setItem('demo_api_keys', JSON.stringify(newKeys))
    }
  }

  return (
    <Card style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div>
        <input placeholder="OPENAI_API_KEY" value={openai} onChange={e => setOpenai(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div>
        <input placeholder="ANTHROPIC_API_KEY" value={anthropic} onChange={e => setAnthropic(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div>
        <input placeholder="GOOGLE_API_KEY" value={google} onChange={e => setGoogle(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div>
        <input placeholder="XAI_API_KEY" value={xai} onChange={e => setXai(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div style={{ marginTop: '8px' }}>
        <GlassButton onClick={save}>Save Keys</GlassButton>
      </div>
    </Card>
  )
}
