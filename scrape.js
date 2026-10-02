import FirecrawlApp from '@mendable/firecrawl-js';
import { z } from 'zod';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

// Define the exact schema you want returned
const schema = z.object({
  commodities: z.array(
    z.object({
      commodity: z.string(),
      msp_or_price_inr_per_quintal: z.number().nullable(),
      season_or_date: z.string().nullable(),
      market_or_state: z.string().nullable(),
    })
  ),
});

async function run() {
  const result = await app.scrapeUrl('https://agmarknet.gov.in', {
    formats: ['extract'],
    extract: {
      prompt: 'Extract all commodity prices and MSP values listed in any table or marquee.',
      schema: schema,
    },
    // Useful for ASP.NET / heavy portals:
    waitFor: 3000,
  });

  if (result.success) {
    console.log(JSON.stringify(result.extract, null, 2));
  } else {
    console.error('Scrape failed:', result.error);
  }
}

run();