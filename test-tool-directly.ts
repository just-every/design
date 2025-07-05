/**
 * Test the design search tool directly
 */

import { config } from 'dotenv';
import { DesignAgentToolsImpl, type DesignAgentState } from './src/agents/design-agent-tools-impl.js';
import path from 'path';
import fs from 'fs';

// Load environment variables
config();

async function testToolDirectly() {
    console.log('=== TESTING DESIGN SEARCH TOOL DIRECTLY ===\n');
    
    // Create state
    const state: DesignAgentState = {
        designId: 'test-direct',
        designType: 'primary_logo',
        outputDir: path.join(process.cwd(), '.output', 'test-direct'),
        userPrompt: 'Test coffee shop logo'
    };
    
    // Create output directory
    if (!fs.existsSync(state.outputDir)) {
        fs.mkdirSync(state.outputDir, { recursive: true });
    }
    
    // Set environment variable
    process.env.DESIGN_OUTPUT_DIR = state.outputDir;
    
    // Create tools implementation
    const toolsImpl = new DesignAgentToolsImpl(state);
    
    // Test search configs
    const searchConfigs = [
        { engine: 'dribbble' as const, query: 'coffee shop logo minimal', limit: 2 },
        { engine: 'behance' as const, query: 'cafe branding design', limit: 2 }
    ];
    
    console.log('Testing with search configs:');
    console.log(JSON.stringify(searchConfigs, null, 2));
    console.log('');
    
    try {
        const results = await toolsImpl.designSearch(
            'Looking for coffee shop logo inspiration',
            searchConfigs,
            'Select designs that feature coffee-related imagery and modern aesthetics',
            3
        );
        
        console.log(`\n✅ Success! Found ${results.length} designs:`);
        results.forEach((result, i) => {
            console.log(`${i + 1}. ${result.title?.substring(0, 50)}...`);
            console.log(`   URL: ${result.url}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

testToolDirectly().catch(console.error);