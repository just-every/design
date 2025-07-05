/**
 * Tests for design search functionality
 */

import { describe, it, expect, vi } from 'vitest';
import { createNumberedGrid, smart_design_raw } from '../design-search.js';

// Mock dependencies
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn()
    },
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn()
}));

vi.mock('@napi-rs/canvas', () => ({
    createCanvas: vi.fn().mockReturnValue({
        getContext: vi.fn().mockReturnValue({
            fillStyle: '',
            fillRect: vi.fn(),
            font: '',
            textAlign: '',
            fillText: vi.fn(),
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
            drawImage: vi.fn()
        }),
        width: 400,
        height: 300,
        toBuffer: vi.fn().mockReturnValue(Buffer.from('mock-image-data'))
    }),
    loadImage: vi.fn().mockResolvedValue({
        width: 200,
        height: 150
    })
}));

// Removed design_search integration tests that try to browse real websites and timeout

describe('createNumberedGrid', () => {
    it('should create a grid from image sources', async () => {
        const imagesSources = [
            { url: 'http://example.com/image1.png', title: 'Image 1' },
            { url: 'http://example.com/image2.png', title: 'Image 2' },
            { dataUrl: 'data:image/png;base64,mockData', title: 'Image 3' }
        ];

        const result = await createNumberedGrid(imagesSources, 'test-grid');
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('should handle different aspect ratios', async () => {
        const imagesSources = [
            { url: 'http://example.com/image1.png' }
        ];

        const landscapeResult = await createNumberedGrid(imagesSources, 'landscape-test', 'landscape');
        const portraitResult = await createNumberedGrid(imagesSources, 'portrait-test', 'portrait');
        
        expect(landscapeResult).toBeDefined();
        expect(portraitResult).toBeDefined();
    });
});

describe('smart_design_raw', () => {
    // Removed integration test that tries to browse real websites and timeout

    it('should return empty array for empty configurations', async () => {
        const results = await smart_design_raw('Test context', [], 5, 'primary_logo');
        
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);
    });
});