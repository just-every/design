/**
 * Tool implementations for the Design Agent
 * These are the actual functions that perform the design operations
 */

import { 
    DESIGN_ASSET_TYPES,
    DESIGN_ASSET_REFERENCE,
    type DesignSearchResult,
} from '../constants.js';
import { createNumberedGrid, selectBestFromGrid, type ImageSource } from '../design-search.js';
import { generate_image_raw } from '../design-image.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { initializeDesignLogger } from '../utils/design-logger.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { convertFinalDesignToSvg } from '../utils/svg-converter.js';
import { getImageRegistry, createNewImageRegistry } from '../utils/image-registry.js';
import { resolveUniqueIdToPath, validateUniqueIds } from '../utils/id-resolver.js';


/**
 * Design agent state interface
 */
export interface DesignAgentState {
    designId: string;
    designType?: DESIGN_ASSET_TYPES;
    researchReport?: string;
    designInspiration?: DesignSearchResult[];
    draftDesigns?: string[];
    selectedDrafts?: number[];
    mediumDesigns?: string[];
    selectedMedium?: number;
    finalDesign?: string;
    finalDesignSvg?: string;
    outputDir: string;
    userPrompt: string;
}

/**
 * Tool implementations class
 */
export class DesignAgentToolsImpl {
    constructor(private state: DesignAgentState) {}

    /**
     * Set the design type and ID for the project
     */
    setDesign(design_type: DESIGN_ASSET_TYPES, design_id: string): string {
        this.state.designType = design_type;
        
        // Ensure design_id is valid and find a unique directory
        const baseId = design_id.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        let finalId = baseId;
        let counter = 1;
        
        // Check if directory exists and increment if needed
        while (existsSync(path.join(process.cwd(), '.output', finalId))) {
            finalId = `${baseId}_${counter}`;
            counter++;
        }
        
        // Update state with final design ID and create directory
        this.state.designId = finalId;
        this.state.outputDir = createOutputDirectory(finalId);
        
        // Set the DESIGN_OUTPUT_DIR environment variable for all tools
        process.env.DESIGN_OUTPUT_DIR = this.state.outputDir;
        console.log(`[DesignAgent] Set DESIGN_OUTPUT_DIR to: ${this.state.outputDir}`);
        
        // Initialize logger for this design session
        initializeDesignLogger(this.state.outputDir);
        
        // Create a fresh image registry for this design session
        createNewImageRegistry();
        console.log(`[DesignAgent] Created new image registry for design session: ${finalId}`);
        
        // Save initial design metadata
        const metadataDir = path.join(this.state.outputDir, 'metadata');
        if (!existsSync(metadataDir)) {
            mkdirSync(metadataDir, { recursive: true });
        }
        const metadata = {
            design_id: finalId,
            design_type: design_type,
            user_prompt: this.state.userPrompt,
            created_at: new Date().toISOString(),
        };
        writeFileSync(path.join(metadataDir, 'design_info.json'), JSON.stringify(metadata, null, 2), 'utf-8');
        
        return `Design initialized with type: ${design_type}, ID: ${finalId}`;
    }

    /**
     * Write the research report based on findings
     */
    writeResearchReport(
        guide: string,
        ideal: string,
        warnings: string,
        inspiration: string,
        criteria: string
    ): string {
        const researchReport = `GENERAL GUIDELINES:
${guide}

IDEAL CHARACTERISTICS:
${ideal}

WARNINGS:
${warnings}

INSPIRATION:
${inspiration}

JUDGING CRITERIA:
${criteria}`;
        
        this.state.researchReport = researchReport;
        
        // Save research report to file
        const reportsDir = path.join(this.state.outputDir, 'reports');
        if (!existsSync(reportsDir)) {
            mkdirSync(reportsDir, { recursive: true });
        }
        const reportPath = path.join(reportsDir, 'research_report.md');
        writeFileSync(reportPath, researchReport, 'utf-8');
        
        return 'Successfully updated research report';
    }

    /**
     * Search for design inspiration
     */
    async designSearch(
        context: string,
        searchConfigs: unknown,
        judge_criteria: string,
        count?: number
    ): Promise<DesignSearchResult[]> {
        if (!this.state.designType) {
            throw new Error('Design type is not set');
        }
        
        // Parse searchConfigs if it's a string
        let configs = searchConfigs;
        if (typeof searchConfigs === 'string') {
            try {
                configs = JSON.parse(searchConfigs);
            } catch (error) {
                console.error('[DesignAgent] Failed to parse searchConfigs:', error);
                throw new Error('Invalid searchConfigs format');
            }
        }
        
        // Validate configs is an array
        if (!Array.isArray(configs)) {
            console.error('[DesignAgent] searchConfigs is not an array:', configs);
            throw new Error('searchConfigs must be an array');
        }

        // If configs is an array of strings, parse each string to convert to objects
        if (configs.length > 0 && configs.every(config => typeof config === 'string')) {
            try {
                configs = configs.map(config => JSON.parse(config));
            } catch (error) {
                console.error('[DesignAgent] Failed to parse string configs:', error);
                throw new Error('Invalid JSON format in searchConfigs strings');
            }
        }
        
        // Log for debugging
        console.log('[DesignAgent] Design search called with:');
        console.log('  Context:', context);
        console.log('  Configs:', JSON.stringify(configs, null, 2));
        console.log('  Judge criteria:', judge_criteria);
        console.log('  Count:', count);
        
        // Remove any limit specifications from configs - we always get 9 from each engine
        const cleanConfigs = configs.map((config: {engine: string, query: string, limit?: number}) => ({
            engine: config.engine,
            query: config.query
            // Ignore any limit property
        }));
        
        // Import the improved function
        const { smart_design_improved } = await import('../design-search.js');
        
        // Use improved search that forces 9 from each engine
        const results = await smart_design_improved(
            context, 
            cleanConfigs, 
            count || 9, // Final selection count (max 9)
            this.state.designType, 
            judge_criteria
        );
        this.state.designInspiration = results;
        return results;
    }

    /**
     * Generate draft designs with specific inspiration images per prompt
     */
    async generateDrafts(
        context: string,
        promptConfigs: Array<{
            prompt: string;
            inspirationGridIds?: (number | string)[];
            count?: number;
        }>
    ): Promise<string[]> {
        if (!this.state.designType) {
            throw new Error('Design type is not set');
        }

        const spec = DESIGN_ASSET_REFERENCE[this.state.designType].spec;
        const allPaths: string[] = [];
        
        // Drafts will be saved to DESIGN_OUTPUT_DIR/drafts by generate_image_raw
        const draftsDir = 'drafts';

        for (let i = 0; i < promptConfigs.length; i++) {
            const config = promptConfigs[i];
            const referenceImages: string[] = [];
            
            // Get specific inspiration images for this prompt
            if (config.inspirationGridIds && config.inspirationGridIds.length > 0 && this.state.designInspiration) {
                console.log(`[DesignAgent] Processing inspirationGridIds for prompt ${i + 1}:`, config.inspirationGridIds);
                
                const registry = getImageRegistry();
                const invalidIds: number[] = [];
                
                for (const gridId of config.inspirationGridIds) {
                    // Convert to number
                    const uniqueId = typeof gridId === 'string' ? parseInt(gridId) : gridId;
                    
                    console.log(`[DesignAgent] Looking for unique ID #${uniqueId}`);
                    
                    // Get the image by its unique ID
                    const registeredImage = registry.getImage(uniqueId);
                    
                    if (registeredImage && registeredImage.category === 'inspiration') {
                        // Simple: just use the path from the registry
                        const imagePath = registeredImage.path;
                        
                        console.log(`[DesignAgent] Found inspiration image with unique ID #${uniqueId}: ${imagePath}`);
                        referenceImages.push(imagePath);
                    } else {
                        console.log(`[DesignAgent] Invalid unique ID #${uniqueId} - not found in registry or not an inspiration image`);
                        invalidIds.push(uniqueId);
                    }
                }
                
                if (invalidIds.length > 0) {
                    throw new Error(`Invalid inspiration image IDs: [${invalidIds.join(', ')}]. Please use the unique IDs shown in the top-left corner of the inspiration images (e.g., #5, #7).`);
                }
            } else if (this.state.designInspiration && this.state.designInspiration.length > 0) {
                // Use all inspiration images if none specified
                console.log(`[DesignAgent] No specific inspirationGridIds for prompt ${i + 1}, using all ${this.state.designInspiration.length} inspiration images`);
                this.state.designInspiration.forEach(image => {
                    if (image.screenshotURL) {
                        referenceImages.push(image.screenshotURL);
                    }
                });
            }
            
            let promptContext = context;
            if (referenceImages.length > 0) {
                promptContext += `\n\nPlease use the reference images provided as inspiration only. Do not copy them or use them directly in your design. You are creating a new design based on the style from these images.`;
            }
            
            console.log(`[DesignAgent] Prompt ${i + 1} using ${referenceImages.length} reference images`);
            
            const imageCount = config.count || 3;
            const result = await generate_image_raw(
                `Context: ${promptContext}\n\nPrompt: ${config.prompt}`,
                spec.aspect,
                spec.background,
                referenceImages,
                draftsDir,
                imageCount,
                'low', // draft quality
                `draft_${i + 1}`
            );
            
            // Handle both single path and array of paths
            if (Array.isArray(result)) {
                allPaths.push(...result);
            } else {
                allPaths.push(result);
            }
        }

        this.state.draftDesigns = allPaths;
        
        // Automatically create grid and select best drafts
        console.log('[DesignAgent] Auto-creating draft grid and selecting best 3...');
        
        const gridPath = await this.createDraftGrid();
        await this.selectBestDrafts(gridPath, 3);
        
        return allPaths;
    }

    /**
     * Create a numbered grid from draft designs
     */
    async createDraftGrid(): Promise<string> {
        if (!this.state.draftDesigns || this.state.draftDesigns.length === 0) {
            throw new Error('No draft designs to create grid from');
        }

        const imageSources: ImageSource[] = this.state.draftDesigns.map(path => ({ url: path }));
        // Grid will be saved to DESIGN_OUTPUT_DIR/grids by createNumberedGrid
        return await createNumberedGrid(imageSources, 'draft_grid', 'square', 'draft');
    }

    /**
     * Select the best drafts from the grid
     */
    async selectBestDrafts(
        gridPath: string,
        count: number = 3,
        criteria?: string
    ): Promise<number[]> {
        const defaultCriteria = `Select the ${count} best draft designs based on:
- Concept strength and originality
- Alignment with the design brief: ${this.state.userPrompt}
- Potential for improvement in higher quality versions
- Visual appeal and composition`;

        // Load the grid image and convert to data URL if it's a file path
        let gridDataUrl = gridPath;
        if (!gridPath.startsWith('data:image/')) {
            // It's a file path, load and convert to data URL
            const gridImage = await loadImage(gridPath);
            const canvas = createCanvas(gridImage.width, gridImage.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(gridImage, 0, 0);
            gridDataUrl = canvas.toDataURL('image/png');
        }

        // Get the unique IDs for the draft images
        const registry = getImageRegistry();
        const draftImageIds: number[] = [];
        for (const draftPath of this.state.draftDesigns!) {
            const id = registry.getIdByPath(draftPath);
            if (id !== undefined) {
                draftImageIds.push(id);
            }
        }

        const selections = await selectBestFromGrid(
            gridDataUrl,
            criteria || defaultCriteria,
            count,
            this.state.draftDesigns!.length,
            false,  // Not a design search, this is for selecting generated images
            undefined, // No asset type needed
            undefined, // No judge guide
            draftImageIds
        );

        // Convert grid positions to unique IDs
        const selectedUniqueIds = selections.map(gridPos => draftImageIds[gridPos - 1]).filter(id => id !== undefined);
        this.state.selectedDrafts = selectedUniqueIds;
        
        // Save selection info
        const selectionsDir = path.join(this.state.outputDir, 'selections');
        if (!existsSync(selectionsDir)) {
            mkdirSync(selectionsDir, { recursive: true });
        }
        const selectionData = {
            phase: 'draft_selection',
            selected_grid_positions: selections,
            selected_unique_ids: selectedUniqueIds,
            total_drafts: this.state.draftDesigns!.length,
            criteria: criteria || defaultCriteria,
            timestamp: new Date().toISOString(),
        };
        writeFileSync(path.join(selectionsDir, 'draft_selections.json'), JSON.stringify(selectionData, null, 2), 'utf-8');
        
        return selectedUniqueIds;
    }

    /**
     * Generate medium quality versions with specific prompts per draft
     */
    async generateMediumQuality(mediumConfigs?: Array<{
        draftGridId: number;
        prompt?: string;
        variations?: number;
    }>): Promise<string[]> {
        if (!this.state.selectedDrafts || !this.state.draftDesigns) {
            throw new Error('No drafts selected for medium quality generation');
        }

        const spec = DESIGN_ASSET_REFERENCE[this.state.designType!].spec;
        const allPaths: string[] = [];
        
        // Medium designs will be saved to DESIGN_OUTPUT_DIR/medium by generate_image_raw
        const mediumDir = 'medium';

        // Use specific configurations or default to selectedDrafts
        if (mediumConfigs && mediumConfigs.length > 0) {
            // Validate all unique IDs first
            const uniqueIds = mediumConfigs.map(config => config.draftGridId);
            const validation = validateUniqueIds(uniqueIds, 'draft');
            
            if (validation.invalid.length > 0) {
                throw new Error(`Invalid draft unique IDs: [${validation.invalid.join(', ')}]. Valid draft IDs are: [${this.getValidIds('draft').join(', ')}]`);
            }
            
            // Use specific draft configs with custom prompts
            for (const config of mediumConfigs) {
                const uniqueId = config.draftGridId;
                
                // Resolve unique ID to file path
                const sourcePath = resolveUniqueIdToPath(uniqueId, 'draft');
                if (!sourcePath) {
                    console.warn(`Could not resolve draft unique ID #${uniqueId}, skipping`);
                    continue;
                }
                
                const variationCount = config.variations || 3;
                const promptText = config.prompt || `Improve this design: fix any text/spelling errors, enhance details, maintain the core concept and layout. Generate a SINGLE design only - do not include multiple variations in the same image. Design brief: ${this.state.userPrompt}`;

                // Generate variations for this draft
                for (let v = 0; v < variationCount; v++) {
                    const result = await generate_image_raw(
                        promptText,
                        spec.aspect,
                        spec.background,
                        sourcePath,
                        mediumDir,
                        1,
                        'medium',
                        `medium_id${uniqueId}_v${v + 1}`
                    );
                    allPaths.push(result as string);
                }
            }
        } else {
            // Use selected drafts with default prompt (now using unique IDs)
            const draftsToUse = this.state.selectedDrafts;
            
            for (const uniqueId of draftsToUse) {
                // Resolve unique ID to file path
                const sourcePath = resolveUniqueIdToPath(uniqueId, 'draft');
                if (!sourcePath) {
                    console.warn(`Could not resolve draft unique ID #${uniqueId}, skipping`);
                    continue;
                }

                // Generate 3 variations of each selected draft
                for (let v = 0; v < 3; v++) {
                    const result = await generate_image_raw(
                        `Improve this design: fix any text/spelling errors, enhance details, maintain the core concept and layout. Generate a SINGLE design only - do not include multiple variations in the same image. Design brief: ${this.state.userPrompt}`,
                        spec.aspect,
                        spec.background,
                        sourcePath,
                        mediumDir,
                        1,
                        'medium',
                        `medium_id${uniqueId}_v${v + 1}`
                    );
                    allPaths.push(result as string);
                }
            }
        }

        this.state.mediumDesigns = allPaths;
        
        // Automatically create grid and select best
        console.log('[DesignAgent] Auto-creating medium grid and selecting best...');
        
        const gridPath = await this.createMediumGrid();
        await this.selectBestMedium(gridPath);
        
        return allPaths;
    }

    /**
     * Create a numbered grid from medium quality designs
     */
    async createMediumGrid(): Promise<string> {
        if (!this.state.mediumDesigns || this.state.mediumDesigns.length === 0) {
            throw new Error('No medium designs to create grid from');
        }

        const imageSources: ImageSource[] = this.state.mediumDesigns.map(path => ({ url: path }));
        // Grid will be saved to DESIGN_OUTPUT_DIR/grids by createNumberedGrid
        return await createNumberedGrid(imageSources, 'medium_grid', 'square', 'medium');
    }

    /**
     * Select the best medium quality design
     */
    async selectBestMedium(
        gridPath: string,
        criteria?: string
    ): Promise<number> {
        const defaultCriteria = `Select the single best medium quality design based on:
- Technical execution and polish
- Text accuracy and readability
- Overall visual quality
- Best fulfillment of the design brief: ${this.state.userPrompt}`;

        // Load the grid image and convert to data URL if it's a file path
        let gridDataUrl = gridPath;
        if (!gridPath.startsWith('data:image/')) {
            // It's a file path, load and convert to data URL
            const gridImage = await loadImage(gridPath);
            const canvas = createCanvas(gridImage.width, gridImage.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(gridImage, 0, 0);
            gridDataUrl = canvas.toDataURL('image/png');
        }

        // Get the unique IDs for the medium images
        const registry = getImageRegistry();
        const mediumImageIds: number[] = [];
        for (const mediumPath of this.state.mediumDesigns!) {
            const id = registry.getIdByPath(mediumPath);
            if (id !== undefined) {
                mediumImageIds.push(id);
            }
        }

        const selections = await selectBestFromGrid(
            gridDataUrl,
            criteria || defaultCriteria,
            1,
            this.state.mediumDesigns!.length,
            false,  // Not a design search, this is for selecting generated images
            undefined, // No asset type needed
            undefined, // No judge guide
            mediumImageIds
        );

        // Convert grid position to unique ID
        const selectedUniqueId = mediumImageIds[selections[0] - 1];
        this.state.selectedMedium = selectedUniqueId;
        
        // Save selection info
        const selectionsDir = path.join(this.state.outputDir, 'selections');
        if (!existsSync(selectionsDir)) {
            mkdirSync(selectionsDir, { recursive: true });
        }
        const selectionData = {
            phase: 'medium_selection',
            selected_grid_position: selections[0],
            selected_unique_id: selectedUniqueId,
            total_medium: this.state.mediumDesigns!.length,
            criteria: criteria || defaultCriteria,
            timestamp: new Date().toISOString(),
        };
        writeFileSync(path.join(selectionsDir, 'medium_selection.json'), JSON.stringify(selectionData, null, 2), 'utf-8');
        
        return selectedUniqueId;
    }

    /**
     * Generate final high quality version
     */
    async generateHighQuality(
        additionalInstructions?: string,
        mediumGridId?: number
    ): Promise<string> {
        if (!this.state.mediumDesigns || this.state.mediumDesigns.length === 0) {
            throw new Error('No medium designs available for high quality generation');
        }

        const spec = DESIGN_ASSET_REFERENCE[this.state.designType!].spec;
        let sourcePath: string;
        
        if (mediumGridId !== undefined) {
            // Use specific medium unique ID
            const resolvedPath = resolveUniqueIdToPath(mediumGridId, 'medium');
            if (!resolvedPath) {
                const validIds = this.getValidIds('medium');
                throw new Error(`Invalid medium unique ID: ${mediumGridId}. Valid medium IDs are: [${validIds.join(', ')}]`);
            }
            sourcePath = resolvedPath;
        } else {
            // Use selectedMedium (now a unique ID)
            if (this.state.selectedMedium === undefined) {
                throw new Error('No medium design selected for high quality generation');
            }
            
            // Resolve unique ID to path
            const resolvedPath = resolveUniqueIdToPath(this.state.selectedMedium, 'medium');
            if (!resolvedPath) {
                const validIds = this.getValidIds('medium');
                throw new Error(`Invalid selected medium ID: ${this.state.selectedMedium}. Valid medium IDs are: [${validIds.join(', ')}]`);
            }
            
            sourcePath = resolvedPath;
        }
        
        console.log(`[DesignAgent] High quality generation - selectedMedium: ${this.state.selectedMedium}, sourcePath: ${sourcePath}`);
        console.log(`[DesignAgent] Medium designs array:`, this.state.mediumDesigns);
        
        if (!sourcePath || sourcePath === '/') {
            throw new Error(`Invalid source path for high quality generation: ${sourcePath}`);
        }

        const finalPrompt = `Create a pixel-perfect, professional quality version of this design. Generate a SINGLE best version only - do not include multiple variations (like light/dark versions) in the same image. ${additionalInstructions || ''} Original brief: ${this.state.userPrompt}`;

        // Final design will be saved to DESIGN_OUTPUT_DIR/final by generate_image_raw
        const finalDir = 'final';

        const result = await generate_image_raw(
            finalPrompt,
            spec.aspect,
            spec.background,
            sourcePath,
            finalDir,
            1,
            'high',
            'final'
        );

        // generate_image_raw returns a single path when number_of_images === 1
        this.state.finalDesign = result as string;
        
        // Convert to SVG if the asset type requires it
        let svgPath: string | null = null;
        if (this.state.designType) {
            svgPath = await convertFinalDesignToSvg(
                result as string,
                this.state.designType,
                this.state.outputDir
            );
            
            if (svgPath) {
                console.log(`[DesignAgent] Final design converted to SVG: ${svgPath}`);
                this.state.finalDesignSvg = svgPath;
            }
        }
        
        // Save final design info
        const metadataDir = path.join(this.state.outputDir, 'metadata');
        if (!existsSync(metadataDir)) {
            mkdirSync(metadataDir, { recursive: true });
        }
        const finalData = {
            final_image_path: result as string,
            final_svg_path: svgPath,
            design_type: this.state.designType,
            user_prompt: this.state.userPrompt,
            additional_instructions: additionalInstructions,
            completed_at: new Date().toISOString(),
            process_summary: {
                inspiration_images: this.state.designInspiration?.length || 0,
                draft_designs: this.state.draftDesigns?.length || 0,
                selected_drafts: this.state.selectedDrafts?.length || 0,
                medium_designs: this.state.mediumDesigns?.length || 0,
                selected_medium_index: this.state.selectedMedium,
            }
        };
        writeFileSync(path.join(metadataDir, 'final_design.json'), JSON.stringify(finalData, null, 2), 'utf-8');
        
        return result as string;
    }

    /**
     * Delete designs by type
     */
    deleteDesigns(designType: 'inspiration' | 'drafts' | 'medium' | 'final' | 'all'): string {
        const deleted: string[] = [];

        switch (designType) {
            case 'inspiration':
                if (this.state.designInspiration) {
                    deleted.push(`${this.state.designInspiration.length} inspiration images`);
                    this.state.designInspiration = undefined;
                }
                break;
            
            case 'drafts':
                if (this.state.draftDesigns) {
                    deleted.push(`${this.state.draftDesigns.length} draft designs`);
                    this.state.draftDesigns = undefined;
                    this.state.selectedDrafts = undefined;
                }
                break;
            
            case 'medium':
                if (this.state.mediumDesigns) {
                    deleted.push(`${this.state.mediumDesigns.length} medium quality designs`);
                    this.state.mediumDesigns = undefined;
                    this.state.selectedMedium = undefined;
                }
                break;
            
            case 'final':
                if (this.state.finalDesign) {
                    deleted.push('final design');
                    this.state.finalDesign = undefined;
                }
                break;
            
            case 'all':
                if (this.state.designInspiration) {
                    deleted.push(`${this.state.designInspiration.length} inspiration images`);
                    this.state.designInspiration = undefined;
                }
                if (this.state.draftDesigns) {
                    deleted.push(`${this.state.draftDesigns.length} draft designs`);
                    this.state.draftDesigns = undefined;
                    this.state.selectedDrafts = undefined;
                }
                if (this.state.mediumDesigns) {
                    deleted.push(`${this.state.mediumDesigns.length} medium quality designs`);
                    this.state.mediumDesigns = undefined;
                    this.state.selectedMedium = undefined;
                }
                if (this.state.finalDesign) {
                    deleted.push('final design');
                    this.state.finalDesign = undefined;
                }
                break;
        }

        if (deleted.length === 0) {
            return `No ${designType} designs to delete`;
        }

        return `Deleted: ${deleted.join(', ')}`;
    }

    /**
     * Remake specific designs by unique ID
     */
    async remakeDesign(
        designType: 'draft' | 'medium',
        uniqueIds: number[],
        newPrompts?: string[]
    ): Promise<string[]> {
        const spec = DESIGN_ASSET_REFERENCE[this.state.designType!].spec;
        
        if (designType === 'draft') {
            if (!this.state.draftDesigns) {
                throw new Error('No draft designs exist to remake');
            }

            // Validate unique IDs
            const validation = validateUniqueIds(uniqueIds, 'draft');
            if (validation.invalid.length > 0) {
                const validIds = this.getValidIds('draft');
                throw new Error(`Invalid draft unique IDs: [${validation.invalid.join(', ')}]. Valid draft IDs are: [${validIds.join(', ')}]`);
            }

            // Generate new drafts
            const prompts = newPrompts || [`Remake draft design based on: ${this.state.userPrompt}`];
            const newDrafts: string[] = [];

            for (let i = 0; i < uniqueIds.length; i++) {
                const prompt = prompts[i % prompts.length];
                const uniqueId = uniqueIds[i];
                
                // Find inspiration image (if any)
                const inspiration = this.state.designInspiration?.[0]?.screenshotURL; // Use first inspiration as fallback

                const result = await generate_image_raw(
                    prompt,
                    spec.aspect,
                    spec.background,
                    inspiration,
                    'drafts',
                    1,
                    'low',
                    `draft_remake_id${uniqueId}`
                );

                // Find the old draft path and replace it
                const oldPath = resolveUniqueIdToPath(uniqueId, 'draft');
                if (oldPath && this.state.draftDesigns) {
                    const index = this.state.draftDesigns.findIndex(path => path === oldPath);
                    if (index >= 0) {
                        this.state.draftDesigns[index] = result as string;
                    }
                }
                
                newDrafts.push(result as string);
            }

            return newDrafts;
        } else if (designType === 'medium') {
            if (!this.state.mediumDesigns) {
                throw new Error('No medium designs exist to remake');
            }

            // Validate unique IDs
            const validation = validateUniqueIds(uniqueIds, 'medium');
            if (validation.invalid.length > 0) {
                const validIds = this.getValidIds('medium');
                throw new Error(`Invalid medium unique IDs: [${validation.invalid.join(', ')}]. Valid medium IDs are: [${validIds.join(', ')}]`);
            }

            // Generate new medium quality designs
            const prompts = newPrompts || [`Improve and refine this design: ${this.state.userPrompt}`];
            const newMediums: string[] = [];

            for (let i = 0; i < uniqueIds.length; i++) {
                const prompt = prompts[i % prompts.length];
                const uniqueId = uniqueIds[i];
                
                // Use a draft as source if available
                let sourcePath: string | undefined;
                if (this.state.draftDesigns && this.state.draftDesigns.length > 0) {
                    // Use the first draft as source (fallback)
                    sourcePath = this.state.draftDesigns[0];
                }

                const result = await generate_image_raw(
                    prompt,
                    spec.aspect,
                    spec.background,
                    sourcePath,
                    'medium',
                    1,
                    'medium',
                    `medium_remake_id${uniqueId}`
                );

                // Find the old medium path and replace it
                const oldPath = resolveUniqueIdToPath(uniqueId, 'medium');
                if (oldPath && this.state.mediumDesigns) {
                    const index = this.state.mediumDesigns.findIndex(path => path === oldPath);
                    if (index >= 0) {
                        this.state.mediumDesigns[index] = result as string;
                    }
                }

                newMediums.push(result as string);
            }

            // Clear selection if any of the remade designs was selected (legacy compatibility)
            // Note: This will need to be updated when selectedMedium becomes a unique ID
            if (this.state.selectedMedium) {
                this.state.selectedMedium = undefined;
            }

            return newMediums;
        }

        throw new Error(`Invalid design type: ${designType}`);
    }

    /**
     * Helper method to get valid unique IDs for a category
     */
    private getValidIds(category: 'inspiration' | 'draft' | 'medium' | 'final'): number[] {
        const registry = getImageRegistry();
        const images = registry.getImagesByCategory(category);
        return images.map(img => img.id).sort((a, b) => a - b);
    }
}

/**
 * Create output directory for design session
 */
export function createOutputDirectory(designId: string): string {
    const outputDir = path.join(process.cwd(), '.output', designId);
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
}
