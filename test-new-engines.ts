#!/usr/bin/env npx tsx

/**
 * Test script to verify all new search engines work properly
 */

import { design_search } from './src/design-search.js';
import { DESIGN_SEARCH_ENGINES } from './src/constants.js';

async function testSearchEngine(engine: string, query: string) {
    console.log(`\n🔍 Testing ${engine}...`);
    
    try {
        const result = await design_search(engine as any, query, 3);
        const results = JSON.parse(result);
        
        console.log(`✅ ${engine}: Found ${results.length} results`);
        
        if (results.length > 0) {
            const firstResult = results[0];
            console.log(`   First result: ${firstResult.title}`);
            console.log(`   URL: ${firstResult.url}`);
            console.log(`   Has thumbnail: ${firstResult.thumbnailURL ? 'Yes' : 'No'}`);
        }
        
        return results.length > 0;
    } catch (error) {
        console.log(`❌ ${engine}: Error - ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

async function testAllEngines() {
    console.log('🧪 Testing all search engines with "logo design" query...\n');
    
    const query = "logo design";
    const newEngines = ['unsplash', 'freepik', 'vecteezy', 'brave_images'];
    const existingEngines = ['dribbble', 'behance', 'pinterest'];
    
    console.log('=== New Search Engines ===');
    let newEngineResults = 0;
    for (const engine of newEngines) {
        const success = await testSearchEngine(engine, query);
        if (success) newEngineResults++;
    }
    
    console.log('\n=== Existing Search Engines ===');
    let existingEngineResults = 0;
    for (const engine of existingEngines) {
        const success = await testSearchEngine(engine, query);
        if (success) existingEngineResults++;
    }
    
    console.log('\n=== Summary ===');
    console.log(`New engines working: ${newEngineResults}/${newEngines.length}`);
    console.log(`Existing engines working: ${existingEngineResults}/${existingEngines.length}`);
    console.log(`Total engines available: ${DESIGN_SEARCH_ENGINES.length}`);
    
    if (newEngineResults === newEngines.length) {
        console.log('✅ All new search engines are working!');
    } else {
        console.log('⚠️ Some new search engines have issues');
    }
}

testAllEngines().catch(console.error);