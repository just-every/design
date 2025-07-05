import { useState, useEffect } from 'react'
import { Card } from '@just-every/demo-ui'
import { DesignImages, ImageInfo } from '../types'

interface ImageGalleryProps {
  images: DesignImages
  outputDir?: string
}

type ImageCategory = 'inspiration' | 'drafts' | 'medium' | 'final'

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<ImageCategory>('final')
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null)
  const [imageDataCache, setImageDataCache] = useState<Record<string, string>>({})

  // Load image data when selected
  useEffect(() => {
    if (selectedImage && !imageDataCache[selectedImage.path]) {
      // In a real implementation, this would fetch from the server
      // For now, we'll construct the path
      const imagePath = `/api/images/${selectedImage.path}`
      fetch(imagePath)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader()
          reader.onloadend = () => {
            setImageDataCache(prev => ({
              ...prev,
              [selectedImage.path]: reader.result as string
            }))
          }
          reader.readAsDataURL(blob)
        })
        .catch(console.error)
    }
  }, [selectedImage, imageDataCache])

  const categories: { key: ImageCategory; label: string; count: number }[] = [
    { key: 'inspiration', label: 'Inspiration', count: images.inspiration.length },
    { key: 'drafts', label: 'Drafts', count: images.drafts.length },
    { key: 'medium', label: 'Medium Quality', count: images.medium.length },
    { key: 'final', label: 'Final', count: images.final.length }
  ]

  const currentImages = images[selectedCategory]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Category Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-glass)',
        paddingBottom: '12px'
      }}>
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            style={{
              padding: '8px 16px',
              background: selectedCategory === cat.key
                ? 'linear-gradient(135deg, rgba(74, 158, 255, 0.2), rgba(74, 158, 255, 0.1))'
                : 'var(--surface-glass)',
              border: 'none',
              borderRadius: '8px',
              color: selectedCategory === cat.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {cat.label}
            {cat.count > 0 && (
              <span style={{
                background: selectedCategory === cat.key
                  ? 'rgba(74, 158, 255, 0.3)'
                  : 'rgba(255, 255, 255, 0.1)',
                padding: '2px 6px',
                borderRadius: '12px',
                fontSize: '12px'
              }}>
                {cat.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Image Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {currentImages.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
            padding: '4px'
          }}>
            {currentImages.map((image) => (
              <div
                key={image.path}
                onClick={() => setSelectedImage(image)}
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
              >
                <Card
                  style={{
                    overflow: 'hidden'
                  }}
                  className="image-card"
                >
                <div style={{
                  aspectRatio: '1',
                  background: 'var(--surface-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}>
                  {imageDataCache[image.path] ? (
                    <img
                      src={imageDataCache[image.path]}
                      alt={image.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      color: 'var(--text-secondary)',
                      fontSize: '48px'
                    }}>
                      🖼️
                    </div>
                  )}
                  
                  {/* Image number overlay */}
                  {selectedCategory === 'drafts' && image.metadata.round && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      Round {image.metadata.round}
                    </div>
                  )}
                </div>
                
                <div style={{ padding: '12px' }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text)',
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {image.name}
                  </div>
                  
                  {image.metadata.title && (
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {image.metadata.title}
                    </div>
                  )}
                  
                  {image.metadata.score !== undefined && (
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--accent-primary)',
                      marginTop: '4px'
                    }}>
                      Score: {image.metadata.score.toFixed(2)}
                    </div>
                  )}
                </div>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-secondary)'
          }}>
            No {selectedCategory} images yet
          </div>
        )}
      </div>

      {/* Image Detail Modal */}
      {selectedImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <Card
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                overflow: 'auto'
              }}
            >
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                {imageDataCache[selectedImage.path] ? (
                  <img
                    src={imageDataCache[selectedImage.path]}
                    alt={selectedImage.name}
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: '70vh',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '400px',
                    height: '400px',
                    background: 'var(--surface-glass)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '72px',
                    color: 'var(--text-secondary)'
                  }}>
                    🖼️
                  </div>
                )}
              </div>
              
              <div style={{ width: '300px' }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '16px',
                  color: 'var(--text)'
                }}>
                  {selectedImage.name}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedImage.metadata.title && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Title
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                        {selectedImage.metadata.title}
                      </div>
                    </div>
                  )}
                  
                  {selectedImage.metadata.description && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Description
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                        {selectedImage.metadata.description}
                      </div>
                    </div>
                  )}
                  
                  {selectedImage.metadata.selection_reason && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Selection Reason
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                        {selectedImage.metadata.selection_reason}
                      </div>
                    </div>
                  )}
                  
                  {selectedImage.metadata.prompt && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Generation Prompt
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text)',
                        background: 'var(--surface-glass)',
                        padding: '8px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {selectedImage.metadata.prompt}
                      </div>
                    </div>
                  )}
                  
                  {selectedImage.metadata.engine && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Source
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                        {selectedImage.metadata.engine}
                      </div>
                    </div>
                  )}
                  
                  {selectedImage.metadata.score !== undefined && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Score
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--accent-primary)' }}>
                        {selectedImage.metadata.score.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}