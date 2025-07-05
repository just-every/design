#!/usr/bin/env npx tsx

/**
 * Test script to verify improved grid generation with:
 * - Duplicate detection
 * - Empty/broken image handling
 * - web_search engine availability
 */

import { smart_design_improved } from './src/design-search.js';
import { DESIGN_ASSET_TYPES } from './src/constants.js';

async function testImprovedGrid() {
    console.log('🧪 Testing improved grid generation system...\n');

    try {
        // Test 1: Verify duplicate detection and web_search availability
        console.log('Test 1: Running search with multiple engines including web_search...');
        
        const searchConfigs = [
            { engine: 'dribbble' as const, query: 'modern tech logo minimal' },
            { engine: 'behance' as const, query: 'technology startup branding' },
            { engine: 'pinterest' as const, query: 'tech company logo design' },
            { engine: 'web_search' as const, query: 'tech startup logo examples' }
        ];

        const results = await smart_design_improved(
            'Design a modern technology startup logo',
            searchConfigs,
            9,
            'primary_logo' as DESIGN_ASSET_TYPES,
            'Select high-quality, modern, minimal logo designs that would work well for a tech startup'
        );

        console.log(`✅ Search completed: ${results.length} unique results`);
        
        // Check for duplicates
        const urls = new Set<string>();
        let duplicates = 0;
        
        for (const result of results) {
            const url = result.screenshotURL || result.thumbnailURL || result.url;
            if (urls.has(url)) {
                duplicates++;
                console.log(`⚠️  Duplicate found: ${url}`);
            }
            urls.add(url);
        }
        
        if (duplicates === 0) {
            console.log('✅ No duplicates detected in final results');
        } else {
            console.log(`❌ Found ${duplicates} duplicates in final results`);
        }
        
        // Test 2: Check if images are valid
        console.log('\nTest 2: Checking image validity...');
        let invalidImages = 0;
        
        for (const result of results) {
            if (!result.screenshotURL && !result.thumbnailURL) {
                invalidImages++;
                console.log(`⚠️  Invalid image: ${result.url} (no screenshot/thumbnail)`);
            }
        }
        
        if (invalidImages === 0) {
            console.log('✅ All images have valid URLs');
        } else {
            console.log(`❌ Found ${invalidImages} invalid images`);
        }
        
        console.log('\n✅ Grid improvement tests completed!');
        console.log(`Final stats: ${results.length} unique results from ${searchConfigs.length} engines`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testImprovedGrid().catch(console.error);