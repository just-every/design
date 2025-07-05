/**
 * Simple test of design search without multi-round selection
 */

import { config } from 'dotenv';
import { design_search } from './src/design-search.js';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

async function simpleSearchTest() {
    console.log('=== SIMPLE DESIGN SEARCH TEST ===\n');
    
    // Set up output directory
    const outputDir = path.join(process.cwd(), '.output', 'simple-search-test');
    process.env.DESIGN_OUTPUT_DIR = outputDir;
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`Output directory: ${outputDir}\n`);
    
    // Test each engine with a simple search
    const engines = [
        { name: 'dribbble', query: 'modern tech logo' },
        { name: 'behance', query: 'AI startup branding' }
    ];
    
    const allResults = [];
    
    for (const engine of engines) {
        console.log(`\nSearching ${engine.name} for: "${engine.query}"`);
        
        try {
            const resultJson = await design_search(engine.name as any, engine.query, 3);
            const results = JSON.parse(resultJson);
            
            console.log(`Found ${results.length} results:`);
            results.forEach((result, i) => {
                console.log(`  ${i + 1}. ${result.title?.substring(0, 60)}...`);
                console.log(`     URL: ${result.url}`);
                console.log(`     Has image: ${!!(result.thumbnailURL || result.screenshotURL)}`);
                allResults.push({ ...result, engine: engine.name });
            });
            
        } catch (error) {
            console.error(`Error searching ${engine.name}:`, error.message);
        }
    }
    
    // Save all results
    const resultsPath = path.join(outputDir, 'all_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2), 'utf-8');
    
    // Create a simple HTML preview
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Design Search Results</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #333; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .card img { width: 100%; height: 200px; object-fit: cover; border-radius: 4px; }
        .card h3 { margin: 10px 0 5px; font-size: 16px; }
        .card p { margin: 0; font-size: 12px; color: #666; }
        .card a { color: #0066cc; text-decoration: none; font-size: 12px; }
        .engine { background: #e0e0e0; padding: 2px 8px; border-radius: 3px; font-size: 11px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Design Search Results</h1>
        <p>Found ${allResults.length} designs from ${engines.length} search engines</p>
        <div class="grid">
            ${allResults.map((result, i) => `
                <div class="card">
                    <img src="${result.thumbnailURL || result.screenshotURL || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRTBFMEUwIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD4KPC9zdmc+'}" alt="${result.title}">
                    <h3>${(result.title || 'Untitled').substring(0, 50)}${result.title?.length > 50 ? '...' : ''}</h3>
                    <p><span class="engine">${result.engine}</span></p>
                    <a href="${result.url}" target="_blank">View on ${result.engine}</a>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `;
    
    const htmlPath = path.join(outputDir, 'results.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');
    
    console.log(`\n✅ Test complete!`);
    console.log(`Results saved to: ${resultsPath}`);
    console.log(`HTML preview: ${htmlPath}`);
    console.log(`\nOpen the HTML file in a browser to see the results visually.`);
}

simpleSearchTest().catch(console.error);