import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

async function testReadability(url: string) {
  try {
    console.log(`Fetching ${url}...`);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    
    console.log(`Response status: ${response.status}`);
    const html = await response.text();
    console.log(`Fetched HTML length: ${html.length}`);
    
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();
    
    if (article && article.textContent) {
      console.log(`Readability extracted: ${article.textContent.length} chars`);
      console.log(`Preview: ${article.textContent.substring(0, 200)}...`);
    } else {
      console.log('Readability returned null or empty.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

testReadability('https://www.sundayobserver.lk/2026/08/09/sport/82406/trinity-cr-and-fc-climb-pinnacle-of-glory/');
