import { Actor, Dataset } from 'scrapely';

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
    
    console.log(`[Example Scraper] Starting scrape of ${domains.length} domains...`);

    const results = [];

    for (const domain of domains) {
        const url = domain.startsWith('http') ? domain : `https://${domain}`;
        
        try {
            console.log(`[Scraping] ${url}`);
            
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
            results.push(result);
            
            console.log(`[Scraped] ${domain} -> ${title || 'No title'}`);
            
        } catch (err) {
            const errorResult = {
                url,
                domain,
                error: err.message,
                scrapedAt: new Date().toISOString()
            };
            
            await Dataset.pushData(errorResult);
            results.push(errorResult);
            
            console.log(`[Error] ${domain}: ${err.message}`);
        }
    }

    // Display results summary
    console.log('\n=== Scraped Results ===');
    console.log(JSON.stringify(results, null, 2));
    
    const successful = results.filter(r => !r.error).length;
    console.log(`\n[Example Scraper] Complete! Scraped ${successful}/${domains.length} domains successfully.`);
}

main().catch(err => {
    console.error('[Example Scraper] Error:', err.message);
    process.exit(1);
});