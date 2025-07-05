/**
 * Test vision-based selection with OpenAI API key
 */

import { config } from 'dotenv';
import { createNumberedGrid, selectBestFromGrid } from './src/design-search.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';

// Load environment variables
config();

async function testVisionSelection() {
    console.log('=== TESTING VISION-BASED SELECTION ===\n');
    
    // Check if OpenAI API key is available
    console.log(`OpenAI API Key available: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}\n`);
    
    if (!process.env.OPENAI_API_KEY) {
        console.log('Cannot test vision selection without OpenAI API key');
        return;
    }
    
    // Use the grid we created earlier
    const gridPath = '/Users/zemaj/www/just-every/design/.output/debug-search/grids/smart_round1_group1_2025-07-04T07-03-43-954Z_0ff4a571.png';
    
    if (!fs.existsSync(gridPath)) {
        console.log('Grid image not found. Please run debug-design-search.ts first.');
        return;
    }
    
    // Load the grid and convert to data URL
    console.log('Loading grid image...');
    const gridImage = await loadImage(gridPath);
    const canvas = createCanvas(gridImage.width, gridImage.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(gridImage, 0, 0);
    const gridDataUrl = canvas.toDataURL('image/png');
    
    console.log('Grid loaded successfully');
    console.log(`Grid dimensions: ${gridImage.width}x${gridImage.height}`);
    
    // Test selection
    console.log('\nTesting vision-based selection...');
    
    const criteria = `Select the 3 best logo designs for TechFlow (an AI workflow automation startup) based on:
- Modern, minimalist aesthetic
- AI/tech theme without being cliché
- Strong brand potential
- Scalability and versatility`;
    
    try {
        const selectedIndices = await selectBestFromGrid(
            gridDataUrl,
            criteria,
            9,  // count: total images in grid
            3,  // limit: select 3
            true // isDesignSearch
        );
        
        console.log('\n✅ Vision selection successful!');
        console.log(`Selected images: ${selectedIndices.join(', ')}`);
        
        // Map indices to design names from the grid
        const designs = [
            'Octrops (octopus logo)',
            'Fulkum.ai (green AI logo)', 
            'chatoon (gradient tech logo)',
            'AutoAI (triangular logo)',
            'AutoAI (teal branding)',
            'Fastter (lightning bolt)',
            'Gear/automation logo',
            'Coffee cup',
            'Smart Home Solutions'
        ];
        
        console.log('\nSelected designs:');
        selectedIndices.forEach(idx => {
            if (idx >= 1 && idx <= designs.length) {
                console.log(`  ${idx}. ${designs[idx - 1]}`);
            }
        });
        
    } catch (error) {
        console.error('❌ Vision selection failed:', error.message || error);
    }
}

testVisionSelection().catch(console.error);