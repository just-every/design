#!/usr/bin/env npx tsx

import { chromium } from 'playwright';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function debugVecteezy() {
    console.log('🔍 Debugging Vecteezy search...\n');
    
    const browser = await chromium.launch({ 
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });
    
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'User-Agent': USER_AGENT
    });
    
    // Remove webdriver property
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    });
    
    try {
        const query = "logo design";
        // Try different Vecteezy URL formats
        const urls = [
            `https://www.vecteezy.com/free-vector/logo-design`,
            `https://www.vecteezy.com/free-png/logo-design`,
            `https://www.vecteezy.com/search?query=${encodeURIComponent(query)}`
        ];
        
        const url = 'https://www.vecteezy.com/free-vector/logo-design';
        console.log(`Navigating to: ${url}\n`);
        
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        // Wait for content
        await page.waitForTimeout(5000);
        
        // Take screenshot
        await page.screenshot({ path: 'vecteezy-debug.png' });
        console.log('Screenshot saved as vecteezy-debug.png\n');
        
        // Analyze page structure
        const analysis = await page.evaluate(() => {
            const info: any = {};
            
            // Check for grid items with more specific selectors
            const gridSelectors = [
                '.ez-resource-grid__item',
                '.resource-grid__item',
                '[class*="grid-item"]',
                '[class*="ResourceGrid"] article',
                'article[class*="resource"]',
                'a[href*="/vector/"][href$=".htm"]',
                '.ez-resource-thumb',
                '[data-testid*="resource"]',
                '[data-cy*="resource"]'
            ];
            
            gridSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    info[selector] = {
                        count: elements.length,
                        firstItem: {
                            tagName: elements[0].tagName,
                            className: elements[0].className,
                            href: (elements[0] as any).href,
                            innerHTML: elements[0].innerHTML.substring(0, 200)
                        }
                    };
                }
            });
            
            // Look for images with various patterns
            const imagePatterns = [
                'img[src*="vecteezy"]',
                'img[data-src*="vecteezy"]',
                'img[src*="shutterstock"]',
                'img[src*="cdn"]',
                'img.ez-resource-thumb__image',
                'img[class*="thumb"]'
            ];
            
            info.imagesByPattern = {};
            imagePatterns.forEach(pattern => {
                const imgs = document.querySelectorAll(pattern);
                if (imgs.length > 0) {
                    info.imagesByPattern[pattern] = {
                        count: imgs.length,
                        firstImg: {
                            src: imgs[0].getAttribute('src'),
                            dataSrc: imgs[0].getAttribute('data-src'),
                            alt: imgs[0].getAttribute('alt'),
                            className: imgs[0].className
                        }
                    };
                }
            });
            
            // Check for links to vectors with specific patterns
            const vectorLinks = Array.from(document.querySelectorAll('a'))
                .filter(a => {
                    const href = (a as HTMLAnchorElement).href;
                    return href.includes('/vector/') && (href.endsWith('.htm') || href.match(/\d+$/));
                })
                .slice(0, 5);
                
            info.vectorLinks = vectorLinks.map(a => ({
                href: (a as HTMLAnchorElement).href,
                hasImage: !!a.querySelector('img'),
                imgSrc: a.querySelector('img')?.getAttribute('src'),
                text: a.textContent?.trim().substring(0, 50)
            }));
            
            // Check page content
            info.pageInfo = {
                title: document.title,
                hasContent: document.body.innerText.length > 1000,
                bodyTextSample: document.body.innerText.substring(0, 200)
            };
            
            return info;
        });
        
        console.log('Page Analysis:\n');
        
        console.log('Page Info:');
        console.log(`- Title: ${analysis.pageInfo.title}`);
        console.log(`- Has content: ${analysis.pageInfo.hasContent}`);
        console.log(`- Text sample: ${analysis.pageInfo.bodyTextSample}\n`);
        
        Object.entries(analysis).forEach(([key, value]: [string, any]) => {
            if (key === 'imagesByPattern') {
                console.log('\nImages by Pattern:');
                Object.entries(value).forEach(([pattern, data]: [string, any]) => {
                    console.log(`\n"${pattern}": ${data.count} images`);
                    console.log(`First image:`);
                    console.log(`  src: ${data.firstImg.src || 'none'}`);
                    console.log(`  data-src: ${data.firstImg.dataSrc || 'none'}`);
                    console.log(`  alt: ${data.firstImg.alt || 'none'}`);
                    console.log(`  class: ${data.firstImg.className || 'none'}`);
                });
            } else if (key === 'vectorLinks') {
                console.log(`\nVector Links Found: ${value.length}`);
                value.forEach((link: any, i: number) => {
                    console.log(`${i + 1}. ${link.href}`);
                    console.log(`   Has image: ${link.hasImage}`);
                    console.log(`   Image src: ${link.imgSrc || 'none'}`);
                    console.log(`   Text: ${link.text || 'none'}`);
                });
            } else if (key !== 'pageInfo' && value.count > 0) {
                console.log(`\n"${key}": ${value.count} elements`);
                console.log(`First item: <${value.firstItem.tagName} class="${value.firstItem.className}">`);
                if (value.firstItem.href) {
                    console.log(`Href: ${value.firstItem.href}`);
                }
                console.log(`HTML preview: ${value.firstItem.innerHTML.substring(0, 100)}...`);
            }
        });
        
        // Keep browser open
        console.log('\n⏸️  Browser will stay open for 20 seconds...');
        await page.waitForTimeout(20000);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugVecteezy().catch(console.error);