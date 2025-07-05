#!/usr/bin/env npx tsx

import { chromium } from 'playwright';

async function testVecteezySimple() {
    console.log('🔍 Testing Vecteezy with simple approach...\n');
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const url = 'https://www.vecteezy.com/free-vector/logo-design';
    console.log(`Navigating to: ${url}\n`);
    
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        
        // Wait a bit for content
        await page.waitForTimeout(3000);
        
        // Check if we got the right page
        const title = await page.title();
        const currentUrl = page.url();
        console.log(`Title: ${title}`);
        console.log(`URL: ${currentUrl}\n`);
        
        // Look for any resource links
        const resourceLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'))
                .filter(a => {
                    const href = (a as HTMLAnchorElement).href;
                    return href.includes('/vector/') && href.match(/\d+$/);
                })
                .slice(0, 10);
                
            return links.map(a => {
                const link = a as HTMLAnchorElement;
                const img = link.querySelector('img');
                return {
                    href: link.href,
                    hasImage: !!img,
                    imgSrc: img?.getAttribute('src') || img?.getAttribute('data-src'),
                    imgAlt: img?.getAttribute('alt')
                };
            });
        });
        
        console.log(`Found ${resourceLinks.length} resource links`);
        resourceLinks.forEach((link, i) => {
            console.log(`\n${i + 1}. ${link.href}`);
            console.log(`   Has image: ${link.hasImage}`);
            if (link.imgSrc) {
                console.log(`   Image: ${link.imgSrc.substring(0, 60)}...`);
                console.log(`   Alt: ${link.imgAlt || 'no alt'}`);
            }
        });
        
        // If no links found, check what content we have
        if (resourceLinks.length === 0) {
            const pageContent = await page.evaluate(() => {
                return {
                    bodyText: document.body.innerText.substring(0, 500),
                    imageCount: document.querySelectorAll('img').length,
                    linkCount: document.querySelectorAll('a').length
                };
            });
            
            console.log('\nNo resource links found. Page content:');
            console.log(`- Images: ${pageContent.imageCount}`);
            console.log(`- Links: ${pageContent.linkCount}`);
            console.log(`- Text preview: ${pageContent.bodyText.substring(0, 200)}...`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
    
    await browser.close();
}

testVecteezySimple().catch(console.error);