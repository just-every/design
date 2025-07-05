/**
 * Test design searches with specific brand-related terms
 */

import { config } from 'dotenv';
import { design_search } from './src/design-search.js';
import { smart_design_raw } from './src/design-search.js';
import { DESIGN_ASSET_TYPES } from './src/constants.js';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

async function testSpecificSearches() {
    console.log('=== TESTING SPECIFIC BRAND SEARCHES ===\n');
    
    // Test different specific search scenarios
    const testScenarios = [
        {
            name: 'Coffee Shop',
            searches: [
                { engine: 'dribbble' as const, query: 'coffee shop logo beans cup', limit: 3 },
                { engine: 'behance' as const, query: 'cafe branding coffee bean logo', limit: 3 },
                { engine: 'dribbble' as const, query: 'espresso bar logo design', limit: 3 }
            ],
            context: 'Logo for a premium artisan coffee shop called "Bean & Brew" that specializes in single-origin coffee'
        },
        {
            name: 'Fitness App',
            searches: [
                { engine: 'dribbble' as const, query: 'fitness app logo dumbbell workout', limit: 3 },
                { engine: 'behance' as const, query: 'gym fitness tracker logo design', limit: 3 },
                { engine: 'dribbble' as const, query: 'health wellness app icon logo', limit: 3 }
            ],
            context: 'Logo for a fitness tracking app called "FitPulse" that helps users track workouts and nutrition'
        },
        {
            name: 'Pet Care Service',
            searches: [
                { engine: 'dribbble' as const, query: 'pet care logo dog cat paw', limit: 3 },
                { engine: 'behance' as const, query: 'veterinary clinic animal logo', limit: 3 },
                { engine: 'dribbble' as const, query: 'pet grooming service logo design', limit: 3 }
            ],
            context: 'Logo for a pet care service called "Happy Paws" offering grooming, boarding, and veterinary services'
        },
        {
            name: 'Eco/Green Tech',
            searches: [
                { engine: 'dribbble' as const, query: 'eco friendly logo leaf green tech', limit: 3 },
                { engine: 'behance' as const, query: 'sustainable energy solar logo', limit: 3 },
                { engine: 'dribbble' as const, query: 'environmental recycling logo design', limit: 3 }
            ],
            context: 'Logo for an eco-tech startup called "GreenFlow" that develops sustainable energy solutions'
        },
        {
            name: 'Food Delivery',
            searches: [
                { engine: 'dribbble' as const, query: 'food delivery logo fork plate fast', limit: 3 },
                { engine: 'behance' as const, query: 'restaurant delivery service logo', limit: 3 },
                { engine: 'dribbble' as const, query: 'meal delivery app logo design', limit: 3 }
            ],
            context: 'Logo for a food delivery service called "QuickBite" focusing on healthy, fast meal delivery'
        }
    ];
    
    // Create main output directory
    const mainOutputDir = path.join(process.cwd(), '.output', 'specific-searches');
    if (!fs.existsSync(mainOutputDir)) {
        fs.mkdirSync(mainOutputDir, { recursive: true });
    }
    
    const allScenarioResults = [];
    
    // Test each scenario
    for (const scenario of testScenarios) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing: ${scenario.name}`);
        console.log(`Context: ${scenario.context}`);
        console.log(`${'='.repeat(60)}\n`);
        
        // Create scenario directory
        const scenarioDir = path.join(mainOutputDir, scenario.name.toLowerCase().replace(/\s+/g, '-'));
        process.env.DESIGN_OUTPUT_DIR = scenarioDir;
        
        if (!fs.existsSync(scenarioDir)) {
            fs.mkdirSync(scenarioDir, { recursive: true });
        }
        
        try {
            // Run smart design search for this scenario
            const results = await smart_design_raw(
                scenario.context,
                scenario.searches,
                3, // Get top 3 for each scenario
                'primary_logo',
                `Select logos that are specifically relevant to ${scenario.name}. 
                Look for designs that incorporate relevant imagery, symbols, or concepts.
                Avoid generic tech/corporate logos unless they clearly relate to the industry.`,
                scenario.name.toLowerCase().replace(/\s+/g, '-')
            );
            
            console.log(`Found ${results.length} relevant designs for ${scenario.name}`);
            
            // Save scenario results
            const scenarioResults = {
                scenario: scenario.name,
                context: scenario.context,
                searches: scenario.searches,
                results: results
            };
            
            const resultsPath = path.join(scenarioDir, 'results.json');
            fs.writeFileSync(resultsPath, JSON.stringify(scenarioResults, null, 2), 'utf-8');
            
            allScenarioResults.push(scenarioResults);
            
            // Display results
            console.log('\nTop designs:');
            results.forEach((design, i) => {
                console.log(`  ${i + 1}. ${(design.title || '').substring(0, 60)}...`);
                console.log(`     ${design.url}`);
            });
            
        } catch (error) {
            console.error(`Error testing ${scenario.name}:`, error.message);
        }
    }
    
    // Create summary HTML
    const summaryHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Specific Brand Search Results</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: #333; text-align: center; }
        .scenario { margin-bottom: 40px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .scenario h2 { color: #2c3e50; margin-top: 0; }
        .context { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 20px; font-style: italic; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
        .card { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 4px; padding: 10px; }
        .card img { width: 100%; height: 150px; object-fit: cover; border-radius: 4px; background: #e0e0e0; }
        .card h4 { margin: 8px 0 4px; font-size: 14px; height: 40px; overflow: hidden; }
        .card a { font-size: 11px; color: #0066cc; text-decoration: none; }
        .search-terms { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0; }
        .search-terms h3 { font-size: 14px; margin: 0 0 5px; }
        .search-terms li { font-size: 12px; color: #666; }
        .no-results { color: #999; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Specific Brand Search Results</h1>
        <p style="text-align: center; color: #666;">Testing search relevance for different industries</p>
        
        ${allScenarioResults.map(scenario => `
            <div class="scenario">
                <h2>${scenario.scenario}</h2>
                <div class="context">${scenario.context}</div>
                
                ${scenario.results.length > 0 ? `
                    <div class="grid">
                        ${scenario.results.map(result => `
                            <div class="card">
                                <img src="${result.thumbnailURL || result.screenshotURL || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2UwZTBlMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iIzk5OSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'}" alt="${result.title}">
                                <h4>${(result.title || 'Untitled').substring(0, 80)}</h4>
                                <a href="${result.url}" target="_blank">View Design →</a>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="no-results">No results found for this scenario</p>'}
                
                <div class="search-terms">
                    <h3>Search queries used:</h3>
                    <ul>
                        ${scenario.searches.map(s => `<li>${s.engine}: "${s.query}"</li>`).join('')}
                    </ul>
                </div>
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;
    
    const htmlPath = path.join(mainOutputDir, 'summary.html');
    fs.writeFileSync(htmlPath, summaryHtml, 'utf-8');
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ All tests complete!');
    console.log(`Results saved to: ${mainOutputDir}`);
    console.log(`\nView summary: ${htmlPath}`);
    console.log(`${'='.repeat(60)}`);
}

testSpecificSearches().catch(console.error);