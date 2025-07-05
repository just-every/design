/**
 * Direct test of searchDribbble function
 */

import { design_search } from './src/design-search.js';
import fs from 'fs';
import path from 'path';

async function testDribbbleDirectly() {
    console.log('=== DIRECT DRIBBBLE TEST ===');
    
    // Set output directory
    const outputDir = path.join(process.cwd(), '.output', 'dribbble-direct-test');
    process.env.DESIGN_OUTPUT_DIR = outputDir;
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`Output directory: ${outputDir}`);
    
    try {
        console.log('\nTesting Dribbble search...');
        const results = await design_search('dribbble', 'Futuristic AI logo designs', 5);
        
        console.log('\n=== RESULTS ===');
        console.log(`Type: ${typeof results}`);
        console.log(`Length: ${results.length}`);
        
        // Parse if it's a JSON string
        let parsedResults;
        if (typeof results === 'string') {
            try {
                parsedResults = JSON.parse(results);
                console.log(`Parsed ${parsedResults.length} results`);
            } catch (e) {
                console.log('Failed to parse as JSON:', e);
                console.log('Raw result:', results);
            }
        } else {
            parsedResults = results;
        }
        
        if (parsedResults && Array.isArray(parsedResults)) {
            parsedResults.forEach((result, index) => {
                console.log(`\n--- Result ${index + 1} ---`);
                console.log(`Title: ${result.title}`);
                console.log(`URL: ${result.url}`);
                console.log(`Thumbnail: ${result.thumbnailURL || 'None'}`);
                console.log(`Screenshot: ${result.screenshotURL || 'None'}`);
            });
            
            // Save results
            const resultsPath = path.join(outputDir, 'dribbble_results.json');
            fs.writeFileSync(resultsPath, JSON.stringify(parsedResults, null, 2), 'utf-8');
            console.log(`\nResults saved to: ${resultsPath}`);
        }
        
    } catch (error) {
        console.error('\nError:', error);
    }
}

testDribbbleDirectly().catch(console.error);