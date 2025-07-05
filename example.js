/**
 * Simple example demonstrating the design image functionality
 */

import { design_image, getDesignImageTools } from './dist/index.js';

async function runExample() {
    try {
        console.log('Starting design image generation example...');
        
        // Test the tool function creation
        const tools = getDesignImageTools();
        console.log(`Created ${tools.length} design tools`);
        console.log('Tool names:', tools.map(t => t.name));
        
        // Test basic design generation (with mock backend)
        console.log('\nGenerating a logo design...');
        const logoPath = await design_image(
            'primary_logo',
            'A modern tech startup logo with clean typography',
            false, // Skip inspiration to simplify
            []
        );
        
        console.log(`Logo generated successfully: ${logoPath}`);
        console.log('Example completed successfully!');
        
    } catch (error) {
        console.error('Example failed:', error);
        process.exit(1);
    }
}

runExample();