import { Card } from '@just-every/demo-ui'

interface ReportViewProps {
  report: string
  metadata?: {
    design_id: string
    design_type: string
    user_prompt: string
    created_at: string
  }
}

export default function ReportView({ report, metadata }: ReportViewProps) {
  // Parse the report sections
  const sections = report.split(/\n(?=[A-Z\s]+:)/).map(section => {
    const lines = section.trim().split('\n')
    const title = lines[0].replace(':', '').trim()
    const content = lines.slice(1).join('\n').trim()
    return { title, content }
  })

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {metadata && (
        <Card style={{ marginBottom: '20px' }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '16px',
            color: 'var(--text)'
          }}>
            Design Information
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Design ID
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text)', fontFamily: 'monospace' }}>
                {metadata.design_id}
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Asset Type
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                {metadata.design_type}
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Created At
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                {new Date(metadata.created_at).toLocaleString()}
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              User Prompt
            </div>
            <div style={{
              fontSize: '14px',
              color: 'var(--text)',
              background: 'var(--surface-glass)',
              padding: '12px',
              borderRadius: '8px',
              fontStyle: 'italic'
            }}>
              "{metadata.user_prompt}"
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '20px',
          color: 'var(--text)'
        }}>
          Research Report
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {sections.map((section, index) => (
            <div key={index}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {section.title === 'GENERAL GUIDELINES' && '📋'}
                {section.title === 'IDEAL CHARACTERISTICS' && '✨'}
                {section.title === 'WARNINGS' && '⚠️'}
                {section.title === 'INSPIRATION' && '💡'}
                {section.title === 'JUDGING CRITERIA' && '⚖️'}
                {section.title}
              </h4>
              
              <div style={{
                fontSize: '14px',
                color: 'var(--text)',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                background: 'var(--surface-glass)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)'
              }}>
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}