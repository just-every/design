/**
 * Test all available search engines for the design agent
 */

import { config } from 'dotenv';
import { design_search, web_search_design } from './src/design-search.js';
import { web_search as engineWebSearch } from '@just-every/search';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
config();

// Define all available search engines
const DESIGN_SPECIFIC_ENGINES = ['dribbble', 'behance', 'pinterest', 'envato', 'awwwards'];
const WEB_SEARCH_ENGINES = ['google', 'anthropic', 'openai', 'sonar', 'xai', 'brave'];

async function testSearchEngine(engine: string, query: string, isWebSearch: boolean = false) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${engine.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);
    
    const startTime = Date.now();
    
    try {
        let results;
        
        if (isWebSearch) {
            // Test web search engines
            const agentId = `test-${uuidv4()}`;
            const rawResult = await engineWebSearch(agentId, engine, query, 5);
            
            console.log(`Raw result type: ${typeof rawResult}`);
            console.log(`Raw result length: ${rawResult.length}`);
            
            // Try to extract URLs from the result
            const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
            const urls = rawResult.match(urlRegex) || [];
            console.log(`Found ${urls.length} URLs in response`);
            
            if (urls.length > 0) {
                console.log('Sample URLs:');
                urls.slice(0, 3).forEach(url => console.log(`  - ${url}`));
            }
            
            results = { raw: rawResult.substring(0, 500) + '...', urlCount: urls.length };
        } else {
            // Test design-specific search engines
            const resultJson = await design_search(engine as any, query, 5);
            results = JSON.parse(resultJson);
        }
        
        const duration = Date.now() - startTime;
        
        if (!isWebSearch && Array.isArray(results)) {
            console.log(`✅ SUCCESS - Found ${results.length} results in ${duration}ms`);
            
            // Show first 2 results
            results.slice(0, 2).forEach((result, index) => {
                console.log(`\nResult ${index + 1}:`);
                console.log(`  Title: ${result.title || 'No title'}`);
                console.log(`  URL: ${result.url}`);
                console.log(`  Has thumbnail: ${!!result.thumbnailURL}`);
                console.log(`  Has screenshot: ${!!result.screenshotURL}`);
            });
        } else if (isWebSearch) {
            console.log(`✅ SUCCESS - Got response in ${duration}ms`);
            console.log(`  URL count: ${results.urlCount}`);
            console.log(`  Preview: ${results.raw.substring(0, 200)}...`);
        }
        
        return { engine, success: true, results, duration };
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ FAILED after ${duration}ms:`, error.message || error);
        return { engine, success: false, error: error.message || String(error), duration };
    }
}

async function testAllEngines() {
    console.log('=== TESTING ALL SEARCH ENGINES ===\n');
    
    // Check which API keys are available
    console.log('Available API Keys:');
    console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
    console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌'}`);
    console.log(`  GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? '✅' : '❌'}`);
    console.log(`  OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✅' : '❌'}`);
    console.log(`  XAI_API_KEY: ${process.env.XAI_API_KEY ? '✅' : '❌'}`);
    console.log(`  BRAVE_API_KEY: ${process.env.BRAVE_API_KEY ? '✅' : '❌'}`);
    console.log(`  DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? '✅' : '❌'}`);
    
    // Create output directory
    const outputDir = path.join(process.cwd(), '.output', 'engine-test-results');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const allResults: any[] = [];
    
    // Test design-specific engines
    console.log('\n\n🎨 TESTING DESIGN-SPECIFIC ENGINES\n');
    const designQuery = 'modern minimalist logo design';
    
    for (const engine of DESIGN_SPECIFIC_ENGINES) {
        const result = await testSearchEngine(engine, designQuery);
        allResults.push(result);
    }
    
    // Test web search engines
    console.log('\n\n🌐 TESTING WEB SEARCH ENGINES\n');
    const webQuery = 'AI logo design inspiration examples';
    
    for (const engine of WEB_SEARCH_ENGINES) {
        const result = await testSearchEngine(engine, webQuery, true);
        allResults.push(result);
    }
    
    // Test web_search_design function
    console.log(`\n${'='.repeat(60)}`);
    console.log('Testing WEB_SEARCH_DESIGN Function');
    console.log(`${'='.repeat(60)}`);
    
    try {
        const designResults = await web_search_design('futuristic tech logo', 5);
        console.log(`✅ SUCCESS - Found ${designResults.length} results`);
        designResults.slice(0, 2).forEach((result, index) => {
            console.log(`\nResult ${index + 1}:`);
            console.log(`  Title: ${result.title}`);
            console.log(`  URL: ${result.url}`);
        });
        allResults.push({ engine: 'web_search_design', success: true, resultCount: designResults.length });
    } catch (error) {
        console.error('❌ FAILED:', error.message || error);
        allResults.push({ engine: 'web_search_design', success: false, error: error.message || String(error) });
    }
    
    // Summary
    console.log('\n\n📊 SUMMARY\n');
    const successful = allResults.filter(r => r.success);
    const failed = allResults.filter(r => !r.success);
    
    console.log(`Total engines tested: ${allResults.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    
    if (successful.length > 0) {
        console.log('\n✅ Working engines:');
        successful.forEach(r => {
            console.log(`  - ${r.engine} (${r.duration}ms)`);
        });
    }
    
    if (failed.length > 0) {
        console.log('\n❌ Failed engines:');
        failed.forEach(r => {
            console.log(`  - ${r.engine}: ${r.error}`);
        });
    }
    
    // Save results
    const resultsPath = path.join(outputDir, `test_results_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2), 'utf-8');
    console.log(`\nResults saved to: ${resultsPath}`);
}

// Run the tests
testAllEngines().catch(console.error);