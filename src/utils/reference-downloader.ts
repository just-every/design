/**
 * Reference Image Downloader
 * Downloads all reference images to local filesystem and maintains consistent local paths
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

export interface DownloadResult {
    originalUrl: string;
    localPath: string;
    success: boolean;
    error?: string;
}

/**
 * Download a reference image to the local reference directory with ID-based filename
 */
export async function downloadReferenceImage(
    imageUrl: string,
    designId: string,
    imageId: number,
    _title?: string
): Promise<DownloadResult> {
    try {
        // Create reference directory
        const outputDir = process.env.DESIGN_OUTPUT_DIR || path.join(process.cwd(), '.output', designId);
        const referenceDir = path.join(outputDir, 'reference');
        
        if (!fs.existsSync(referenceDir)) {
            fs.mkdirSync(referenceDir, { recursive: true });
        }
        
        // Simple ID-based filename
        const extension = getImageExtension(imageUrl);
        const filename = `${imageId}${extension}`;
        const localPath = path.join(referenceDir, filename);
        
        // Check if already downloaded
        if (fs.existsSync(localPath)) {
            console.log(`[ReferenceDownloader] Already exists: ${filename}`);
            return {
                originalUrl: imageUrl,
                localPath,
                success: true
            };
        }
        
        // Download the image
        console.log(`[ReferenceDownloader] Downloading: ${imageUrl}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; design-tool/1.0)'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Save to local file
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(localPath, buffer);
        
        console.log(`[ReferenceDownloader] Downloaded: ${filename} (${(buffer.length / 1024).toFixed(1)}KB)`);
        
        return {
            originalUrl: imageUrl,
            localPath,
            success: true
        };
        
    } catch (error) {
        console.error(`[ReferenceDownloader] Failed to download ${imageUrl}:`, error);
        
        return {
            originalUrl: imageUrl,
            localPath: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Removed batch download function - each image is downloaded individually with its ID

/**
 * Get file extension from URL or default to .jpg
 */
function getImageExtension(url: string): string {
    // Extract extension from URL
    const urlPath = url.split('?')[0]; // Remove query params
    const match = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (match) {
        return '.' + match[1].toLowerCase();
    }
    
    // Default to .jpg
    return '.jpg';
}


/**
 * Check if a URL is a remote image that needs downloading
 */
export function needsDownload(imagePath: string): boolean {
    return imagePath.startsWith('http://') || imagePath.startsWith('https://');
}

/**
 * Get expected local path for an image ID
 */
export function getExpectedLocalPath(imageId: number, imageUrl: string, designId: string): string {
    const outputDir = process.env.DESIGN_OUTPUT_DIR || path.join(process.cwd(), '.output', designId);
    const referenceDir = path.join(outputDir, 'reference');
    
    const extension = getImageExtension(imageUrl);
    const filename = `${imageId}${extension}`;
    
    return path.join(referenceDir, filename);
}