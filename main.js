import { Actor, Dataset, RequestQueue } from 'scrapely';

await Actor.init();

async function main() {
    // Get input with defaults
    const input = await Actor.getInput() || {};
    const domains = input.domains || [
        'example.com',
        'httpbin.org',
        'jsonplaceholder.typicode.com',
        'github.com',
        'stackoverflow.com',
        'reddit.com',
        'twitter.com',
        'linkedin.com',
        'medium.com',
        'dev.to'
    ];
    const timeout = input.timeout || 30000;
    
    // Get or create the default Request Queue
    const requestQueue = await RequestQueue.open();
    
    console.log(`[Example Scraper] Adding ${domains.length} domains to Request Queue...`);
    
    // Add all domains to the Request Queue
    for (const domain of domains) {
        const url = domain.startsWith('http') ? domain : `https://${domain}`;
        await requestQueue.addRequest({ url, userData: { domain } });
    }
    
    const queueInfo = await requestQueue.getInfo();
    console.log(`[Example Scraper] Request Queue created with ${queueInfo.totalRequestCount} requests`);
    console.log(`[Example Scraper] Starting to process requests...`);

    let processedCount = 0;
    let successfulCount = 0;

    // Process requests from the queue
    while (true) {
        // Get the next request from the queue
        const request = await requestQueue.fetchNextRequest();
        
        if (!request) {
            console.log('[Example Scraper] No more requests in queue');
            break;
        }
        
        const { url, userData } = request;
        const domain = userData?.domain || url;
        
        try {
            console.log(`[Processing] ${url}`);
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ExampleScraper/1.0)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                signal: AbortSignal.timeout(timeout),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            
            // Extract basic page info from HTML
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : null;
            
            const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            const h1 = h1Match ? h1Match[1].trim() : null;
            
            // Get meta description
            const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
            const description = descMatch ? descMatch[1].trim() : null;
            
            // Get preview (first 300 chars of body text, stripped of tags)
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            const bodyText = bodyMatch 
                ? bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 300)
                : '';
            
            const result = {
                url,
                domain,
                title,
                h1,
                description,
                preview: bodyText,
                statusCode: response.status,
                contentType: response.headers.get('content-type'),
                scrapedAt: new Date().toISOString()
            };
            
            await Dataset.pushData(result);
            successfulCount++;
            
            console.log(`[Scraped] ${domain} -> ${title || 'No title'}`);
            
        } catch (err) {
            const errorResult = {
                url,
                domain,
                error: err.message,
                scrapedAt: new Date().toISOString()
            };
            
            await Dataset.pushData(errorResult);
            
            console.log(`[Error] ${domain}: ${err.message}`);
        }
        
        // Mark the request as handled (removes it from pending)
        await requestQueue.markRequestHandled(request);
        processedCount++;
    }
    
    // Get final queue stats
    const finalQueueInfo = await requestQueue.getInfo();
    
    console.log('\n=== Scraping Complete ===');
    console.log(`Total requests processed: ${processedCount}`);
    console.log(`Successful: ${successfulCount}`);
    console.log(`Failed: ${processedCount - successfulCount}`);
    console.log(`\nRequest Queue Stats:`);
    console.log(`  - Total: ${finalQueueInfo.totalRequestCount}`);
    console.log(`  - Handled: ${finalQueueInfo.handledRequestCount}`);
    console.log(`  - Pending: ${finalQueueInfo.pendingRequestCount}`);
}

main().catch(err => {
    console.error('[Example Scraper] Error:', err.message);
    process.exit(1);
});