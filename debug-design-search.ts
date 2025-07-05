/**
 * Debug script to replicate the design_search tool call and trace each stage
 */

import { smart_design_raw } from './src/design-search.js';
import { DESIGN_ASSET_TYPES } from './src/constants.js';
import fs from 'fs';
import path from 'path';

// Set up the output directory
const debugDir = path.join(process.cwd(), '.output', 'debug-search');
if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
}

// Set DESIGN_OUTPUT_DIR for the search
process.env.DESIGN_OUTPUT_DIR = debugDir;

console.log('=== DEBUG DESIGN SEARCH ===');
console.log(`Output directory: ${debugDir}`);
console.log('');

// Parse the search configs from the tool call
const searchConfigsRaw = [
    '{"engine": "dribbble", "query": "Futuristic AI logo designs", "limit": 5}',
    '{"engine": "behance", "query": "Minimalist workflow automation logos", "limit": 5}',
    '{"engine": "dribbble", "query": "Tech company wordmarks abstract elements", "limit": 5}',
    '{"engine": "behance", "query": "Geometric logos negative space", "limit": 5}',
    '{"engine": "dribbble", "query": "Dynamic tech brand identities", "limit": 5}'
];

const searchConfigs = searchConfigsRaw.map(config => {
    console.log(`Parsing config: ${config}`);
    return JSON.parse(config);
});

console.log('\n=== SEARCH CONFIGS ===');
console.log(JSON.stringify(searchConfigs, null, 2));

const context = "We are looking for modern logo inspiration for TechFlow, an AI-powered workflow automation startup. The logo needs to be simple, scalable, and versatile, incorporating subtle AI or workflow automation motifs. We are aiming for a design that is bold, minimalistic, and has a futuristic twist, potentially using geometric abstractions or fluid shapes. Innovative typography is also a key consideration. The color palette should be modern and tech-inspired.";

const judge_criteria = "Evaluate designs based on how well they capture TechFlow's essence—focusing on memorability (is it striking and unique?), scalability (does it work across sizes and media?), modernity (does it feel current and timeless?), and brand alignment (does it convey AI innovation without clichés?). A winning design should excel in originality, legibility, and technical execution, standing out by effectively differentiating TechFlow from competitors while maintaining versatility.";

const count = 5;
const designType: DESIGN_ASSET_TYPES = 'primary_logo';

console.log('\n=== STARTING SEARCH ===');
console.log(`Context: ${context.substring(0, 100)}...`);
console.log(`Judge criteria: ${judge_criteria.substring(0, 100)}...`);
console.log(`Count: ${count}`);
console.log(`Design type: ${designType}`);

try {
    // Call the smart_design_raw function
    const results = await smart_design_raw(
        context,
        searchConfigs,
        count,
        designType,
        judge_criteria
    );

    console.log('\n=== SEARCH RESULTS ===');
    console.log(`Total results: ${results.length}`);
    
    // Output detailed info about each result
    results.forEach((result, index) => {
        console.log(`\n--- Result ${index + 1} ---`);
        console.log(`Title: ${result.title}`);
        console.log(`URL: ${result.url}`);
        console.log(`Description: ${result.description}`);
        console.log(`Engine: ${result.engine}`);
        console.log(`Screenshot: ${result.screenshot || 'No screenshot'}`);
        console.log(`Score: ${result.score}`);
        console.log(`Reason: ${result.reason}`);
    });

    // Save results to JSON for analysis
    const resultsPath = path.join(debugDir, 'search_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\nResults saved to: ${resultsPath}`);

    // Check screenshot directory
    const screenshotsDir = path.join(debugDir, 'screenshots');
    if (fs.existsSync(screenshotsDir)) {
        const screenshots = fs.readdirSync(screenshotsDir);
        console.log(`\n=== SCREENSHOTS ===`);
        console.log(`Found ${screenshots.length} screenshots:`);
        screenshots.forEach(file => {
            const stats = fs.statSync(path.join(screenshotsDir, file));
            console.log(`  - ${file} (${stats.size} bytes)`);
        });
    } else {
        console.log('\nNo screenshots directory found');
    }

} catch (error) {
    console.error('\n=== ERROR ===');
    console.error(error);
}