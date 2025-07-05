import { chromium } from 'playwright';

async function debugDribbble() {
    console.log('🔍 Debugging Dribbble page structure...');

    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        const query = "logo design";
        const url = `https://dribbble.com/search/${encodeURIComponent(query)}`;
        console.log(`Navigating to: ${url}`);
        
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        await page.waitForTimeout(5000);
        
        const title = await page.title();
        const currentUrl = page.url();
        console.log(`Page title: ${title}`);
        console.log(`Current URL: ${currentUrl}`);
        
        const containerInfo = await page.evaluate(() => {
            const info: any = {};
            
            const selectors = [
                'ol > li',
                '[data-testid="shot"]', 
                '.shot-thumbnail',
                '.js-shot',
                'article',
                '[class*="shot"]',
                'li[data-testid]',
                'div[data-id]'
            ];
            
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                info[selector] = elements.length;
            }
            
            info.bodyClasses = document.body.className;
            info.hasContent = document.body.innerText.length > 1000;
            
            return info;
        });
        
        console.log('Container analysis:', containerInfo);
        
        // Let's check the actual structure of the first few items
        const sampleStructure = await page.evaluate(() => {
            const items = document.querySelectorAll('ol > li');
            if (items.length > 0) {
                const firstItem = items[0];
                return {
                    hasLinkWithShots: !!firstItem.querySelector('a[href*="/shots/"]'),
                    hasLinkElement: !!firstItem.querySelector('a'),
                    hasPicture: !!firstItem.querySelector('picture'),
                    hasImg: !!firstItem.querySelector('img'),
                    linkHref: firstItem.querySelector('a')?.getAttribute('href'),
                    imgSrc: firstItem.querySelector('img')?.getAttribute('src'),
                    className: firstItem.className
                };
            }
            return null;
        });
        
        console.log('Sample structure:', sampleStructure);
        
        // Simulate the actual Dribbble search logic
        const simulatedResults = await page.evaluate((limit) => {
            const shots: any[] = [];
            
            const shotCards = document.querySelectorAll('ol > li');
            console.log(`Found ${shotCards.length} shot cards`);
            
            for (let i = 0; i < Math.min(shotCards.length, 3); i++) { // Only process first 3 for debugging
                const card = shotCards[i];
                
                // Find the main link
                const linkElement = card.querySelector('a[href*="/shots/"]');
                console.log(`Card ${i}: linkElement found:`, !!linkElement);
                if (!linkElement) continue;
                
                const shotUrl = (linkElement as HTMLAnchorElement).href;
                console.log(`Card ${i}: shotUrl:`, shotUrl);
                
                // Skip navigation links
                if (shotUrl.includes('/popular') || shotUrl.includes('/recent') || shotUrl.includes('/following')) {
                    console.log(`Card ${i}: Skipping navigation link`);
                    continue;
                }
                
                // Find the image
                let thumbnailURL = '';
                let title = '';
                
                // Try picture element first
                const pictureElement = card.querySelector('picture');
                console.log(`Card ${i}: pictureElement found:`, !!pictureElement);
                
                if (pictureElement) {
                    const sourceElement = pictureElement.querySelector('source');
                    if (sourceElement) {
                        thumbnailURL = sourceElement.srcset || sourceElement.getAttribute('data-srcset') || '';
                        if (thumbnailURL.includes(',')) {
                            thumbnailURL = thumbnailURL.split(',')[0].trim().split(' ')[0];
                        }
                    }
                    
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
                    console.log(`Card ${i}: imgElement found:`, !!imgElement);
                    if (imgElement) {
                        thumbnailURL = imgElement.src || imgElement.getAttribute('data-src') || '';
                        title = imgElement.alt || '';
                        console.log(`Card ${i}: thumbnailURL:`, thumbnailURL);
                        console.log(`Card ${i}: title:`, title);
                    }
                }
                
                // Clean up thumbnail URL
                if (thumbnailURL.startsWith('//')) {
                    thumbnailURL = 'https:' + thumbnailURL;
                }
                
                // Skip placeholder images
                if (thumbnailURL.includes('data:image/gif;base64')) {
                    console.log(`Card ${i}: Skipping placeholder image`);
                    continue;
                }
                
                console.log(`Card ${i}: Final check - shotUrl:`, !!shotUrl, 'thumbnailURL:', !!thumbnailURL);
                if (shotUrl && thumbnailURL) {
                    shots.push({
                        url: shotUrl,
                        title: title || `Design ${i + 1}`,
                        thumbnailURL: thumbnailURL,
                        screenshotURL: thumbnailURL
                    });
                    console.log(`Card ${i}: Added to results`);
                } else {
                    console.log(`Card ${i}: Failed final check`);
                }
            }
            
            console.log(`Total shots found: ${shots.length}`);
            return shots;
        }, 9);
        
        console.log('Simulated Dribbble results:', simulatedResults.length, 'shots');
        
        const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
        
        if (bodyText.includes('sign in') || bodyText.includes('login') || bodyText.includes('blocked')) {
            console.log('⚠️ Possible authentication required or blocked');
        }
        
        if (bodyText.includes('no results') || bodyText.includes('nothing found')) {
            console.log('⚠️ No search results found');
        }
        
        console.log('✅ Debug complete');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugDribbble().catch(console.error);
