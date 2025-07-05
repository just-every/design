/**
 * Prompt generators for the Design Agent
 * These functions generate contextual prompts based on the current state
 */

import { 
    DESIGN_ASSET_TYPES,
    DESIGN_ASSET_REFERENCE,
    DESIGN_ASSET_GUIDE,
    type DesignAssetGuideItem,
    type DesignSearchResult,
} from '../constants.js';
import type { DesignAgentState } from './design-agent-tools-impl.js';
import { createNumberedGrid, type ImageSource } from '../design-search.js';
import { existsSync, readFileSync } from 'fs';
import { getImageRegistry } from '../utils/image-registry.js';

/**
 * Helper to create a grid image and return as data URL
 */
async function createStatusGrid(
    items: (string | DesignSearchResult)[],
    gridName: string,
    outputDir: string,
    maxItems: number = 9
): Promise<string | null> {
    try {
        // Convert items to ImageSource format
        const imageSources: ImageSource[] = items.slice(0, maxItems).map(item => {
            if (typeof item === 'string') {
                // It's a file path
                return { url: item };
            } else {
                // It's a DesignSearchResult
                return {
                    url: item.screenshotURL || item.thumbnailURL || item.url,
                    title: item.title
                };
            }
        });

        if (imageSources.length === 0) return null;

        // Create the grid (1027x1027)
        const gridDataUrl = await createNumberedGrid(
            imageSources,
            gridName,
            'square', // Force square for status grids
            gridName.includes('inspiration') ? 'inspiration' :
            gridName.includes('draft') ? 'draft' :
            gridName.includes('medium') ? 'medium' : 'final'
        );

        return gridDataUrl;
    } catch (error) {
        console.error(`Error creating status grid for ${gridName}:`, error);
        return null;
    }
}

/**
 * Generate the current status prompt with visual grids
 */
export async function generateStatusPrompt(state: DesignAgentState): Promise<string> {
    let prompt = `=== Design Status ===
Design Request:
${state.userPrompt}

Design ID: ${state.designId}
Design Type: ${state.designType ?? 'Not Set'}
Output Directory: ${state.outputDir}

=== Research Report ===
${state.researchReport ?? 'None Yet'}

`;

    // Design Inspiration section with grid
    prompt += '=== Design Inspiration ===\n';
    if (state.designInspiration && state.designInspiration.length > 0) {
        prompt += `Found ${state.designInspiration.length} inspiration images\n`;
        const inspirationGrid = await createStatusGrid(
            state.designInspiration,
            'status_inspiration',
            state.outputDir,
            9
        );
        if (inspirationGrid) {
            prompt += `\n${inspirationGrid}\n`;
            prompt += `Note: Each image has a unique ID (#5, #8, etc.) displayed in the top-left corner.\n`;
            
            // List the valid unique IDs for this category
            const registry = getImageRegistry();
            const inspirationImages = registry.getImagesByCategory('inspiration');
            if (inspirationImages.length > 0) {
                const validIds = inspirationImages.map(img => img.id).sort((a, b) => a - b);
                prompt += `Valid inspiration image IDs: ${validIds.join(', ')}\n`;
            }
        }
        prompt += `\nTo regenerate inspiration: Use delete_designs('inspiration') then design_search() again.\n`;
    } else {
        prompt += 'None Yet\n';
    }
    prompt += '\n';

    // Draft Designs section with grid
    prompt += '=== Draft Designs ===\n';
    if (state.draftDesigns && state.draftDesigns.length > 0) {
        prompt += `Generated ${state.draftDesigns.length} draft designs\n`;
        if (state.selectedDrafts) {
            prompt += `Selected drafts: ${state.selectedDrafts.join(', ')}\n`;
        }
        const draftGrid = await createStatusGrid(
            state.draftDesigns,
            'status_drafts',
            state.outputDir,
            12 // Show up to 12 drafts
        );
        if (draftGrid) {
            prompt += `\n${draftGrid}\n`;
            prompt += `Note: Each draft has a unique ID (#number) displayed in the top-left corner.\n`;
            
            // List the valid unique IDs for this category
            const registry = getImageRegistry();
            const draftImages = registry.getImagesByCategory('draft');
            if (draftImages.length > 0) {
                const validIds = draftImages.map(img => img.id).sort((a, b) => a - b);
                prompt += `Valid draft image IDs: ${validIds.join(', ')}\n`;
            }
        }
        prompt += `\nTo regenerate: Use delete_designs('drafts') or remake_design('draft', [unique_ids...]) with the unique IDs shown.\n`;
    } else {
        prompt += 'None Yet\n';
    }
    prompt += '\n';

    // Medium Quality Designs section with grid
    prompt += '=== Medium Quality Designs ===\n';
    if (state.mediumDesigns && state.mediumDesigns.length > 0) {
        prompt += `Generated ${state.mediumDesigns.length} medium quality designs\n`;
        if (state.selectedMedium !== undefined) {
            prompt += `Selected medium design: ${state.selectedMedium}\n`;
        }
        const mediumGrid = await createStatusGrid(
            state.mediumDesigns,
            'status_medium',
            state.outputDir,
            9
        );
        if (mediumGrid) {
            prompt += `\n${mediumGrid}\n`;
            prompt += `Note: Each design has a unique ID (#number) displayed in the top-left corner.\n`;
            
            // List the valid unique IDs for this category
            const registry = getImageRegistry();
            const mediumImages = registry.getImagesByCategory('medium');
            if (mediumImages.length > 0) {
                const validIds = mediumImages.map(img => img.id).sort((a, b) => a - b);
                prompt += `Valid medium image IDs: ${validIds.join(', ')}\n`;
            }
        }
        prompt += `\nTo regenerate: Use delete_designs('medium') or remake_design('medium', [unique_ids...]) with the unique IDs shown.\n`;
    } else {
        prompt += 'None Yet\n';
    }
    prompt += '\n';

    // Final Design section
    prompt += '=== Final Design ===\n';
    if (state.finalDesign) {
        prompt += state.finalDesign + '\n';
        
        // Mention SVG conversion if applicable
        if (state.finalDesignSvg) {
            prompt += `SVG Version: ${state.finalDesignSvg}\n`;
        } else if (state.designType && DESIGN_ASSET_REFERENCE[state.designType].spec.type === 'svg') {
            prompt += `Note: SVG conversion will be attempted for this ${state.designType} asset.\n`;
        }
        
        // Try to show the final design as an image
        try {
            if (existsSync(state.finalDesign)) {
                const imageBuffer = readFileSync(state.finalDesign);
                const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
                prompt += `\n${dataUrl}\n`;
            }
        } catch {
            // Ignore errors, just don't include the image
        }
        
        prompt += `\nTo regenerate: Use delete_designs('final') then generate_high_quality() again.\n`;
    } else {
        prompt += 'None Yet\n';
    }

    // Add image registry summary
    prompt += '\n=== Image Registry ===\n';
    const registry = getImageRegistry();
    const registrySummary = registry.getSummary();
    if (registrySummary.includes('INSPIRATION') || registrySummary.includes('DRAFT') || 
        registrySummary.includes('MEDIUM') || registrySummary.includes('FINAL')) {
        prompt += registrySummary;
    } else {
        prompt += 'No images registered yet\n';
    }

    return prompt;
}

/**
 * Generate prompt for design type selection
 */
export function generateTypePrompt(): string {
    const list = Object.entries(DESIGN_ASSET_REFERENCE)
        .map(([k, v]) => `- ${k}: ${v.description}`)
        .join('\n');

    return `**Design Type is missing**
Please initialize the design with \`set_design(design_type, design_id)\`

Parameters:
- design_type: The type of design asset to create
- design_id: A short, descriptive ID for this project (e.g. "techflow_logo", "saas_homepage")

Possible values for design_type:
${list}`;
}

/**
 * Generate prompt for research phase
 */
export function generateResearchPrompt(designType: DESIGN_ASSET_TYPES): string {
    const guide = DESIGN_ASSET_GUIDE[designType] as DesignAssetGuideItem;
    return `**Research Report is missing**

Please use \`write_research_report(guide, ideal, warnings, inspiration, criteria)\` next.

Here's some general research we've performed previously on ${designType}. You can also use \`web_search()\` to gather additional research to if you would like clarification on any area before writing your report. Please make sure your report is relevant to the original **Design Request**.

GUIDE:
- ${guide.guide.join('\n- ')}

IDEAL:
- ${guide.ideal.join('\n- ')}

WARNINGS:
- ${guide.warnings.join('\n- ')}

INSPIRATION:
- ${guide.inspiration.join('\n- ')}

CRITERIA:
- ${guide.criteria.join('\n- ')}`;
}

/**
 * Generate prompt for inspiration search
 */
export function generateInspirationPrompt(): string {
    return `**Design Inspiration is missing**

Please use design_search() to find high-quality reference images from design platforms.

Create specific, industry-relevant queries that include:
   - The type of design (logo, website, etc.)
   - Industry/niche keywords (coffee, fitness, tech, etc.)
   - Style descriptors (minimal, modern, vintage, etc.)
   - Specific elements (typography, icons, colors, etc.)

Example search configuration (DO NOT specify limits - the system will automatically get 9 from each engine):
[
  { "engine": "dribbble", "query": "coffee shop logo minimalist modern" },
  { "engine": "behance", "query": "cafe branding typography design" },
  { "engine": "pinterest", "query": "coffee brand identity minimal" }
]

The improved design_search tool will:
- Automatically fetch 9 images from EACH search engine
- Run AI vision analysis on each engine's results separately
- Select the best 3-4 from each engine in parallel
- Perform a final selection round to get the highest quality 9 inspirations
- Focus on QUALITY over quantity - only exceptional designs make it through
`;
}

/**
 * Generate prompt for draft creation
 */
export function generateDraftPrompt(): string {
    return `**No Draft Designs**

Please generate draft designs using the generate_drafts() tool.

Create 3-4 different prompt configurations, each exploring different creative approaches. When referencing inspiration images, ONLY use the unique IDs that are currently available in the registry.

IMPORTANT: 
- ONLY use the unique IDs from the "Valid inspiration image IDs" list shown above
- In the array, just use the number without the # symbol  
- Each generated image should contain a SINGLE design concept only
- Do not request multiple variations (like light/dark versions) within the same image
- Using invalid IDs will cause an error

Example (assuming valid IDs are 6, 26, 29, 30):
- promptConfigs[0]: { prompt: "Modern wordmark...", inspirationGridIds: [6, 26] } // Uses images #6 and #26
- promptConfigs[1]: { prompt: "Abstract logo...", inspirationGridIds: [29] } // Uses image #29
- promptConfigs[2]: { prompt: "Geometric design..." } // Uses all inspiration images

The tool will automatically create a grid and select the best 3 drafts for you.
`;
}

/**
 * Generate prompt for draft selection
 */
export function generateDraftSelectionPrompt(): string {
    return `**Draft Designs Generated**

The draft designs have been generated and the best 3 have been automatically selected.

You can now proceed to generate medium quality versions.
`;
}

/**
 * Generate prompt for medium quality generation
 */
export function generateMediumPrompt(): string {
    return `**No Medium Quality Designs**

Please generate medium quality versions using generate_medium_quality() tool.

You can specify which drafts to improve (by grid number) and provide specific improvement prompts for each. This allows you to focus on particular design directions and give targeted feedback for refinement.

The tool will automatically create a grid and select the best design for you.
`;
}

/**
 * Generate prompt for medium selection
 */
export function generateMediumSelectionPrompt(): string {
    return `**Medium Quality Designs Generated**

The medium quality designs have been generated and the best one has been automatically selected.

You can now proceed to generate the final high quality version.
`;
}

/**
 * Generate prompt for high quality generation
 */
export function generateHighQualityPrompt(): string {
    return `**No High Quality Design**

Please generate the final high quality version using generate_high_quality() tool.

Create a pixel-perfect version of the selected medium design with maximum quality settings.

IMPORTANT: Generate a SINGLE best version only - do not create multiple variations or show light/dark versions in the same image.
`;
}

/**
 * Generate the main instructions for the agent
 */
export function generateAgentInstructions(
    assetType: DESIGN_ASSET_TYPES | undefined,
    withInspiration: boolean
): string {
    return `You are one of the best AI designer in the world. You have an eye for aesthetically pleasing designs that push the boundaries of modern interfaces.


        You are given a design task and a series of steps to work through to complete a world class design for any given prompt. While the series of steps are important, you are free to use you best judgement if a step needs to be repeated or skipped to return the best result.

DESIGN SPECIFICATIONS:
${assetType ? `- Asset Type: ${assetType} (${DESIGN_ASSET_REFERENCE[assetType].description})
- Usage Context: ${DESIGN_ASSET_REFERENCE[assetType].usage_context}
- Aspect Ratio: ${DESIGN_ASSET_REFERENCE[assetType].spec.aspect}
- Background: ${DESIGN_ASSET_REFERENCE[assetType].spec.background}` : '- Asset Type: To be determined based on user request'}

YOUR PROCESS:
1. **Research Phase** ${withInspiration ? '(ENABLED)' : '(SKIPPED)'}:
   ${withInspiration ? `- Use design_search to find 3-6 inspiration images
   - Search multiple platforms with queries tailored to the user's request
   - Focus on finding diverse, high-quality references that match the brief` : '- Skipping inspiration search as requested'}

2. **Draft Generation Phase**:
   - Use generate_drafts() with 3-4 different prompt configurations
   - Each configuration can specify inspiration images by their unique IDs
   - ONLY use IDs from the "Valid inspiration image IDs" list shown in the status
   - Example: if valid IDs are [6, 26, 29, 30], use inspirationGridIds: [6, 26]
   - Using invalid IDs will cause an error - always check the valid list first
   - Generate 3-4 images per prompt (9-12 total drafts)
   - The tool will automatically create a grid and select the best 3 drafts
   - Explore different concepts and approaches

3. **Medium Quality Phase**:
   - Use generate_medium_quality() to improve selected drafts
   - You can specify which drafts to improve and provide custom prompts
   - Generate variations with enhanced details and fixed issues
   - The tool will automatically create a grid and select the best design

4. **High Quality Phase**:
   - Use generate_high_quality() to create the final version
   - Provide specific instructions for final refinements
   - You can optionally choose a different medium design by grid number
   - Achieve professional, pixel-perfect quality
   - IMPORTANT: Request a SINGLE best version only - not multiple variations in one image

5. **Final Output**:
   - Return the path to the final high-quality image
   - The final image should contain only ONE design, not multiple versions

IMPORTANT:
- Follow each phase in sequence
- Use the provided tools rather than attempting to generate images directly
- Each phase builds on the previous one
- At every stage, each generated image should contain a SINGLE design only
- Never request multiple variations (like light/dark versions) within the same image
- The goal is to deliver a professional quality design that meets the user's requirements

Begin with ${withInspiration ? 'the research phase' : 'draft generation'}.`;
}