/**
 * Simplified Design Search Utility for standalone use
 *
 * This is a minimal version that provides the basic functionality needed
 * by the design_image function without browser dependencies.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { chromium } from 'playwright';
import { quick_llm_call } from './interfaces/mech.js';
import { Agent } from '@just-every/ensemble';
import type { ResponseInput } from '@just-every/ensemble';
// Import the actual web_search function from the new package
import { web_search as engineWebSearch } from '@just-every/search';
import {
    DESIGN_ASSET_REFERENCE,
    DESIGN_SEARCH_DESCRIPTIONS,
    DESIGN_SEARCH_ENGINES,
    DesignSearchEngine,
    DesignSearchResult,
    type DESIGN_ASSET_TYPES,
    type DesignAssetAspect,
} from './constants.js';
import { getImageRegistry } from './utils/image-registry.js';

const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Get the current output directory - this needs to be dynamic to pick up changes
function getOutputDir(): string {
    return process.env.DESIGN_OUTPUT_DIR || path.join(process.cwd(), '.output');
}

const SLEEP = (ms = 1000) => new Promise(res => setTimeout(res, ms));

/**
 * Safely evaluate a function in the page context with retry logic
 */
async function safeEvaluate<T>(
    page: any,
    fn: (...args: any[]) => T,
    ...args: any[]
): Promise<T | null> {
    const maxAttempts = 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            // First check if page is still valid
            await page.evaluate(() => document.readyState);
            
            // Then run the actual evaluation
            const result = await page.evaluate(fn, ...args);
            return result;
        } catch (error) {
            console.warn(`[safeEvaluate] Attempt ${attempt}/${maxAttempts} failed:`, error);
            
            if (attempt < maxAttempts) {
                // Wait a bit before retrying
                await SLEEP(500);
            } else {
                // All attempts failed
                return null;
            }
        }
    }
    
    return null;
}

/**
 * Communication manager stub - logs to console instead of sending to UI
 */
const communicationManager = {
    send: (data: any) => {
        console.log(`[DesignSearch] ${data.type}:`, data);
    }
};

/**
 * Ensure the design assets directory exists
 */
function ensureDesignAssetsDir() {
    const screenshotsDir = path.join(getOutputDir(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }
}

/**
 * Take a real screenshot of a webpage using Playwright
 */
async function takeScreenshot(
    url: string,
    title?: string
): Promise<string | null> {
    ensureDesignAssetsDir();

    let browser;
    try {
        // Launch browser
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Set viewport size
        await page.setViewportSize({ width: 1280, height: 720 });
        
        // Set extra headers to avoid bot detection
        await page.setExtraHTTPHeaders({
            'User-Agent': USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9'
        });

        // Navigate to page with more reasonable timeout
        // Use domcontentloaded for faster loading, then wait briefly for images
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait for images to load (but not too long)
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch (e) {
            // If network idle times out, that's OK - we probably have enough content
            console.log(`[DesignSearch] Network idle timeout for ${url}, proceeding anyway`);
        }
        
        // Brief wait for any animations to settle
        await page.waitForTimeout(1000);

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const uniqueId = uuidv4().substring(0, 8);
        const cleanTitle = title ? title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) : 'screenshot';
        const filename = `${cleanTitle}_${timestamp}_${uniqueId}.png`;

        // Always save screenshots to DESIGN_OUTPUT_DIR/screenshots
        const screenshotDir = path.join(getOutputDir(), 'screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
        const filePath = path.join(screenshotDir, filename);

        // Try to handle cookie banners if present
        try {
            // Common cookie accept button selectors
            const cookieSelectors = [
                'button[id*="accept"]',
                'button[class*="accept"]',
                'button:has-text("Accept")',
                'button:has-text("Got it")',
                'button:has-text("OK")'
            ];
            
            for (const selector of cookieSelectors) {
                const button = await page.$(selector);
                if (button) {
                    await button.click();
                    await page.waitForTimeout(500);
                    break;
                }
            }
        } catch (e) {
            // Ignore cookie banner errors
        }

        // Take screenshot
        await page.screenshot({
            path: filePath,
            fullPage: false  // Just viewport to avoid huge files and timeouts
        });

        await browser.close();

        console.log(`[DesignSearch] Screenshot saved: ${filePath}`);
        return filePath;

    } catch (error) {
        console.error(`[DesignSearch] Screenshot failed for ${url}:`, error);
        // Make sure to close browser on error
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                // Ignore close errors
            }
        }
        // Don't create placeholder images - just return null
        return null;
    }
}

/**
 * Search for design inspiration on Dribbble using real web scraping with retry logic
 */
async function searchDribbble(
    query: string,
    limit: number = 9,
    retryCount: number = 0
): Promise<DesignSearchResult[]> {
    const maxRetries = 2;
    let browser;
    
    try {
        const url = `https://dribbble.com/search/${encodeURIComponent(query)}`;
        console.log(`[DesignSearch] Searching Dribbble: ${query}`);

        // Launch browser with more stable settings
        browser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        
        const context = await browser.newContext({
            userAgent: USER_AGENT
        });
        
        const page = await context.newPage();

        // Navigate to search page with longer timeout
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Wait for search results to load
        await page.waitForTimeout(3000);
        
        // Wait for shots to actually appear
        try {
            await page.waitForSelector('ol > li', { timeout: 10000 });
        } catch (waitError) {
            console.warn('[DesignSearch] No shots appeared within timeout');
        }

        // Extract shot data from the page with the most basic approach
        const results = await page.evaluate((limit) => {
            const shots: any[] = [];
            
            // Get all shot cards - they're in list items
            const shotCards = document.querySelectorAll('ol > li');
            // Note: console.log in page.evaluate doesn't show up in Node.js console
            
            for (let i = 0; i < Math.min(shotCards.length, limit); i++) {
                const card = shotCards[i];
                
                // Find the main link
                const linkElement = card.querySelector('a[href*="/shots/"]');
                if (!linkElement) continue;
                
                const shotUrl = (linkElement as HTMLAnchorElement).href;
                
                // Skip navigation links
                if (shotUrl.includes('/popular') || shotUrl.includes('/recent') || shotUrl.includes('/following')) {
                    continue;
                }
                
                // Find the image - it's usually in a picture element or img
                let thumbnailURL = '';
                let title = '';
                
                // Try picture element first
                const pictureElement = card.querySelector('picture');
                if (pictureElement) {
                    // Look for source elements
                    const sourceElement = pictureElement.querySelector('source');
                    if (sourceElement) {
                        thumbnailURL = sourceElement.srcset || sourceElement.getAttribute('data-srcset') || '';
                        // Get the first URL from srcset
                        if (thumbnailURL.includes(',')) {
                            thumbnailURL = thumbnailURL.split(',')[0].trim().split(' ')[0];
                        }
                    }
                    
                    // Fallback to img
                    if (!thumbnailURL) {
                        const imgElement = pictureElement.querySelector('img');
                        if (imgElement) {
                            thumbnailURL = imgElement.src || imgElement.getAttribute('data-src') || '';
                            title = imgElement.alt || '';
                        }
                    }
                } else {
                    // No picture element, look for img directly
                    const imgElement = card.querySelector('img');
                    if (imgElement) {
                        thumbnailURL = imgElement.src || imgElement.getAttribute('data-src') || '';
                        title = imgElement.alt || '';
                    }
                }
                
                // Get title from other elements if not found
                if (!title) {
                    const titleElement = card.querySelector('[class*="shot-title"], h3, h4, a[title]');
                    if (titleElement) {
                        title = titleElement.textContent?.trim() || (titleElement as any).title || '';
                    }
                }
                
                // Clean up thumbnail URL
                if (thumbnailURL.startsWith('//')) {
                    thumbnailURL = 'https:' + thumbnailURL;
                }
                
                // Skip placeholder images
                if (thumbnailURL.includes('data:image/gif;base64')) {
                    continue;
                }
                
                if (shotUrl && thumbnailURL) {
                    shots.push({
                        url: shotUrl,
                        title: title || `Design ${i + 1}`,
                        thumbnailURL: thumbnailURL,
                        screenshotURL: thumbnailURL
                    });
                }
            }
            
            return shots;
        }, limit);

        console.log(`[DesignSearch] Found ${results.length} Dribbble results`);
        
        // Log first result for debugging
        if (results.length > 0) {
            console.log(`[DesignSearch] First result:`, results[0].url, results[0].thumbnailURL ? 'has thumbnail' : 'no thumbnail');
        } else {
            console.log(`[DesignSearch] No results extracted from page, retrying...`);
            throw new Error('No results found on page');
        }
        
        return results as DesignSearchResult[];

    } catch (error) {
        console.error(`Error in searchDribbble (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
        
        // Retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
            console.log(`[DesignSearch] Retrying Dribbble search...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
            return searchDribbble(query, limit, retryCount + 1);
        }

        // Fallback to basic mock data if all retries fail
        const fallbackResults: DesignSearchResult[] = [];
        for (let i = 0; i < Math.min(limit, 2); i++) {
            fallbackResults.push({
                url: `https://dribbble.com/search/${encodeURIComponent(query)}`,
                title: `${query} Design Reference ${i + 1}`,
                thumbnailURL: undefined,
                screenshotURL: undefined,
            });
        }
        console.log(`[DesignSearch] Using Dribbble fallback data`);
        return fallbackResults;
    } finally {
        // Always close the browser
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.warn('[DesignSearch] Error closing browser:', closeError);
            }
        }
    }
}

/**
 * Search for design inspiration on Behance with retry logic
 */
async function searchBehance(
    query: string,
    limit: number = 9,
    retryCount: number = 0
): Promise<DesignSearchResult[]> {
    const maxRetries = 2;
    
    try {
        const url = `https://www.behance.net/search/projects?search=${encodeURIComponent(query)}`;
        console.log(`[DesignSearch] Searching Behance: ${query}`);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.setExtraHTTPHeaders({
            'User-Agent': USER_AGENT
        });

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait for content to load
        await page.waitForTimeout(3000);

        // Check if page is still valid before evaluate
        try {
            await page.evaluate(() => document.readyState);
        } catch (e) {
            console.warn('[DesignSearch] Page context lost, retrying...');
            await browser.close();
            return searchBehanceFallback(query, limit);
        }

        // Extract project data with error handling
        let results;
        try {
            results = await page.evaluate((limit) => {
                const projects: any[] = [];

                // Try multiple selectors for Behance projects
                const selectors = [
                    '.qa-search-project-item',
                    'div[data-id]',
                    'a[href*="/gallery/"]'
                ];

                let projectElements: Element[] = [];
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        projectElements = Array.from(elements);
                        break;
                    }
                }

                for (let i = 0; i < Math.min(projectElements.length, limit); i++) {
                    const element = projectElements[i];

                    // Find link
                    const linkElement = element.querySelector('a[href*="/gallery/"]') ||
                                      element.closest('a[href*="/gallery/"]');
                    if (!linkElement) continue;

                const url = (linkElement as HTMLAnchorElement).href;

                // Find image
                const imgElement = element.querySelector('img');
                let title = '';
                let thumbnailURL = '';

                if (imgElement) {
                    title = imgElement.alt || imgElement.title || '';
                    thumbnailURL = imgElement.src || imgElement.getAttribute('data-src') || '';

                    // Check for srcset for higher quality
                    const srcset = imgElement.srcset || imgElement.getAttribute('data-srcset');
                    if (srcset) {
                        const sources = srcset.split(',').map(s => s.trim());
                        // Get the highest resolution
                        const highRes = sources[sources.length - 1];
                        if (highRes) {
                            thumbnailURL = highRes.split(' ')[0];
                        }
                    }
                }

                if (url) {
                    projects.push({
                        url,
                        title: title || `Behance Project ${i + 1}`,
                        thumbnailURL,
                        screenshotURL: thumbnailURL
                    });
                }
            }

            return projects;
        }, limit);
        } catch (evalError) {
            console.warn('[DesignSearch] Evaluation failed:', evalError);
            await browser.close();
            return searchBehanceFallback(query, limit);
        }

        await browser.close();

        console.log(`[DesignSearch] Found ${results.length} Behance results`);
        return results as DesignSearchResult[];

    } catch (error) {
        console.error(`Error in searchBehance (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
        
        // Retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
            console.log(`[DesignSearch] Retrying Behance search...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            return searchBehance(query, limit, retryCount + 1);
        }
        
        // If all retries failed, use fallback
        return searchBehanceFallback(query, limit);
    }
}

/**
 * Fallback function for Behance searches when scraping fails
 */
function searchBehanceFallback(query: string, limit: number): DesignSearchResult[] {
    const fallbackResults: DesignSearchResult[] = [];
    for (let i = 0; i < Math.min(limit, 3); i++) {
        fallbackResults.push({
            url: `https://www.behance.net/search/projects?search=${encodeURIComponent(query)}`,
            title: `${query} - Behance Reference ${i + 1}`,
            thumbnailURL: undefined,
            screenshotURL: undefined,
        });
    }
    console.log(`[DesignSearch] Using Behance fallback data (${fallbackResults.length} results)`);
    return fallbackResults;
}

/**
 * Search for design inspiration on Pinterest
 */
async function searchPinterest(
    query: string,
    limit: number = 9
): Promise<DesignSearchResult[]> {
    try {
        const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
        console.log(`[DesignSearch] Searching Pinterest: ${query}`);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.setExtraHTTPHeaders({
            'User-Agent': USER_AGENT
        });

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Pinterest needs time to load dynamic content
        await page.waitForTimeout(3000);

        // Check if page is still valid before scrolling
        try {
            await page.evaluate(() => document.readyState);
        } catch (e) {
            console.warn('[DesignSearch] Pinterest page context lost, closing browser...');
            await browser.close();
            return [];
        }

        // Scroll to load more pins with error handling
        try {
            await page.evaluate(() => {
                window.scrollTo(0, window.innerHeight * 2);
            });
            await page.waitForTimeout(1500);
        } catch (scrollError) {
            console.warn('[DesignSearch] Pinterest scroll failed, continuing anyway');
        }

        // Extract pin data with error handling
        let results;
        try {
            results = await page.evaluate((limit) => {
            const pins: any[] = [];

            // Pinterest uses various selectors over time
            const pinElements = document.querySelectorAll('[data-test-id="pin"], div[role="listitem"] a[href*="/pin/"]');

            for (let i = 0; i < Math.min(pinElements.length, limit); i++) {
                const element = pinElements[i];

                // Get the link
                const linkElement = element.tagName === 'A' ? element : element.querySelector('a[href*="/pin/"]');
                if (!linkElement) continue;

                const url = (linkElement as HTMLAnchorElement).href;

                // Get the image
                const imgElement = element.querySelector('img');
                let title = '';
                let thumbnailURL = '';

                if (imgElement) {
                    title = imgElement.alt || '';
                    thumbnailURL = imgElement.src || imgElement.getAttribute('data-src') || '';

                    // Pinterest often has srcset with higher quality
                    const srcset = imgElement.srcset;
                    if (srcset) {
                        const sources = srcset.split(',').map(s => s.trim());
                        // Get 2x or highest resolution
                        for (const source of sources) {
                            if (source.includes('2x') || source.includes('736x')) {
                                thumbnailURL = source.split(' ')[0];
                                break;
                            }
                        }
                    }
                }

                if (url && url.includes('/pin/')) {
                    pins.push({
                        url,
                        title: title || `Pinterest Pin ${i + 1}`,
                        thumbnailURL,
                        screenshotURL: thumbnailURL
                    });
                }
            }

            return pins;
        }, limit);
        } catch (evalError) {
            console.warn('[DesignSearch] Pinterest evaluation failed:', evalError);
            await browser.close();
            return [];
        }

        await browser.close();

        console.log(`[DesignSearch] Found ${results.length} Pinterest results`);
        return results as DesignSearchResult[];

    } catch (error) {
        console.error('Error in searchPinterest:', error);
        return [];
    }
}

/**
 * Search for design inspiration on Envato Elements
 */
async function searchEnvato(
    query: string,
    limit: number = 9
): Promise<DesignSearchResult[]> {
    try {
        const url = `https://elements.envato.com/web-templates?terms=${encodeURIComponent(query)}`;
        console.log(`[DesignSearch] Searching Envato: ${query}`);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.setExtraHTTPHeaders({
            'User-Agent': USER_AGENT
        });

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait for results to load
        await page.waitForTimeout(3000);

        // Extract template data
        const results = await page.evaluate((limit) => {
            const templates: any[] = [];

            // Envato uses various selectors
            const itemElements = document.querySelectorAll(
                'a[data-testid="item-link"], ' +
                'div[data-testid="default-card"] a, ' +
                'a[href*="/web-templates/"]'
            );

            const uniqueUrls = new Set<string>();

            for (const element of itemElements) {
                if (templates.length >= limit) break;

                const linkElement = element as HTMLAnchorElement;
                const url = linkElement.href;

                // Skip if we've already processed this URL
                if (!url || uniqueUrls.has(url)) continue;
                uniqueUrls.add(url);

                // Find the image within this item
                const imgElement = linkElement.querySelector('img') ||
                                 linkElement.parentElement?.querySelector('img');

                let title = '';
                let thumbnailURL = '';

                if (imgElement) {
                    title = imgElement.alt || '';
                    thumbnailURL = imgElement.src || imgElement.getAttribute('data-src') || '';

                    // Look for srcset for higher quality
                    const srcset = imgElement.srcset || imgElement.getAttribute('data-srcset');
                    if (srcset) {
                        // Parse srcset and get highest resolution
                        const sources = srcset.split(',').map(s => s.trim());
                        for (const source of sources) {
                            if (source.includes('710w') || source.includes('800w')) {
                                thumbnailURL = source.split(' ')[0];
                                break;
                            }
                        }
                    }
                }

                // Try to get title from other elements if not from image
                if (!title) {
                    const titleElement = linkElement.querySelector('h3, h4, [class*="title"]');
                    if (titleElement) {
                        title = titleElement.textContent?.trim() || '';
                    }
                }

                if (url && (url.includes('/web-templates/') || url.includes('elements.envato.com'))) {
                    templates.push({
                        url,
                        title: title || `Envato Template`,
                        thumbnailURL,
                        screenshotURL: thumbnailURL
                    });
                }
            }

            return templates;
        }, limit);

        await browser.close();

        console.log(`[DesignSearch] Found ${results.length} Envato results`);
        return results as DesignSearchResult[];

    } catch (error) {
        console.error('Error in searchEnvato:', error);
        return [];
    }
}

/**
 * Search for award-winning web designs on Awwwards
 */
async function searchAwwwards(
    query: string,
    limit: number = 9
): Promise<DesignSearchResult[]> {
    try {
        // Awwwards doesn't have a search, so we browse their collections
        const url = 'https://www.awwwards.com/websites/';
        console.log(`[DesignSearch] Browsing Awwwards for inspiration related to: ${query}`);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.setExtraHTTPHeaders({
            'User-Agent': USER_AGENT
        });

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait for content
        await page.waitForTimeout(3000);

        // Extract site data
        const results = await page.evaluate(({ limit, searchQuery }: { limit: number; searchQuery: string }) => {
            const sites: any[] = [];

            // Awwwards site cards
            const siteElements = document.querySelectorAll(
                '.list-items figure, ' +
                'a[href*="/sites/"], ' +
                '.site-thumbnail'
            );

            for (let i = 0; i < Math.min(siteElements.length, limit); i++) {
                const element = siteElements[i];

                // Find the link
                const linkElement = element.querySelector('a[href*="/sites/"]') ||
                                  element.closest('a[href*="/sites/"]');
                if (!linkElement) continue;

                const url = (linkElement as HTMLAnchorElement).href;

                // Find the image
                const imgElement = element.querySelector('img');
                let title = '';
                let thumbnailURL = '';

                if (imgElement) {
                    title = imgElement.alt || '';
                    thumbnailURL = imgElement.src || imgElement.getAttribute('data-src') || '';
                }

                // Try to get title from other elements
                if (!title) {
                    const titleElement = element.querySelector('h3, .heading-6');
                    if (titleElement) {
                        title = titleElement.textContent?.trim() || '';
                    }
                }

                // Filter results loosely based on query relevance
                const lowerTitle = title.toLowerCase();
                const lowerQuery = searchQuery.toLowerCase();
                const queryWords = lowerQuery.split(' ');

                // Include if any query word appears in title, or include all if query is generic
                const isRelevant = queryWords.some((word: string) => lowerTitle.includes(word)) ||
                                 lowerQuery.includes('design') ||
                                 lowerQuery.includes('website');

                if (url && isRelevant) {
                    sites.push({
                        url,
                        title: title || `Awwwards Site ${i + 1}`,
                        thumbnailURL,
                        screenshotURL: thumbnailURL
                    });
                }
            }

            return sites;
        }, { limit: limit * 2, searchQuery: query }); // Get more results then filter

        await browser.close();

        // Limit to requested number
        const limitedResults = (results as DesignSearchResult[]).slice(0, limit);

        console.log(`[DesignSearch] Found ${limitedResults.length} Awwwards results`);
        return limitedResults as DesignSearchResult[];

    } catch (error) {
        console.error('Error in searchAwwwards:', error);
        return [];
    }
}

/**
 * Search for design inspiration on Unsplash (replacing problematic Shutterstock)
 */
async function searchUnsplash(
    query: string,
    limit: number = 9
): Promise<DesignSearchResult[]> {
    try {
        const url = `https://unsplash.com/s/photos/${encodeURIComponent(query)}`;
        console.log(`[DesignSearch] Searching Unsplash: ${query}`);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.setExtraHTTPHeaders({
            'User-Agent': USER_AGENT
        });

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait for content to load
        await page.waitForTimeout(3000);

        // Extract image data
        const results = await page.evaluate((limit) => {
            const images: any[] = [];

            // Look for images in figure elements (Unsplash pattern)
            const figureElements = document.querySelectorAll('figure');
            
            for (let i = 0; i < Math.min(figureElements.length, limit); i++) {
                const figure = figureElements[i];
                
                // Find the image within the figure
                const imgElement = figure.querySelector('img');
                const linkElement = figure.closest('a') || figure.querySelector('a');
                
                if (!imgElement) continue;
                
                let thumbnailURL = imgElement.src || '';
                let title = imgElement.alt || '';
                let url = '';
                
                if (linkElement) {
                    url = (linkElement as HTMLAnchorElement).href;
                }
                
                // Skip if no valid image URL or if it's a placeholder
                if (!thumbnailURL || thumbnailURL.includes('data:image')) {
                    continue;
                }
                
                // Create a photo page URL if we don't have one
                if (!url || !url.includes('/photos/')) {
                    // Extract photo ID from thumbnail URL if possible
                    const photoIdMatch = thumbnailURL.match(/photo-([^-?]+)/);
                    if (photoIdMatch) {
                        url = `https://unsplash.com/photos/${photoIdMatch[1]}`;
                    } else {
                        url = `https://unsplash.com/s/photos/${encodeURIComponent(title || 'design')}`;
                    }
                }

                images.push({
                    url,
                    title: title || `Unsplash Photo ${i + 1}`,
                    thumbnailURL,
                    screenshotURL: thumbnailURL
                });
            }

            return images;
        }, limit);

        await browser.close();

        console.log(`[DesignSearch] Found ${results.length} Unsplash results`);
        return results as DesignSearchResult[];

    } catch (error) {
        console.error('Error in searchUnsplash:', error);
        return [];
    }
}

/**
 * Search for design inspiration on Freepik
 */
async function searchFreepik(
    query: string,
    limit: number = 9
): Promise<DesignSearchResult[]> {
    try {
        const url = `https://www.freepik.com/search?format=search&query=${encodeURIComponent(query)}`;
        console.log(`[DesignSearch] Searching Freepik: ${query}`);

        const browser = await chromium.launch({ 
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
        
        const context = await browser.newContext({
            userAgent: USER_AGENT,
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
            extraHTTPHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        
        const page = await context.newPage();
        
        // Remove navigator.webdriver property
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Wait for content to load
        await page.waitForTimeout(5000);

        // Extract image data
        const results = await page.evaluate((limit) => {
            const images: any[] = [];

            // Get all figure elements with links
            const figureLinks = document.querySelectorAll('figure a[href*="/free-"], figure a[href*="/premium-"]');
            const uniqueUrls = new Set<string>();

            for (let i = 0; i < Math.min(figureLinks.length, limit * 2); i++) {
                const linkElement = figureLinks[i] as HTMLAnchorElement;
                const url = linkElement.href;

                // Skip if we've already processed this URL
                if (!url || uniqueUrls.has(url)) continue;
                uniqueUrls.add(url);

                // Find the image within the figure (could be in parent or sibling)
                const figure = linkElement.closest('figure');
                if (!figure) continue;

                // Look for img in various places within the figure
                let imgElement = figure.querySelector('img');
                if (!imgElement) {
                    // Sometimes the image is in a sibling div
                    const imgContainer = figure.querySelector('[data-cy="resource-thumbnail"]');
                    if (imgContainer) {
                        imgElement = imgContainer.querySelector('img');
                    }
                }

                let title = '';
                let thumbnailURL = '';

                if (imgElement) {
                    title = imgElement.alt || imgElement.title || '';
                    thumbnailURL = imgElement.src || '';

                    // Handle lazy loaded images
                    if (!thumbnailURL || thumbnailURL.includes('data:image') || thumbnailURL.includes('placeholder')) {
                        // Try various lazy loading attributes
                        thumbnailURL = imgElement.getAttribute('data-src') || 
                                     imgElement.getAttribute('data-lazy') ||
                                     imgElement.getAttribute('data-original') || '';
                    }
                }

                // If still no image, try style background
                if (!thumbnailURL) {
                    const bgElement = figure.querySelector('[style*="background-image"]');
                    if (bgElement) {
                        const style = bgElement.getAttribute('style') || '';
                        const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
                        if (match) {
                            thumbnailURL = match[1];
                        }
                    }
                }

                // Extract title from link if not from image
                if (!title) {
                    const urlParts = url.split('/');
                    const lastPart = urlParts[urlParts.length - 1];
                    if (lastPart) {
                        title = lastPart.replace(/-/g, ' ').replace(/\.htm.*$/, '').replace(/_/g, ' ');
                    }
                }

                if (url && thumbnailURL && !thumbnailURL.includes('data:image')) {
                    images.push({
                        url,
                        title: title || `Freepik Design ${images.length + 1}`,
                        thumbnailURL,
                        screenshotURL: thumbnailURL
                    });
                    
                    // Stop when we have enough
                    if (images.length >= limit) break;
                }
            }

            return images;
        }, limit);

        await context.close();
        await browser.close();

        console.log(`[DesignSearch] Found ${results.length} Freepik results`);
        return results as DesignSearchResult[];

    } catch (error) {
        console.error('Error in searchFreepik:', error);
        return [];
    }
}

/**
 * Search for design inspiration on Vecteezy
 */
async function searchVecteezy(
    query: string,
    limit: number = 9
): Promise<DesignSearchResult[]> {
    try {
        // Use the correct Vecteezy URL format that actually works
        const url = `https://www.vecteezy.com/free-vector/${encodeURIComponent(query.replace(/ /g, '-'))}`;
        console.log(`[DesignSearch] Searching Vecteezy: ${query}`);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.setExtraHTTPHeaders({
            'User-Agent': USER_AGENT
        });

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait for content to load
        await page.waitForTimeout(3000);

        // Extract image data
        const results = await page.evaluate((limit) => {
            const images: any[] = [];

            // Get all links to specific vector items (not category pages)
            const vectorLinks = document.querySelectorAll('a[href*="/free-vector/"]');
            const uniqueUrls = new Set<string>();

            for (let i = 0; i < Math.min(vectorLinks.length, limit * 3); i++) { // Check more links since we filter
                const linkElement = vectorLinks[i] as HTMLAnchorElement;
                const url = linkElement.href;

                // Skip category pages, navigation, and already processed URLs
                if (!url || uniqueUrls.has(url) || 
                    url.endsWith('/free-vector/logo-design') ||
                    url.match(/\/free-vector\/[^\/]*$/) ||  // Skip category pages
                    linkElement.closest('.explore-nav') ||  // Skip navigation
                    linkElement.closest('.footer')) {      // Skip footer
                    continue;
                }
                
                // Only include specific vector item pages (they have numbers or longer paths)
                const pathParts = url.split('/');
                const lastPart = pathParts[pathParts.length - 1];
                if (!lastPart || lastPart.length < 10) { // Skip short category names
                    continue;
                }
                uniqueUrls.add(url);

                // Find the image within this link
                const imgElement = linkElement.querySelector('img');
                let title = '';
                let thumbnailURL = '';

                if (imgElement) {
                    title = imgElement.alt || imgElement.title || '';
                    thumbnailURL = imgElement.src || '';

                    // Look for higher quality sources
                    const srcset = imgElement.srcset;
                    if (srcset) {
                        // Get higher resolution from srcset
                        const sources = srcset.split(',').map(s => s.trim());
                        for (const source of sources) {
                            if (source.includes('400w') || source.includes('600w')) {
                                thumbnailURL = source.split(' ')[0];
                                break;
                            }
                        }
                    }

                    // Check data attributes for lazy loading
                    if (!thumbnailURL || thumbnailURL.includes('data:image')) {
                        thumbnailURL = imgElement.getAttribute('data-src') || 
                                     imgElement.getAttribute('data-lazy-src') || '';
                    }
                }

                // Skip if no valid image
                if (!thumbnailURL || thumbnailURL.includes('data:image/gif')) {
                    continue;
                }

                // Extract title from URL if not available
                if (!title && url) {
                    const urlParts = url.split('/');
                    const vectorName = urlParts[urlParts.length - 1];
                    title = vectorName.replace(/-/g, ' ').replace(/\d+/g, '').trim();
                }

                if (url && thumbnailURL) {
                    images.push({
                        url,
                        title: title || `Vecteezy Vector ${i + 1}`,
                        thumbnailURL,
                        screenshotURL: thumbnailURL
                    });
                }
            }

            return images;
        }, limit);

        await browser.close();

        console.log(`[DesignSearch] Found ${results.length} Vecteezy results`);
        return results as DesignSearchResult[];

    } catch (error) {
        console.error('Error in searchVecteezy:', error);
        return [];
    }
}

/**
 * Search for images using Brave Images API
 */
async function searchBraveImages(
    query: string,
    limit: number = 9
): Promise<DesignSearchResult[]> {
    try {
        console.log(`[DesignSearch] Searching Brave Images: ${query}`);
        
        // Use the existing web_search with brave-images engine
        const inject_agent_id = `brave-images-${uuidv4()}`;
        const searchResult = await engineWebSearch(inject_agent_id, 'brave-images', query, limit);
        
        // Parse the results (similar to existing parseSearchResults)
        const results = parseSearchResults(searchResult, limit);
        
        console.log(`[DesignSearch] Found ${results.length} Brave Images results`);
        return results;
        
    } catch (error) {
        console.error('Error in searchBraveImages:', error);
        return [];
    }
}

/**
 * Web search that returns raw string results (like magi's implementation)
 *
 * @param inject_agent_id - Agent ID for tracking
 * @param engine - Search engine to use
 * @param query - The search query
 * @param numResults - Number of results to return
 * @returns Raw search results as string
 */
export async function web_search(
    inject_agent_id: string,
    engine: string,
    query: string,
    numResults: number = 9
): Promise<string> {
    // Use the actual web_search implementation from engine
    return await engineWebSearch(inject_agent_id, engine, query, numResults);
}

/**
 * Web search specifically for design inspiration
 * This can be called separately or used within design_search
 *
 * @param query - The search query
 * @param numResults - Number of results to return
 * @param preferredEngine - Optional preferred search engine
 * @returns Array of design search results
 */
export async function web_search_design(
    query: string,
    numResults: number = 9,
    preferredEngine?: string
): Promise<DesignSearchResult[]> {
    const inject_agent_id = `design-search-${uuidv4()}`;
    const searchQuery = `${query} design inspiration`;

    // Determine which engines are available - prioritize anthropic as default
    const availableEngines: string[] = [];
    if (process.env.ANTHROPIC_API_KEY) availableEngines.push('anthropic');
    if (process.env.OPENAI_API_KEY) availableEngines.push('openai');
    if (process.env.GOOGLE_API_KEY) availableEngines.push('google');
    if (process.env.OPENROUTER_API_KEY) availableEngines.push('sonar');
    if (process.env.XAI_API_KEY) availableEngines.push('xai');

    // If no engines available, return empty array
    if (availableEngines.length === 0) {
        console.error('[web_search_design] No search engines configured');
        return [];
    }

    // Build engine list with preferred engine first, defaulting to anthropic
    let engines = [...availableEngines];
    const defaultEngine = preferredEngine || 'anthropic';
    
    if (availableEngines.includes(defaultEngine)) {
        engines = [defaultEngine, ...availableEngines.filter(e => e !== defaultEngine)];
    }

    let searchResult = '';
    let successfulEngine = '';

    // Try each engine until one succeeds
    for (const engine of engines) {
        try {
            console.log(`[web_search_design] Trying ${engine} for: ${query}`);
            searchResult = await web_search(inject_agent_id, engine, searchQuery, numResults);

            if (!searchResult.startsWith('Error:')) {
                successfulEngine = engine;
                console.log(`[web_search_design] Success with ${engine}`);
                break;
            } else {
                console.log(`[web_search_design] ${engine} failed: ${searchResult}`);
            }
        } catch (error) {
            console.error(`[web_search_design] Error with ${engine}:`, error);
        }
    }

    // If all engines failed, return empty array
    if (!successfulEngine || searchResult.startsWith('Error:')) {
        console.error('[web_search_design] All search engines failed');
        return [];
    }

    // Parse search results into DesignSearchResult format
    const results = parseSearchResults(searchResult, numResults);
    console.log(`[web_search_design] Found ${results.length} results via ${successfulEngine}`);
    return results;
}

/**
 * Parse search results from LLM response
 */
function parseSearchResults(searchResult: string, limit: number): DesignSearchResult[] {
    const results: DesignSearchResult[] = [];

    try {
        // Try to extract URLs and titles from the response
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
        const urls = searchResult.match(urlRegex) || [];

        // Split by common separators and extract structured data
        const lines = searchResult.split(/[\n\r]+/);
        let currentResult: Partial<DesignSearchResult> | null = null;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check if line contains a URL
            const urlMatch = trimmedLine.match(urlRegex);
            if (urlMatch && urlMatch[0]) {
                if (currentResult && currentResult.url) {
                    results.push(currentResult as DesignSearchResult);
                }
                currentResult = {
                    url: urlMatch[0],
                    title: trimmedLine.replace(urlMatch[0], '').trim() || `Design Example ${results.length + 1}`
                };
            } else if (currentResult && trimmedLine) {
                // Add as title if we have a current result without title
                if (!currentResult.title || currentResult.title.startsWith('Design Example')) {
                    currentResult.title = trimmedLine;
                }
            }
        }

        // Add the last result
        if (currentResult && currentResult.url) {
            results.push(currentResult as DesignSearchResult);
        }

        // If no structured results found, create from raw URLs
        if (results.length === 0 && urls.length > 0) {
            for (let i = 0; i < Math.min(urls.length, limit); i++) {
                results.push({
                    url: urls[i],
                    title: `Design Inspiration ${i + 1}`,
                });
            }
        }

    } catch (error) {
        console.error('[DesignSearch] Error parsing search results:', error);
    }

    return results.slice(0, limit);
}


/**
 * Main function to search for design inspiration
 */
export async function design_search(
    engine: DesignSearchEngine,
    query: string,
    limit: number = 9
): Promise<string> {
    // Select the appropriate search function based on the engine
    let results: DesignSearchResult[];

    switch (engine) {
        case 'dribbble':
            results = await searchDribbble(query, limit);
            break;
        case 'behance':
            results = await searchBehance(query, limit);
            break;
        case 'envato':
            results = await searchEnvato(query, limit);
            break;
        case 'pinterest':
            results = await searchPinterest(query, limit);
            break;
        case 'awwwards':
            results = await searchAwwwards(query, limit);
            break;
        case 'unsplash':
            results = await searchUnsplash(query, limit);
            break;
        case 'freepik':
            results = await searchFreepik(query, limit);
            break;
        case 'vecteezy':
            results = await searchVecteezy(query, limit);
            break;
        case 'brave_images':
            results = await searchBraveImages(query, limit);
            break;
        case 'web_search':
        default:
            // Use web_search_design which handles engine selection and fallback
            results = await web_search_design(query, limit);
            break;
    }

    // Limit results
    results = results.slice(0, limit);

    // Take screenshots for results that don't have image URLs
    const screenshotPromises = results.map(async result => {
        // If we already have a screenshot URL from the site, use that
        if (result.screenshotURL) {
            return result;
        }

        // If we have a thumbnailURL but no screenshotURL, use thumbnailURL as screenshotURL
        if (result.thumbnailURL && !result.screenshotURL) {
            result.screenshotURL = result.thumbnailURL;
            return result;
        }

        // If we don't have any image URLs, take a screenshot (placeholder)
        if (!result.screenshotURL) {
            const screenshotPath = await takeScreenshot(
                result.url,
                result.title
            );
            if (screenshotPath) {
                result.screenshotURL = screenshotPath;
            }
        }
        return result;
    });

    results = await Promise.all(screenshotPromises);
    
    // Filter out results that have no valid images
    const validResults = results.filter(result => 
        result.screenshotURL || result.thumbnailURL
    );
    
    console.log(`[design_search] Returning ${validResults.length} valid results (filtered from ${results.length})`);

    return JSON.stringify(validResults, null, 2);
}

/**
 * Image source types for the createNumberedGrid function
 */
export interface ImageSource {
    url?: string; // URL or file path to the image
    dataUrl?: string; // Data URL of the image
    title?: string; // Optional title for the image
}

/**
 * Create a numbered grid image from a list of image sources
 * Returns a base64 PNG data URL
 */
export async function createNumberedGrid(
    images: ImageSource[],
    gridName: string = 'grid',
    aspect: DesignAssetAspect = 'square',
    category: 'inspiration' | 'draft' | 'medium' | 'final' = 'inspiration'
): Promise<string> {
    // Filter out images with no valid URL, empty URLs, or duplicate URLs
    const seenUrls = new Set<string>();
    const validImages = images.filter(img => {
        if (!img.url || img.url.trim() === '') return false;
        
        // Skip if we've already seen this URL
        const normalizedUrl = img.url.trim();
        if (seenUrls.has(normalizedUrl)) {
            console.log(`[Grid] Skipping duplicate URL: ${normalizedUrl}`);
            return false;
        }
        seenUrls.add(normalizedUrl);
        return true;
    });
    
    if (validImages.length === 0) {
        throw new Error('No valid images to create grid from');
    }
    
    const registry = getImageRegistry();
    
    // Register images and get their IDs
    const imageIds: number[] = [];
    for (const img of validImages) {
        if (img.url) {
            // Screenshots and web images are both references for inspiration
            const isReference = img.url.startsWith('http://') || img.url.startsWith('https://') || 
                               (img.url.includes('/screenshots/') && category === 'inspiration');
            try {
                const id = await registry.registerImage(
                    img.url,
                    isReference ? 'reference' : 'generated',
                    category,
                    img.title
                );
                imageIds.push(id);
            } catch (error) {
                console.warn(`[Grid] Failed to register image ${img.url}:`, error);
                // Fallback to sync registration (but only for non-reference images)
                if (!isReference) {
                    const id = registry.registerImageSync(
                        img.url,
                        'generated',
                        category,
                        img.title
                    );
                    imageIds.push(id);
                } else {
                    // Skip this image if we can't register it
                    console.error(`[Grid] Skipping reference image that failed to register: ${img.url}`);
                }
            }
        }
    }
    
    // Check if we already have a cached grid for these images
    const cachedGridPath = registry.getCachedGrid(imageIds, gridName);
    if (cachedGridPath) {
        console.log(`[Grid] Using cached grid: ${cachedGridPath}`);
        return cachedGridPath;
    }
    
    // Always save grids to DESIGN_OUTPUT_DIR/grids
    const baseDir = getOutputDir();
    const gridDir = path.join(baseDir, 'grids');
    console.log(`[Grid] Creating grid from ${validImages.length} images with IDs [${imageIds.join(', ')}]`);
    if (!fs.existsSync(gridDir)) {
        fs.mkdirSync(gridDir, { recursive: true });
    }

    const BASE_CELL = 256;
    let cellWidth = BASE_CELL;
    let cellHeight = BASE_CELL;

    // Adjust cell dimensions based on aspect ratio
    if (aspect === 'landscape') {
        cellWidth = Math.round(BASE_CELL * 1.5); // 1.5x wider for landscape
    } else if (aspect === 'portrait') {
        cellHeight = Math.round(BASE_CELL * 1.5); // 1.5x taller for portrait
    }

    const cols = 3;
    const rows = Math.ceil(validImages.length / cols);
    const canvas = createCanvas(cols * cellWidth, rows * cellHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set highest quality rendering options for sharper image scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Track successfully loaded images and their IDs
    const loadedImages: { img: any; id: number; index: number }[] = [];
    
    for (let i = 0; i < validImages.length; i++) {
        try {
            // Load image based on available sources
            let img;
            const imageSource = validImages[i];
            const imageId = imageIds[i];

            if (imageSource.dataUrl) {
                // Directly load from data URL if available
                img = await loadImage(imageSource.dataUrl);
            } else if (imageSource.url) {
                // Get the corresponding image from registry to check for local path
                const registeredImage = registry.getImage(imageId);
                const imagePath = registeredImage?.path || imageSource.url;
                
                // Load from URL or file path
                if (imageSource.url.startsWith('data:image')) {
                    img = await loadImage(imageSource.url);
                } else if (imagePath.startsWith('/') && fs.existsSync(imagePath)) {
                    // Use local file if available
                    // Check file size to avoid empty files
                    const stats = fs.statSync(imagePath);
                    if (stats.size === 0) {
                        console.log(`[Grid] Skipping empty file: ${path.basename(imagePath)}`);
                        continue;
                    }
                    img = await loadImage(imagePath);
                    console.log(`[Grid] Using local file: ${path.basename(imagePath)}`);
                } else if (imageSource.url.startsWith('/') && fs.existsSync(imageSource.url)) {
                    // Fallback to original path
                    const stats = fs.statSync(imageSource.url);
                    if (stats.size === 0) {
                        console.log(`[Grid] Skipping empty file: ${imageSource.url}`);
                        continue;
                    }
                    img = await loadImage(imageSource.url);
                } else {
                    // For HTTP URLs, fetch the image
                    try {
                        if (imageSource.url.startsWith('http://') || imageSource.url.startsWith('https://')) {
                            const response = await fetch(imageSource.url);
                            if (response.ok) {
                                const arrayBuffer = await response.arrayBuffer();
                                if (arrayBuffer.byteLength === 0) {
                                    console.log(`[Grid] Skipping empty response from: ${imageSource.url}`);
                                    continue;
                                }
                                const buffer = Buffer.from(arrayBuffer);
                                img = await loadImage(buffer);
                            } else {
                                console.log(`[Grid] Failed to fetch image (${response.status}): ${imageSource.url}`);
                                continue;
                            }
                        } else {
                            console.log(`[Grid] Unknown URL scheme: ${imageSource.url}`);
                            continue;
                        }
                    } catch (fetchError) {
                        console.error(`[Grid] Failed to fetch image from ${imageSource.url}:`, fetchError);
                        continue;
                    }
                }
            }

            if (!img) {
                console.log(`[Grid] Failed to create image object for index ${i}`);
                continue;
            }

            // Validate image dimensions
            if (!img.width || !img.height || img.width === 0 || img.height === 0) {
                console.log(`[Grid] Invalid image dimensions (${img.width}x${img.height}) for index ${i}`);
                continue;
            }

            // Add to loaded images
            loadedImages.push({ img, id: imageId, index: i });
        } catch (e) {
            console.error(`[Grid] Error loading image at index ${i}:`, e);
            continue;
        }
    }

    // Check if we have any successfully loaded images
    if (loadedImages.length === 0) {
        throw new Error('No images could be loaded successfully');
    }

    console.log(`[Grid] Successfully loaded ${loadedImages.length} out of ${validImages.length} images`);

    // Recalculate grid dimensions based on actual loaded images
    const actualRows = Math.ceil(loadedImages.length / cols);
    const actualCanvas = createCanvas(cols * cellWidth, actualRows * cellHeight);
    const actualCtx = actualCanvas.getContext('2d');

    actualCtx.fillStyle = '#fff';
    actualCtx.fillRect(0, 0, actualCanvas.width, actualCanvas.height);

    // Set highest quality rendering options
    actualCtx.imageSmoothingEnabled = true;
    actualCtx.imageSmoothingQuality = 'high';

    // Draw the successfully loaded images
    for (let i = 0; i < loadedImages.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const { img, id } = loadedImages[i];

        try {
            // Calculate scaled dimensions while maintaining aspect ratio
            const aspectRatio = img.width / img.height;
            const scaledWidth = cellWidth;
            let scaledHeight = scaledWidth / aspectRatio;

            // If height > cellHeight, truncate from top-down
            // If height < cellHeight, vertically center
            const destX = col * cellWidth;
            let destY = row * cellHeight;

            if (scaledHeight > cellHeight) {
                // Truncate height to cellHeight (from the top down)
                scaledHeight = cellHeight;
            } else if (scaledHeight < cellHeight) {
                // Vertically center the image in the cell
                destY = row * cellHeight + (cellHeight - scaledHeight) / 2;
            }

            // Draw the image
            actualCtx.drawImage(img, destX, destY, scaledWidth, scaledHeight);

            // Draw the unique ID label
            const labelText = String(id);
            const labelWidth = Math.max(40, labelText.length * 12 + 16); // Dynamic width based on ID length
            
            actualCtx.fillStyle = 'rgba(0,0,0,0.7)';
            actualCtx.fillRect(col * cellWidth, row * cellHeight, labelWidth, 28);
            actualCtx.fillStyle = '#fff';
            actualCtx.font = 'bold 18px sans-serif';
            actualCtx.fillText(`#${labelText}`, col * cellWidth + 8, row * cellHeight + 20);
        } catch (e) {
            console.error(`[Grid] Error drawing image ${id}:`, e);
            // Draw placeholder
            actualCtx.fillStyle = '#eee';
            actualCtx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
        }
    }

    const out = actualCanvas.toBuffer('image/png');

    // Save grid image to disk
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueId = uuidv4().substring(0, 8);
    
    // Always use gridName as the base filename
    const filename = `${gridName}_${timestamp}_${uniqueId}.png`;
    const filePath = path.join(gridDir, filename);

    fs.writeFileSync(filePath, out);
    console.log(`[${gridName}] Saved grid image to:`, filePath);
    
    // Cache the generated grid with only the successfully loaded image IDs
    const loadedImageIds = loadedImages.map(item => item.id);
    registry.cacheGrid(filePath, loadedImageIds, gridName);

    communicationManager.send({
        type: 'createNumberedGrid',
        timestamp: new Date().toISOString(),
        input: {
            images: validImages.length,
            loaded: loadedImages.length,
            gridName,
            aspect,
        },
        output: {
            filePath,
            cols,
            rows: actualRows,
            imageIds: loadedImageIds,
        },
    });

    return filePath;
}

/**
 * Select the best items from a grid using a vision model
 * Returns grid positions (1-based) of selected images
 */
export async function selectBestFromGrid(
    gridDataUrl: string,
    context: string,
    count: number,
    limit: number,
    isDesignSearch: boolean = true,
    type?: DESIGN_ASSET_TYPES,
    judge_guide?: string,
    imageIds?: number[]
): Promise<number[]> {
    // Validate inputs
    if (count <= 0) {
        console.warn('[selectBestFromGrid] Invalid count:', count);
        return [];
    }
    
    // Ensure limit doesn't exceed count
    const actualLimit = Math.min(limit, count);
    
    const cols = 3;
    const rows = Math.ceil(count / cols);

    // Determine appropriate message based on whether this is for design search or image generation
    let content: string;
    if (type) {
        const readableType = type.replace(/_/g, ' ');
        const reference = DESIGN_ASSET_REFERENCE[type];
        const readableName = reference.name.toLowerCase();

        if (isDesignSearch) {
            content = `We are looking for inspiration/reference images for a ${readableName}. We have ${count} images that we want to rank. When you rank the images, you should first choose only the relevant images. Once you have selected the relevant images, rank them by how aesthetically pleasing they are.`;
        } else {
            content = `We are designing a new ${readableName}. I've generated ${count} different versions of a ${readableType} and would like you to rank them for me. Please evaluate them and select the best version(s).`;
        }
    } else {
        if (isDesignSearch) {
            content = `We are trying to create a design and are searching the web for design inspiration. We have ${count} images that we want to rank. When you rank the images, you should first choose only the relevant images. Once you have selected the relevant images, rank them by how aesthetically pleasing they are.`;
        } else {
            content = `I've generated ${count} different designs. Please evaluate them and select the best version(s). Consider overall aesthetics, composition, and how well they match the prompt.`;
        }
    }

    if (context) {
        content += `\n\n${context}`;
    }
    if (judge_guide) {
        content += `\n\n${judge_guide}`;
    }

    content += `\n\nPlease select the best ${actualLimit} images from the grid below. You MUST respond with valid JSON in the exact format specified in the schema. Do not include any other text or explanation outside the JSON.`;

    const messages: ResponseInput = [
        {
            type: 'message',
            role: 'developer',
            content: content,
        },
        {
            type: 'message',
            role: 'user',
            content: gridDataUrl,
        },
    ];

    const imageSelectorAgent = new Agent({
        name: 'ImageSelector',
        modelClass: 'vision_mini',
        instructions: 'You are a design assistant. Your job is to select the best images from a grid of images.',
        modelSettings: {
            json_schema: {
                name: 'image_selection',
                type: 'json_schema',
                schema: {
                    type: 'object',
                    properties: {
                        best_images: {
                            type: 'array',
                            description: `Select the best ${limit} images from the grid.`,
                            items: {
                                type: 'object',
                                properties: {
                                    number: {
                                        type: 'number',
                                        description: `The image's number in the grid (1-${count})`,
                                    },
                                    reason: {
                                        type: 'string',
                                        description:
                                            'What qualities make this image the best?',
                                    },
                                },
                                additionalProperties: false,
                                required: ['number', 'reason'],
                            },
                        },
                    },
                    additionalProperties: false,
                    required: ['best_images'],
                },
            },
        },
    });
    
    const response = await quick_llm_call(messages, imageSelectorAgent);

    console.log('[selectBestFromGrid] LLM response:', response);

    try {
        // Handle cases where LLM returns text before the JSON
        let jsonStr = response.trim();
        
        // Try to find the JSON object in the response
        const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            // JSON is in a code block
            jsonStr = jsonMatch[1];
        } else {
            // Try to find the first complete JSON object
            const firstBrace = jsonStr.indexOf('{');
            if (firstBrace > 0) {
                jsonStr = jsonStr.substring(firstBrace);
            }
            
            // Find the matching closing brace
            let braceCount = 0;
            let jsonEndIndex = -1;
            
            for (let i = 0; i < jsonStr.length; i++) {
                if (jsonStr[i] === '{') braceCount++;
                else if (jsonStr[i] === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        jsonEndIndex = i + 1;
                        break;
                    }
                }
            }
            
            if (jsonEndIndex > 0) {
                jsonStr = jsonStr.substring(0, jsonEndIndex);
            }
        }
        
        const results = JSON.parse(jsonStr);
        let selectedImages: number[] = [];
        

        // Handle different response formats
        if (results.best_images && Array.isArray(results.best_images)) {
            // Expected format: { best_images: [{number: 1, reason: "..."}, ...] }
            selectedImages = results.best_images.map((img: any) => 
                typeof img.number === 'string' ? parseInt(img.number) : img.number
            );
        } else if (results.rankings && Array.isArray(results.rankings)) {
            // Alternative format: { rankings: [{image_number: 1, ...}, ...] }
            selectedImages = results.rankings.map((r: any) => r.image_number || r.rank);
        } else if (results.ranking && Array.isArray(results.ranking)) {
            // Another format: { ranking: [1, 2, 3] }
            selectedImages = results.ranking;
        } else if (results.bestImages && Array.isArray(results.bestImages)) {
            // Another format: { bestImages: [1, 2, 3] }
            selectedImages = results.bestImages;
        } else if (Array.isArray(results)) {
            // Simple array format: [1, 2, 3]
            selectedImages = results;
        }

        // Filter out invalid numbers
        selectedImages = selectedImages.filter(n =>
            typeof n === 'number' && n >= 1 && n <= count
        );

        if (selectedImages.length > 0) {
            console.log(`[selectBestFromGrid] Selected images: ${JSON.stringify(selectedImages)}`);
            
            // If we have imageIds, also log the unique IDs of selected images
            if (imageIds && imageIds.length > 0) {
                const selectedUniqueIds = selectedImages.map(gridPos => imageIds[gridPos - 1]).filter(id => id !== undefined);
                console.log(`[selectBestFromGrid] Selected unique IDs: [${selectedUniqueIds.join(', ')}]`);
            }
            
            communicationManager.send({
                type: 'selectBestFromGrid',
                timestamp: new Date().toISOString(),
                input: {
                    gridDataUrl,
                    context,
                    count,
                    limit,
                    isDesignSearch,
                    type,
                    judge_guide
                },
                output: {
                    selectedImages,
                    selectedUniqueIds: imageIds ? selectedImages.map(gridPos => imageIds[gridPos - 1]) : undefined,
                },
            });

            return selectedImages;
        }
    } catch (error) {
        console.error('[selectBestFromGrid] Error parsing LLM response:', error);

        // Try to extract numbers from plain text response
        const numberMatches = response.match(/\b\d+\b/g);
        if (numberMatches) {
            const selectedImages = numberMatches
                .map((n: string) => parseInt(n))
                .filter((n: number) => n >= 1 && n <= count)
                .slice(0, limit);

            if (selectedImages.length > 0) {
                console.log(`[selectBestFromGrid] Extracted images from text: ${selectedImages}`);
                return selectedImages;
            }
        }
    }

    console.error('[selectBestFromGrid] No valid images selected');
    return [];
}

/**
 * Generates a unique identifier for a design to prevent duplicate processing
 */
export function getDesignId(design: DesignSearchResult): string {
    return design.url || design.screenshotURL || JSON.stringify(design);
}

/**
 * Improved design search with per-engine selection
 * Forces 9 images per engine and runs parallel grid analysis
 */
export async function smart_design_improved(
    context: string,
    searchConfigs: {
        engine: DesignSearchEngine;
        query: string;
    }[],
    finalLimit: number = 9,
    type: DESIGN_ASSET_TYPES,
    judge_guide?: string
): Promise<DesignSearchResult[]> {
    console.log(`[smart_design_improved] Running ${searchConfigs.length} search engines with forced 9 images each`);

    const background = `We are designing a ${type} and looking for high-quality reference images for inspiration\n\n${context}`;

    // Force 9 images from each engine
    const searchPromises = searchConfigs.map(async (config) => {
        try {
            console.log(`[smart_design_improved] Searching ${config.engine} for: ${config.query}`);
            const result = await design_search(
                config.engine,
                config.query,
                9  // Always get 9 from each engine
            );
            const designs = JSON.parse(result) as DesignSearchResult[];
            console.log(`[smart_design_improved] ${config.engine} returned ${designs.length} results`);
            return { engine: config.engine, designs };
        } catch (error) {
            console.error(`[smart_design_improved] Error searching ${config.engine}:`, error);
            return { engine: config.engine, designs: [] };
        }
    });

    // Wait for all searches to complete
    const engineResults = await Promise.all(searchPromises);

    // Process each engine's results in parallel with grid selection
    const engineSelectionPromises = engineResults.map(async ({ engine, designs }) => {
        const validDesigns = designs.filter(d => d.screenshotURL || d.thumbnailURL);
        
        if (validDesigns.length === 0) {
            console.log(`[smart_design_improved] No valid designs from ${engine}`);
            return [];
        }

        console.log(`[smart_design_improved] Creating grid for ${engine} with ${validDesigns.length} designs`);

        // Create grid for this engine's results
        const gridName = `${engine}_selection`;
        const imageSources = validDesigns.map(design => ({
            url: design.screenshotURL || design.thumbnailURL,
            title: design.title
        }));

        try {
            const gridDataUrl = await createNumberedGrid(
                imageSources,
                gridName,
                type ? DESIGN_ASSET_REFERENCE[type].spec.aspect : 'square'
            );

            // Select best 3-4 from each engine
            const selectCount = Math.min(4, validDesigns.length);
            const selectedIndices = await selectBestFromGrid(
                gridDataUrl,
                `${background}\n\nThese are ${engine} search results. Select the ${selectCount} highest quality, most relevant designs.`,
                validDesigns.length,
                selectCount,
                true,
                type,
                judge_guide || "Select designs with exceptional quality, clear visual communication, and strong relevance to the design brief. Avoid low-quality, generic, or poorly executed designs."
            );

            // Map selected indices to designs
            const selectedDesigns: DesignSearchResult[] = [];
            for (const idx of selectedIndices) {
                if (idx >= 1 && idx <= validDesigns.length) {
                    selectedDesigns.push(validDesigns[idx - 1]);
                }
            }

            console.log(`[smart_design_improved] Selected ${selectedDesigns.length} from ${engine}`);
            return selectedDesigns;
        } catch (error) {
            console.error(`[smart_design_improved] Error processing ${engine} grid:`, error);
            return [];
        }
    });

    // Wait for all engine selections
    const engineSelections = await Promise.all(engineSelectionPromises);
    const allSelectedDesigns = engineSelections.flat();

    // Remove duplicates based on URL
    const uniqueDesigns = new Map<string, DesignSearchResult>();
    for (const design of allSelectedDesigns) {
        const key = design.screenshotURL || design.thumbnailURL || design.url;
        if (key && !uniqueDesigns.has(key)) {
            uniqueDesigns.set(key, design);
        }
    }
    const dedupedDesigns = Array.from(uniqueDesigns.values());

    console.log(`[smart_design_improved] Total designs after per-engine selection: ${allSelectedDesigns.length} → ${dedupedDesigns.length} after deduplication`);

    // If we already have 9 or fewer, return them
    if (dedupedDesigns.length <= finalLimit) {
        return dedupedDesigns;
    }

    // Otherwise, do a final round to select the best 9
    console.log(`[smart_design_improved] Running final selection round to reduce to ${finalLimit} designs`);

    const finalGridName = 'final_selection';
    // Use deduplicated designs for final selection
    const finalImageSources = dedupedDesigns.map(design => ({
        url: design.screenshotURL || design.thumbnailURL,
        title: design.title
    }));

    const finalGridDataUrl = await createNumberedGrid(
        finalImageSources,
        finalGridName,
        type ? DESIGN_ASSET_REFERENCE[type].spec.aspect : 'square'
    );

    const finalSelectedIndices = await selectBestFromGrid(
        finalGridDataUrl,
        `${background}\n\nFinal selection: Choose the ${finalLimit} absolute best designs from all search engines combined.`,
        dedupedDesigns.length,
        finalLimit,
        true,
        type,
        judge_guide || "Select only the highest quality designs that will serve as excellent inspiration for the final design. Quality is more important than variety."
    );

    // Map final selection using deduplicated designs
    const finalDesigns: DesignSearchResult[] = [];
    const selectedUrls = new Set<string>(); // Additional check to prevent duplicates
    
    for (const idx of finalSelectedIndices) {
        if (idx >= 1 && idx <= dedupedDesigns.length) {
            const design = dedupedDesigns[idx - 1];
            const key = design.screenshotURL || design.thumbnailURL || design.url;
            if (key && !selectedUrls.has(key)) {
                finalDesigns.push(design);
                selectedUrls.add(key);
            }
        }
    }

    console.log(`[smart_design_improved] Final selection: ${finalDesigns.length} unique designs`);
    return finalDesigns;
}

/**
 * Raw design search configurations with iterative vision-based ranking
 * Accepts an array of search configurations to run in parallel
 */
export async function smart_design_raw(
    context: string,
    searchConfigs: {
        engine: DesignSearchEngine;
        query: string;
        limit?: number;
    }[],
    finalLimit: number = 3,
    type: DESIGN_ASSET_TYPES,
    judge_guide?: string,
    prefix: string = 'smart'
): Promise<DesignSearchResult[]> {
    console.log(`[smart_design_raw] Running ${searchConfigs.length} search configs`);

    const background = `We are designing a ${type} and looking for reference images for inspiration\n\n${context}`;

    // Run all searches in parallel
    const searchPromises = searchConfigs.map(async (config) => {
        try {
            // Only pass the actual query to design_search, not the full background
            const result = await design_search(
                config.engine,
                config.query,
                config.limit || 9
            );
            return JSON.parse(result) as DesignSearchResult[];
        } catch (error) {
            console.error(`[smart_design_raw] Error searching ${config.engine}:`, error);
            return [];
        }
    });

    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);

    // Flatten all results into a single array and filter out designs with no images
    const allDesigns = searchResults.flat().filter(design => 
        design.screenshotURL || design.thumbnailURL
    );
    console.log(`[smart_design_raw] Found ${allDesigns.length} total designs with valid images`);

    if (allDesigns.length === 0) {
        return [];
    }

    // If we have fewer results than requested, just return them all
    if (allDesigns.length <= finalLimit) {
        return allDesigns;
    }

    // Use iterative vision-based selection to narrow down to the best designs
    let currentCandidates = [...allDesigns];
    let round = 1;

    // Keep selecting best designs until we reach the target count
    while (currentCandidates.length > finalLimit && round <= 3) {
        console.log(`[smart_design_raw] Selection round ${round}: ${currentCandidates.length} candidates`);

        // Create groups of up to 9 for grid evaluation
        const groups: DesignSearchResult[][] = [];
        for (let i = 0; i < currentCandidates.length; i += 9) {
            groups.push(currentCandidates.slice(i, i + 9));
        }

        const roundWinners: DesignSearchResult[] = [];
        // Use processedIds within each round to prevent duplicates within groups
        const processedIds = new Set<string>();

        // Process each group
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            // Simple grid name - directory is handled by createNumberedGrid
            const gridName = `${prefix}_round${round}_group${i + 1}`;

            // Create grid from group
            const imageSources = group.map(design => ({
                url: design.screenshotURL || design.thumbnailURL,
                title: design.title
            }));

            const gridDataUrl = await createNumberedGrid(
                imageSources,
                gridName,
                type ? DESIGN_ASSET_REFERENCE[type].spec.aspect : 'square'
            );

            // Select best from this group
            const selectCount = Math.min(
                Math.ceil(group.length * 0.5), // Select top 50%
                Math.ceil(finalLimit / groups.length) + 1 // But at least enough to reach final count
            );

            const selectedIndices = await selectBestFromGrid(
                gridDataUrl,
                background,
                group.length,
                selectCount,
                true, // isDesignSearch
                type,
                judge_guide
            );

            // Add selected designs to round winners
            for (const idx of selectedIndices) {
                if (idx >= 1 && idx <= group.length) {
                    const selected = group[idx - 1];
                    const id = getDesignId(selected);
                    if (!processedIds.has(id)) {
                        roundWinners.push(selected);
                        processedIds.add(id);
                    }
                }
            }
        }

        currentCandidates = roundWinners;
        round++;

        console.log(`[smart_design_raw] Round ${round - 1} complete: ${currentCandidates.length} designs selected`);
    }

    // Return the final selection, limited to requested count
    return currentCandidates.slice(0, finalLimit);
}