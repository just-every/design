/**
 * Registry Cleanup Utility
 * Converts existing URL-based registry entries to local paths
 */

import { getImageRegistry } from './image-registry.js';
import { downloadReferenceImage, needsDownload } from './reference-downloader.js';

/**
 * Clean up the registry by downloading all remote reference images to local paths
 */
export async function cleanupRegistryPaths(): Promise<void> {
    const registry = getImageRegistry();
    const allImages = Array.from(registry['images'].values());
    
    console.log(`[RegistryCleanup] Checking ${allImages.length} registered images...`);
    
    let downloadCount = 0;
    let errorCount = 0;
    
    for (const image of allImages) {
        if (image.type === 'reference' && needsDownload(image.path)) {
            try {
                console.log(`[RegistryCleanup] Processing image #${image.id}: ${image.path}`);
                
                // Extract design ID from environment or use a default
                const designId = getCurrentDesignId() || 'reference_downloads';
                
                const downloadResult = await downloadReferenceImage(image.path, designId, image.id, image.title);
                
                if (downloadResult.success) {
                    // Update the registry entry
                    const updatedImage = {
                        ...image,
                        path: downloadResult.localPath,
                        url: image.path // Store original URL
                    };
                    
                    registry['images'].set(image.id, updatedImage);
                    registry['pathToId'].delete(image.path); // Remove old path mapping
                    registry['pathToId'].set(downloadResult.localPath, image.id); // Add new path mapping
                    
                    console.log(`[RegistryCleanup] ✅ Downloaded #${image.id}: ${downloadResult.localPath}`);
                    downloadCount++;
                } else {
                    console.warn(`[RegistryCleanup] ❌ Failed to download #${image.id}: ${downloadResult.error}`);
                    errorCount++;
                }
                
                // Small delay between downloads
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`[RegistryCleanup] Error processing image #${image.id}:`, error);
                errorCount++;
            }
        }
    }
    
    // Save the updated registry
    registry['saveRegistry']();
    
    console.log(`[RegistryCleanup] Complete: ${downloadCount} downloaded, ${errorCount} errors`);
}

/**
 * Get the current design ID from environment
 */
function getCurrentDesignId(): string | null {
    const outputDir = process.env.DESIGN_OUTPUT_DIR;
    if (!outputDir) {
        return null;
    }
    
    // Extract design ID from path like: /path/.output/design_id
    const pathParts = outputDir.split('/');
    const outputIndex = pathParts.lastIndexOf('.output');
    
    if (outputIndex >= 0 && outputIndex < pathParts.length - 1) {
        return pathParts[outputIndex + 1];
    }
    
    return null;
}

/**
 * Get summary of what needs to be cleaned up
 */
export function getCleanupSummary(): { totalImages: number, needsDownload: number, alreadyLocal: number } {
    const registry = getImageRegistry();
    const allImages = Array.from(registry['images'].values());
    
    let needsDownloadCount = 0;
    let alreadyLocalCount = 0;
    
    for (const image of allImages) {
        if (image.type === 'reference' && needsDownload(image.path)) {
            needsDownloadCount++;
        } else {
            alreadyLocalCount++;
        }
    }
    
    return {
        totalImages: allImages.length,
        needsDownload: needsDownloadCount,
        alreadyLocal: alreadyLocalCount
    };
}