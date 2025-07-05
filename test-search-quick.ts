/**
 * Quick test of search engines
 */

import { config } from 'dotenv';
import { design_search } from './src/design-search.js';
import { web_search as engineWebSearch } from '@just-every/search';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
config();

async function quickTest() {
    console.log('=== QUICK SEARCH ENGINE TEST ===\n');
    
    // Test design-specific engines
    console.log('🎨 Design Engines:');
    
    // Test Dribbble
    try {
        const dribbble = await design_search('dribbble', 'logo design', 2);
        const results = JSON.parse(dribbble);
        console.log(`✅ Dribbble: ${results.length} results`);
    } catch (e) {
        console.log(`❌ Dribbble: ${e.message}`);
    }
    
    // Test Behance
    try {
        const behance = await design_search('behance', 'logo design', 2);
        const results = JSON.parse(behance);
        console.log(`✅ Behance: ${results.length} results`);
    } catch (e) {
        console.log(`❌ Behance: ${e.message}`);
    }
    
    // Test web search engines
    console.log('\n🌐 Web Search Engines:');
    const webEngines = ['google', 'anthropic', 'openai', 'xai', 'brave'];
    
    for (const engine of webEngines) {
        try {
            const result = await engineWebSearch(`test-${uuidv4()}`, engine, 'test query', 1);
            if (result && !result.startsWith('Error:')) {
                console.log(`✅ ${engine}: Working`);
            } else {
                console.log(`❌ ${engine}: ${result}`);
            }
        } catch (e) {
            console.log(`❌ ${engine}: ${e.message}`);
        }
    }
}

quickTest().catch(console.error);