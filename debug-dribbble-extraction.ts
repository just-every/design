/**
 * Debug script to test Dribbble data extraction
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const USER_AGENT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; design-tool/1.0)';

async function debugDribbbleExtraction() {
    const query = "Futuristic AI logo designs";
    const url = `https://dribbble.com/search/${encodeURIComponent(query)}`;
    
    console.log('=== DRIBBBLE EXTRACTION DEBUG ===');
    console.log(`URL: ${url}`);
    console.log('');

    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true // Run headless this time
        });
        
        const page = await browser.newPage();
        
        // Set user agent
        await page.setExtraHTTPHeaders({
            'User-Agent': USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9'
        });

        console.log('Navigating to Dribbble...');
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        console.log('Page loaded, waiting for content...');
        await page.waitForTimeout(3000);

        // Scroll to load more
        await page.evaluate(() => {
            window.scrollTo(0, window.innerHeight);
        });
        await page.waitForTimeout(2000);

        // Extract shot data with better selectors
        const results = await page.evaluate((limit) => {
            const shots: any[] = [];
            
            // Get all shot cards - they're in list items
            const shotCards = document.querySelectorAll('ol > li');
            console.log(`Found ${shotCards.length} shot cards`);
            
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
        }, 20); // Get up to 20 results

        console.log(`\n=== EXTRACTED ${results.length} RESULTS ===`);
        
        // Save results
        const outputDir = path.join(process.cwd(), '.output', 'debug-dribbble');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const resultsPath = path.join(outputDir, 'extracted_results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
        console.log(`Results saved to: ${resultsPath}`);
        
        // Display results
        results.forEach((result, index) => {
            console.log(`\n--- Result ${index + 1} ---`);
            console.log(`Title: ${result.title}`);
            console.log(`URL: ${result.url}`);
            console.log(`Thumbnail: ${result.thumbnailURL}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

debugDribbbleExtraction().catch(console.error);