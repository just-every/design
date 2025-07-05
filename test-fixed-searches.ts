/**
 * Test the fixed specific searches
 */

import { config } from 'dotenv';
import { smart_design_raw } from './src/design-search.js';
import fs from 'fs';
import path from 'path';

config();

async function testFixedSearches() {
    console.log('=== TESTING FIXED SPECIFIC SEARCHES ===\n');
    
    const scenarios = [
        {
            name: 'Coffee Shop',
            searches: [
                { engine: 'dribbble' as const, query: 'coffee shop logo beans cup', limit: 3 },
                { engine: 'behance' as const, query: 'cafe branding coffee bean logo', limit: 3 }
            ],
            context: 'Coffee shop called Bean & Brew'
        },
        {
            name: 'Fitness App',
            searches: [
                { engine: 'dribbble' as const, query: 'fitness app logo dumbbell workout', limit: 3 },
                { engine: 'behance' as const, query: 'gym fitness tracker logo design', limit: 3 }
            ],
            context: 'Fitness tracking app called FitPulse'
        }
    ];
    
    const mainOutputDir = path.join(process.cwd(), '.output', 'fixed-searches');
    if (!fs.existsSync(mainOutputDir)) {
        fs.mkdirSync(mainOutputDir, { recursive: true });
    }
    
    const allResults = [];
    
    for (const scenario of scenarios) {
        console.log(`\nTesting: ${scenario.name}`);
        
        const scenarioDir = path.join(mainOutputDir, scenario.name.toLowerCase().replace(/\s+/g, '-'));
        process.env.DESIGN_OUTPUT_DIR = scenarioDir;
        
        if (!fs.existsSync(scenarioDir)) {
            fs.mkdirSync(scenarioDir, { recursive: true });
        }
        
        try {
            const results = await smart_design_raw(
                scenario.context,
                scenario.searches,
                3, // finalLimit
                'primary_logo',
                `Select designs relevant to ${scenario.name}`,
                scenario.name.toLowerCase().replace(/\s+/g, '-')
            );
            
            console.log(`✅ Found ${results.length} designs for ${scenario.name}`);
            
            results.forEach((design, i) => {
                console.log(`  ${i + 1}. ${(design.title || '').substring(0, 50)}...`);
            });
            
            // Save results
            const scenarioResults = {
                scenario: scenario.name,
                context: scenario.context,
                results: results
            };
            
            const resultsPath = path.join(scenarioDir, 'results.json');
            fs.writeFileSync(resultsPath, JSON.stringify(scenarioResults, null, 2), 'utf-8');
            
            allResults.push(scenarioResults);
            
        } catch (error) {
            console.error(`❌ Error testing ${scenario.name}:`, error.message);
        }
    }
    
    console.log(`\n✅ Test complete! Results saved to: ${mainOutputDir}`);
    console.log(`Total scenarios with results: ${allResults.filter(r => r.results.length > 0).length}/${allResults.length}`);
}

testFixedSearches().catch(console.error);