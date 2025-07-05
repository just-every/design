import potrace from 'potrace';
import { promises as fs } from 'fs';
import path from 'path';
import { DESIGN_ASSET_TYPES } from '../constants.js';

export interface SvgConversionOptions {
    color?: string;
    background?: string;
    threshold?: number;
    turnPolicy?: potrace.TurnPolicy;
    alphaMax?: number;
}

/**
 * Convert a PNG image to SVG using potrace
 * @param inputPath Path to the PNG file
 * @param outputPath Path where the SVG should be saved
 * @param options Conversion options
 * @returns Path to the created SVG file
 */
export async function convertPngToSvg(
    inputPath: string,
    outputPath: string,
    options: SvgConversionOptions = {}
): Promise<string> {
    const {
        color = '#000000',
        background = 'transparent',
        threshold = 128,
        turnPolicy = potrace.Potrace.TURNPOLICY_MINORITY,
        alphaMax = 1.0
    } = options;

    return new Promise((resolve, reject) => {
        potrace.trace(inputPath, {
            color,
            background,
            threshold,
            turnPolicy,
            alphaMax
        }, async (err: Error | null, svg: string) => {
            if (err) {
                reject(new Error(`Failed to convert PNG to SVG: ${err.message}`));
                return;
            }

            try {
                // Ensure output directory exists
                const outputDir = path.dirname(outputPath);
                await fs.mkdir(outputDir, { recursive: true });

                // Write SVG file
                await fs.writeFile(outputPath, svg, 'utf-8');
                
                console.log(`[SVG Converter] Converted ${inputPath} to ${outputPath}`);
                resolve(outputPath);
            } catch (writeErr) {
                reject(new Error(`Failed to write SVG file: ${writeErr}`));
            }
        });
    });
}

/**
 * Convert final design to SVG if the asset type requires it
 * @param pngPath Path to the PNG file
 * @param assetType The design asset type
 * @param outputDir Output directory
 * @returns Path to SVG file if converted, otherwise null
 */
export async function convertFinalDesignToSvg(
    pngPath: string,
    assetType: DESIGN_ASSET_TYPES,
    outputDir: string
): Promise<string | null> {
    // Check if this asset type requires SVG
    const { DESIGN_ASSET_REFERENCE } = await import('../constants.js');
    const assetSpec = DESIGN_ASSET_REFERENCE[assetType];
    
    if (!assetSpec || assetSpec.spec.type !== 'svg') {
        return null;
    }

    // Generate SVG output path
    const pngFilename = path.basename(pngPath);
    const svgFilename = pngFilename.replace(/\.png$/i, '.svg');
    const svgPath = path.join(outputDir, 'svg', svgFilename);

    // Convert with optimized settings for logos
    const svgOptions: SvgConversionOptions = {
        color: '#000000',
        background: 'transparent',
        threshold: 128,
        turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
        alphaMax: 1.0
    };

    try {
        await convertPngToSvg(pngPath, svgPath, svgOptions);
        return svgPath;
    } catch (error) {
        console.error(`[SVG Converter] Failed to convert ${assetType} to SVG:`, error);
        return null;
    }
}