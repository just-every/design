/**
 * Unified ID Resolution System
 * Handles conversion between unique IDs and file paths consistently across the entire system
 */

import { getImageRegistry } from './image-registry.js';

export interface ResolvedImage {
    uniqueId: number;
    filePath: string;
    category: 'inspiration' | 'draft' | 'medium' | 'final';
}

/**
 * Resolve a unique ID to a file path for a specific category
 */
export function resolveUniqueIdToPath(
    uniqueId: number, 
    category: 'inspiration' | 'draft' | 'medium' | 'final'
): string | null {
    const registry = getImageRegistry();
    const image = registry.getImage(uniqueId);
    
    if (!image) {
        console.warn(`[IDResolver] Unique ID #${uniqueId} not found in registry`);
        return null;
    }
    
    if (image.category !== category) {
        console.warn(`[IDResolver] Unique ID #${uniqueId} is ${image.category}, expected ${category}`);
        return null;
    }
    
    console.log(`[IDResolver] Resolved #${uniqueId} (${category}) -> ${image.path}`);
    return image.path;
}

/**
 * Resolve multiple unique IDs to file paths for a specific category
 */
export function resolveUniqueIdsToPaths(
    uniqueIds: number[], 
    category: 'inspiration' | 'draft' | 'medium' | 'final'
): string[] {
    const paths: string[] = [];
    
    for (const id of uniqueIds) {
        const path = resolveUniqueIdToPath(id, category);
        if (path) {
            paths.push(path);
        }
    }
    
    return paths;
}

/**
 * Get all unique IDs for a specific category
 */
export function getUniqueIdsForCategory(category: 'inspiration' | 'draft' | 'medium' | 'final'): number[] {
    const registry = getImageRegistry();
    const images = registry.getImagesByCategory(category);
    return images.map(img => img.id).sort((a, b) => a - b);
}

/**
 * Validate that unique IDs exist and belong to the specified category
 */
export function validateUniqueIds(
    uniqueIds: number[], 
    category: 'inspiration' | 'draft' | 'medium' | 'final'
): { valid: number[], invalid: number[] } {
    const valid: number[] = [];
    const invalid: number[] = [];
    
    for (const id of uniqueIds) {
        const path = resolveUniqueIdToPath(id, category);
        if (path) {
            valid.push(id);
        } else {
            invalid.push(id);
        }
    }
    
    return { valid, invalid };
}

/**
 * Get a mapping of unique IDs to their array positions for backward compatibility
 * This helps with systems that still need array indexing
 */
export function getUniqueIdToArrayPositionMapping(
    imagePaths: string[], 
    _category: 'inspiration' | 'draft' | 'medium' | 'final'
): Map<number, number> {
    const registry = getImageRegistry();
    const mapping = new Map<number, number>();
    
    for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        const uniqueId = registry.getIdByPath(imagePath);
        
        if (uniqueId !== undefined) {
            mapping.set(uniqueId, i);
            console.log(`[IDResolver] Unique ID #${uniqueId} -> array position ${i} (${imagePath})`);
        }
    }
    
    return mapping;
}

/**
 * Convert unique ID to array index for a given array of paths
 */
export function uniqueIdToArrayIndex(
    uniqueId: number, 
    imagePaths: string[]
): number | null {
    const registry = getImageRegistry();
    const image = registry.getImage(uniqueId);
    
    if (!image) {
        return null;
    }
    
    // Find the index in the array
    const index = imagePaths.findIndex(path => path === image.path);
    return index >= 0 ? index : null;
}