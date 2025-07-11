/**
 * Simple design generation without MECH
 */

import { generate_image_raw } from './design-image.js';
import { smart_design_raw, createNumberedGrid, selectBestFromGrid } from './design-search.js';
import {
    DESIGN_ASSET_TYPES,
    DESIGN_ASSET_REFERENCE,
    DESIGN_ASSET_GUIDE,
    type DesignSearchEngine,
} from './constants.js';

export async function simpleDesignImage(
    type: DESIGN_ASSET_TYPES,
    prompt: string,
    withInspiration: boolean = true,
    brandAssets: string[] = []
): Promise<string> {
    const reference = DESIGN_ASSET_REFERENCE[type];
    const guide = DESIGN_ASSET_GUIDE[type];
    
    console.log(`\n🎨 Generating ${type} design...`);
    console.log(`📝 Prompt: ${prompt}`);
    console.log(`🔍 With inspiration: ${withInspiration}`);
    
    try {
        let inspirationImages: string[] = [];
        
        // Phase 1: Inspiration (if enabled)
        if (withInspiration) {
            console.log('\n🔍 Phase 1: Searching for inspiration...');
            const searches = [
                { engine: 'dribbble' as DesignSearchEngine, query: prompt + ' logo design', limit: 6 },
                { engine: 'behance' as DesignSearchEngine, query: prompt + ' brand identity', limit: 6 },
            ];
            
            const searchResults = await smart_design_raw(
                prompt,  // context
                searches,
                3,
                type,
                undefined,
                'simple_search'
            );
            
            if (searchResults && searchResults.length > 0) {
                inspirationImages = searchResults.map(r => r.screenshotURL || r.url);
                console.log(`✅ Found ${inspirationImages.length} inspiration images`);
            }
        }
        
        // Phase 2: Draft Generation
        console.log('\n🎨 Phase 2: Generating draft variations...');
        const drafts: string[] = [];
        
        // Generate 3 batches of 3
        for (let batch = 0; batch < 3; batch++) {
            const batchPrompt = `Professional ${type.replace('_', ' ')} design: ${prompt}. This is a ${reference.spec.aspect} ${type.replace('_', ' ')} with ${reference.spec.background} background. ${reference.description}. Variation ${batch + 1}. NOT a character illustration.`;
            
            const batchResults = await generate_image_raw(
                batchPrompt,
                reference.spec.aspect as any,
                reference.spec.background as any,
                inspirationImages.slice(0, 2), // Use first 2 inspiration images
                undefined,
                3,
                'low',
                'draft'
            );
            
            if (Array.isArray(batchResults)) {
                drafts.push(...batchResults);
            } else {
                drafts.push(batchResults);
            }
            
            console.log(`✅ Generated batch ${batch + 1} (${drafts.length} total drafts)`);
        }
        
        // Phase 3: Draft Selection
        console.log('\n🔍 Phase 3: Selecting best drafts...');
        const draftGrid = await createNumberedGrid(
            drafts.map(url => ({ url })),
            'draft_selection',
            reference.spec.aspect as any
        );
        
        const selectedDraftIndices = await selectBestFromGrid(
            draftGrid,
            `Select the 3 best ${type} drafts for "${prompt}"`,
            drafts.length,
            3,
            false,
            type,
            guide?.criteria.join(' ') || ''
        );
        
        const selectedDrafts = selectedDraftIndices.map(i => drafts[i - 1]);
        console.log(`✅ Selected ${selectedDrafts.length} best drafts`);
        
        // Phase 4: Medium Quality
        console.log('\n🎨 Phase 4: Generating medium quality versions...');
        const mediumImages: string[] = [];
        
        for (const [idx, draftPath] of selectedDrafts.entries()) {
            const mediumPrompt = `Refined professional ${type.replace('_', ' ')} design: ${prompt}. High quality, polished details, ${reference.spec.background} background. NOT a character illustration.`;
            
            const mediumResult = await generate_image_raw(
                mediumPrompt,
                reference.spec.aspect as any,
                reference.spec.background as any,
                [draftPath],
                undefined,
                3,
                'medium',
                'medium'
            );
            
            if (Array.isArray(mediumResult)) {
                mediumImages.push(...mediumResult);
            } else {
                mediumImages.push(mediumResult);
            }
            
            console.log(`✅ Generated medium quality for draft ${idx + 1}`);
        }
        
        // Phase 5: Medium Selection
        console.log('\n🔍 Phase 5: Selecting best medium image...');
        const mediumGrid = await createNumberedGrid(
            mediumImages.map(url => ({ url })),
            'medium_selection',
            reference.spec.aspect as any
        );
        
        const selectedMediumIndices = await selectBestFromGrid(
            mediumGrid,
            `Select the single best ${type} from these medium quality versions`,
            mediumImages.length,
            1,
            false,
            type,
            guide?.criteria.join(' ') || ''
        );
        
        const bestMedium = mediumImages[selectedMediumIndices[0] - 1];
        console.log(`✅ Selected best medium image`);
        
        // Phase 6: High Quality
        console.log('\n🎨 Phase 6: Generating final high quality version...');
        const finalResult = await generate_image_raw(
            `Professional ${type.replace('_', ' ')} design: ${prompt}. Highest quality execution with ${reference.spec.background} background. ${guide?.ideal.slice(0, 3).join('. ') || ''}. NOT a character illustration.`,
            reference.spec.aspect as any,
            reference.spec.background as any,
            [bestMedium],
            undefined,
            1,
            'high',
            'final'
        );
        
        const finalPath = Array.isArray(finalResult) ? finalResult[0] : finalResult;
        console.log(`\n✅ Design generation complete!`);
        console.log(`📁 Final image: ${finalPath}`);
        
        return finalPath;
        
    } catch (error) {
        console.error('❌ Design generation failed:', error);
        throw error;
    }
}