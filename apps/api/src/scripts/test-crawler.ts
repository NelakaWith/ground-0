async function testCrawler() {
  const url = 'https://www.sundayobserver.lk/2026/08/09/sport/82406/trinity-cr-and-fc-climb-pinnacle-of-glory/';
  console.log(`Testing crawler for: ${url}`);
  try {
    const res = await fetch('http://127.0.0.1:3001/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, javascript_enabled: true, wait_until: 'networkidle', timeout: 20000 })
    });
    
    if (!res.ok) {
      console.log(`Crawler returned ${res.status}`);
      return;
    }
    const data = await res.json();
    console.log(`Success: ${data.success}`);
    if (data.markdown) {
      console.log(`Markdown length: ${data.markdown.length}`);
    }
    if (data.error) {
      console.log(`Error: ${data.error}`);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
export {};
testCrawler();
