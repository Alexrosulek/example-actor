import { Actor, PlaywrightCrawler, Dataset } from 'scrapely';

await Actor.init();

async function main() {
    // Get the URL from input or use default
    const input = await Actor.getInput() || {};
    const startUrl = input.url || 'https://example.com';
    
    console.log(`[Example Scraper] Starting scrape at: ${startUrl}`);

    const crawler = new PlaywrightCrawler({
        launchContext: {
            useIncognitoPages: true,
        },
        navigationTimeoutSecs: 60,
        requestHandler: async ({ page, request, pushData }) => {
            // Wait for the page to load
            await page.waitForLoadState('domcontentloaded');
            
            // Extract data from the page
            const title = await page.title();
            const url = request.url;
            
            // Try to get the h1 heading
            const h1 = await page.locator('h1').first().textContent().catch(() => null);
            
            // Get some text from the page
            const bodyText = await page.locator('body').innerText().catch(() => '');
            const preview = bodyText.substring(0, 200);
            
            console.log(`[Scraped] ${url} -> ${title}`);
            
            // Save the data
            await pushData({
                url,
                title,
                h1: h1?.trim() || null,
                preview,
                scrapedAt: new Date().toISOString()
            });
        },
        maxRequestsPerCrawl: 5,
        maxConcurrency: 1,
    });
    
    // Run the crawler
    await crawler.run([startUrl]);
    
    // Get and display results
    const data = await Dataset.getData();
    console.log('\n=== Scraped Results ===');
    console.log(JSON.stringify(data.items, null, 2));
    console.log(`\n[Example Scraper] Complete! Scraped ${data.items.length} pages.`);
}

main().catch(err => {
    console.error('[Example Scraper] Error:', err.message);
    process.exit(1);
});