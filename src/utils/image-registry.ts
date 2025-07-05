/**
 * Global Image Registry for Design Agent
 * Tracks all images with unique IDs and manages grid caching
 */

import crypto from 'crypto';
import fs, { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { downloadReferenceImage, needsDownload } from './reference-downloader.js';

export interface RegisteredImage {
    id: number;
    path: string;
    type: 'reference' | 'generated';
    category: 'inspiration' | 'draft' | 'medium' | 'final';
    title?: string;
    url?: string;
    timestamp: string;
}

export interface GridCacheEntry {
    gridPath: string;
    sourceImageIds: number[];
    gridName: string;
    hash: string;
    timestamp: string;
}

class ImageRegistry {
    private images: Map<number, RegisteredImage> = new Map();
    private pathToId: Map<string, number> = new Map();
    private gridCache: Map<string, GridCacheEntry> = new Map();
    private nextId: number = 1;
    private registryPath: string;
    private cacheDir: string;

    constructor() {
        const outputDir = process.env.DESIGN_OUTPUT_DIR || path.join(process.cwd(), '.output');
        this.registryPath = path.join(outputDir, 'metadata', 'image-registry.json');
        this.cacheDir = path.join(outputDir, 'grid-cache');
        this.loadRegistry();
    }

    /**
     * Register a new image and get its unique ID
     * Automatically downloads reference images to local filesystem
     */
    async registerImage(
        imagePath: string,
        type: 'reference' | 'generated',
        category: 'inspiration' | 'draft' | 'medium' | 'final',
        title?: string,
        url?: string
    ): Promise<number> {
        // Check if already registered first
        const existingId = this.pathToId.get(imagePath);
        if (existingId !== undefined) {
            return existingId;
        }
        
        // Get the ID that will be assigned
        const id = this.nextId;
        let finalPath = imagePath;
        
        // Handle reference images
        if (type === 'reference') {
            const designId = this.getCurrentDesignId();
            if (designId) {
                // Download remote images
                if (needsDownload(imagePath)) {
                    try {
                        const downloadResult = await downloadReferenceImage(imagePath, designId, id, title);
                        if (downloadResult.success) {
                            finalPath = downloadResult.localPath;
                            console.log(`[ImageRegistry] Downloaded reference image #${id}: ${imagePath} -> ${finalPath}`);
                        } else {
                            console.warn(`[ImageRegistry] Failed to download ${imagePath}: ${downloadResult.error}`);
                            // Keep original path as fallback
                        }
                    } catch (error) {
                        console.warn(`[ImageRegistry] Download error for ${imagePath}:`, error);
                        // Keep original path as fallback
                    }
                }
                // Copy local screenshots to reference folder with ID-based name
                else if (imagePath.includes('/screenshots/') && fs.existsSync(imagePath)) {
                    try {
                        const outputDir = process.env.DESIGN_OUTPUT_DIR || path.join(process.cwd(), '.output', designId);
                        const referenceDir = path.join(outputDir, 'reference');
                        
                        if (!fs.existsSync(referenceDir)) {
                            fs.mkdirSync(referenceDir, { recursive: true });
                        }
                        
                        const extension = path.extname(imagePath) || '.png';
                        const newPath = path.join(referenceDir, `${id}${extension}`);
                        
                        // Copy the file
                        fs.copyFileSync(imagePath, newPath);
                        finalPath = newPath;
                        console.log(`[ImageRegistry] Copied screenshot to reference #${id}: ${imagePath} -> ${finalPath}`);
                    } catch (error) {
                        console.warn(`[ImageRegistry] Failed to copy screenshot:`, error);
                        // Keep original path as fallback
                    }
                }
            }
        }

        // Create new registration and increment ID
        this.nextId++;
        const registration: RegisteredImage = {
            id,
            path: finalPath,
            type,
            category,
            title,
            url: url || (imagePath !== finalPath ? imagePath : undefined), // Store original URL if downloaded
            timestamp: new Date().toISOString()
        };

        this.images.set(id, registration);
        this.pathToId.set(finalPath, id);
        if (imagePath !== finalPath) {
            this.pathToId.set(imagePath, id); // Also map original URL
        }
        this.saveRegistry();

        console.log(`[ImageRegistry] Registered ${type} ${category} image #${id}: ${path.basename(finalPath)}`);
        return id;
    }

    /**
     * Synchronous version for backward compatibility
     */
    registerImageSync(
        imagePath: string,
        type: 'reference' | 'generated',
        category: 'inspiration' | 'draft' | 'medium' | 'final',
        title?: string,
        url?: string
    ): number {
        // Check if already registered
        const existingId = this.pathToId.get(imagePath);
        if (existingId !== undefined) {
            return existingId;
        }

        // Create new registration (without download)
        const id = this.nextId++;
        const registration: RegisteredImage = {
            id,
            path: imagePath,
            type,
            category,
            title,
            url,
            timestamp: new Date().toISOString()
        };

        this.images.set(id, registration);
        this.pathToId.set(imagePath, id);
        this.saveRegistry();

        console.log(`[ImageRegistry] Registered ${type} ${category} image #${id}: ${path.basename(imagePath)}`);
        return id;
    }

    /**
     * Get image by ID
     */
    getImage(id: number): RegisteredImage | undefined {
        return this.images.get(id);
    }

    /**
     * Get ID by path
     */
    getIdByPath(imagePath: string): number | undefined {
        return this.pathToId.get(imagePath);
    }

    /**
     * Get all images of a specific category
     */
    getImagesByCategory(category: 'inspiration' | 'draft' | 'medium' | 'final'): RegisteredImage[] {
        return Array.from(this.images.values()).filter(img => img.category === category);
    }

    /**
     * Generate a hash for a set of image IDs (for grid caching)
     */
    private generateGridHash(imageIds: number[], gridName: string): string {
        const sortedIds = [...imageIds].sort((a, b) => a - b);
        const content = `${gridName}-${sortedIds.join(',')}`;
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Check if a grid with these images already exists
     */
    getCachedGrid(imageIds: number[], gridName: string): string | null {
        const hash = this.generateGridHash(imageIds, gridName);
        const cached = this.gridCache.get(hash);
        
        if (cached && existsSync(cached.gridPath)) {
            console.log(`[ImageRegistry] Found cached grid for ${gridName} with images [${imageIds.join(', ')}]`);
            return cached.gridPath;
        }
        
        return null;
    }

    /**
     * Cache a generated grid
     */
    cacheGrid(gridPath: string, imageIds: number[], gridName: string): void {
        const hash = this.generateGridHash(imageIds, gridName);
        const entry: GridCacheEntry = {
            gridPath,
            sourceImageIds: imageIds,
            gridName,
            hash,
            timestamp: new Date().toISOString()
        };
        
        this.gridCache.set(hash, entry);
        this.saveRegistry();
        
        console.log(`[ImageRegistry] Cached grid ${gridName} with images [${imageIds.join(', ')}]`);
    }

    /**
     * Get a summary of all registered images
     */
    getSummary(): string {
        const categories = ['inspiration', 'draft', 'medium', 'final'] as const;
        let summary = '=== Image Registry Summary ===\n\n';
        
        for (const category of categories) {
            const images = this.getImagesByCategory(category);
            if (images.length > 0) {
                summary += `${category.toUpperCase()} (${images.length} images):\n`;
                images.forEach(img => {
                    summary += `  #${img.id}: ${path.basename(img.path)}`;
                    if (img.title) summary += ` - "${img.title}"`;
                    summary += '\n';
                });
                summary += '\n';
            }
        }
        
        return summary;
    }

    /**
     * Get a mapping of grid positions to unique IDs for a category
     */
    getGridMapping(category: 'inspiration' | 'draft' | 'medium' | 'final'): Map<number, number> {
        const images = this.getImagesByCategory(category);
        const mapping = new Map<number, number>();
        
        // Sort by ID to maintain consistent ordering
        images.sort((a, b) => a.id - b.id);
        
        images.forEach((img, index) => {
            mapping.set(index + 1, img.id); // Grid positions are 1-based
        });
        
        return mapping;
    }

    /**
     * Get the current design ID from the output directory
     */
    private getCurrentDesignId(): string | null {
        const outputDir = process.env.DESIGN_OUTPUT_DIR;
        if (!outputDir) {
            return null;
        }
        
        // Extract design ID from path like: /path/.output/design_id
        const pathParts = outputDir.split(path.sep);
        const outputIndex = pathParts.lastIndexOf('.output');
        
        if (outputIndex >= 0 && outputIndex < pathParts.length - 1) {
            return pathParts[outputIndex + 1];
        }
        
        return null;
    }

    /**
     * Clear the registry (useful for new design sessions)
     */
    clear(): void {
        this.images.clear();
        this.pathToId.clear();
        this.gridCache.clear();
        this.nextId = 1;
        this.saveRegistry();
        console.log('[ImageRegistry] Registry cleared');
    }

    /**
     * Save registry to disk
     */
    private saveRegistry(): void {
        try {
            const dir = path.dirname(this.registryPath);
            if (!existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const data = {
                nextId: this.nextId,
                images: Array.from(this.images.entries()),
                gridCache: Array.from(this.gridCache.entries())
            };

            writeFileSync(this.registryPath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (error) {
            console.error('[ImageRegistry] Failed to save registry:', error);
        }
    }

    /**
     * Load registry from disk
     */
    private loadRegistry(): void {
        try {
            if (existsSync(this.registryPath)) {
                const data = JSON.parse(readFileSync(this.registryPath, 'utf-8'));
                
                this.nextId = data.nextId || 1;
                
                if (data.images) {
                    data.images.forEach(([id, image]: [number, RegisteredImage]) => {
                        this.images.set(id, image);
                        this.pathToId.set(image.path, id);
                    });
                }
                
                if (data.gridCache) {
                    data.gridCache.forEach(([hash, entry]: [string, GridCacheEntry]) => {
                        this.gridCache.set(hash, entry);
                    });
                }
                
                console.log(`[ImageRegistry] Loaded registry with ${this.images.size} images`);
            }
        } catch (error) {
            console.error('[ImageRegistry] Failed to load registry:', error);
        }
    }
}

// Singleton instance
let registryInstance: ImageRegistry | null = null;

/**
 * Get or create the singleton registry instance
 */
export function getImageRegistry(): ImageRegistry {
    if (!registryInstance) {
        registryInstance = new ImageRegistry();
    }
    return registryInstance;
}

/**
 * Create a new registry instance (useful for new design sessions)
 */
export function createNewImageRegistry(): ImageRegistry {
    registryInstance = new ImageRegistry();
    registryInstance.clear();
    return registryInstance;
}