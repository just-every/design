#!/usr/bin/env npx tsx

import { design_search } from './src/design-search.js';

async function testFreepik() {
    console.log('🧪 Testing Freepik search engine...\n');
    
    try {
        const result = await design_search('freepik', 'logo design', 3);
        const results = JSON.parse(result);
        
        console.log(`✅ Freepik: Found ${results.length} results`);
        
        results.forEach((result: any, i: number) => {
            console.log(`\n${i + 1}. ${result.title}`);
            console.log(`   URL: ${result.url}`);
            console.log(`   Thumbnail: ${result.thumbnailURL ? 'Yes' : 'No'}`);
            if (result.thumbnailURL) {
                console.log(`   Thumbnail URL: ${result.thumbnailURL.substring(0, 80)}...`);
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testFreepik().catch(console.error);