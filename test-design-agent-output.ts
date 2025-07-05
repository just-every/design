/**
 * Test the design agent search and selection process with output files
 */

import { config } from 'dotenv';
import { smart_design_raw } from './src/design-search.js';
import { DESIGN_ASSET_TYPES } from './src/constants.js';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

async function testDesignAgentOutput() {
    console.log('=== DESIGN AGENT OUTPUT TEST ===\n');
    
    // Set up output directory
    const testId = `test-output-${new Date().toISOString().split('T')[0]}-${Date.now().toString().slice(-6)}`;
    const outputDir = path.join(process.cwd(), '.output', testId);
    process.env.DESIGN_OUTPUT_DIR = outputDir;
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`Output directory: ${outputDir}\n`);
    
    // Define search configurations - mix of Dribbble and Behance
    const searchConfigs = [
        { engine: 'dribbble' as const, query: 'Modern AI tech logo minimal', limit: 4 },
        { engine: 'behance' as const, query: 'Workflow automation logo design', limit: 4 },
        { engine: 'dribbble' as const, query: 'Geometric tech branding', limit: 4 },
        { engine: 'behance' as const, query: 'AI startup logo minimalist', limit: 4 },
    ];
    
    const context = `We are designing a logo for TechFlow, an AI-powered workflow automation platform. 
The brand should feel modern, trustworthy, and innovative without being overly technical. 
Key attributes: professional, scalable, memorable, clean, forward-thinking.`;
    
    const judgeCriteria = `Select designs that best capture TechFlow's essence:
- Modern and minimalist aesthetic
- Conveys AI/automation without clichés
- Strong brand potential and memorability
- Works well at different sizes
- Professional yet approachable`;
    
    console.log('Running design search with the following configurations:');
    searchConfigs.forEach((config, i) => {
        console.log(`  ${i + 1}. ${config.engine}: "${config.query}" (limit: ${config.limit})`);
    });
    console.log('');
    
    try {
        // Run the smart design search
        console.log('Starting search process...\n');
        const results = await smart_design_raw(
            context,
            searchConfigs,
            5, // Get top 5 designs
            'primary_logo',
            judgeCriteria,
            'test'
        );
        
        console.log(`\n✅ Search completed successfully!`);
        console.log(`Found ${results.length} top designs\n`);
        
        // Display results
        console.log('=== SELECTED DESIGNS ===\n');
        results.forEach((design, index) => {
            console.log(`${index + 1}. ${design.title || 'Untitled Design'}`);
            console.log(`   URL: ${design.url}`);
            console.log(`   Thumbnail: ${design.thumbnailURL ? 'Yes' : 'No'}`);
            console.log(`   Screenshot: ${design.screenshotURL ? 'Yes' : 'No'}`);
            if (design.score) console.log(`   Score: ${design.score}`);
            if (design.reason) console.log(`   Reason: ${design.reason}`);
            console.log('');
        });
        
        // Save results to JSON
        const resultsPath = path.join(outputDir, 'selected_designs.json');
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
        console.log(`Results saved to: ${resultsPath}`);
        
        // Check what files were created
        console.log('\n=== GENERATED FILES ===\n');
        
        function listFiles(dir: string, prefix = '') {
            const items = fs.readdirSync(dir);
            items.forEach(item => {
                const fullPath = path.join(dir, item);
                const stats = fs.statSync(fullPath);
                if (stats.isDirectory()) {
                    console.log(`${prefix}📁 ${item}/`);
                    listFiles(fullPath, prefix + '  ');
                } else {
                    const size = (stats.size / 1024).toFixed(1) + ' KB';
                    console.log(`${prefix}📄 ${item} (${size})`);
                }
            });
        }
        
        listFiles(outputDir);
        
        console.log(`\n✨ Test complete! Check the output directory:`);
        console.log(`   ${outputDir}`);
        
    } catch (error) {
        console.error('\n❌ Error during test:', error);
    }
}

// Run the test
testDesignAgentOutput().catch(console.error);