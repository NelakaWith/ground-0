# Crawl4AI Microservice

A FastAPI-based microservice that exposes Crawl4AI functionality for the Ground-0 platform. This service handles web scraping, content extraction, and anti-bot bypassing for news article ingestion.

## Features

- **Fast extraction:** Crawl4AI optimized markdown extraction for LLM consumption
- **Anti-bot:** Built-in WAF/Cloudflare bypass with browser fingerprinting
- **Batch processing:** Extract multiple URLs in parallel
- **Clean API:** FastAPI with async/await support

## Setup

### Prerequisites

- Python 3.10+
- pip or uv

### Installation

**Option 1: Using pnpm (Turbo monorepo)**

```bash
cd apps/crawler
pnpm run setup
```

**Option 2: Manual setup**

```bash
cd apps/crawler
python -m venv venv
venv\Scripts\activate  # On Windows
pip install -r requirements.txt
```

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

## Running the Service

### Development (Local)

```bash
pnpm run dev
# or if already in apps/crawler:
python main.py
```

### Development (Via Turbo from root)

From the **root directory**:

```bash
pnpm run dev
```

This starts all services in the monorepo (api + crawler) in parallel. The crawler service will start on `http://127.0.0.1:3001`

### Using Docker

```bash
docker build -t crawl4ai-microservice .
docker run -p 3001:3001 crawl4ai-microservice
```

## API Endpoints

### Health Check

```
GET /health
```

### Single URL Crawl

```
POST /crawl
Content-Type: application/json

{
  "url": "https://example.com/article",
  "javascript_enabled": true,
  "wait_until": "networkidle",
  "timeout": 10000
}
```

Response:

```json
{
  "url": "https://example.com/article",
  "markdown": "# Article Title\n...",
  "raw_html": "<html>...",
  "success": true,
  "error": null
}
```

### Batch Crawl

```
POST /crawl-batch
Content-Type: application/json

["https://example.com/1", "https://example.com/2"]
```

## Integration with NestJS (apps/api)

Example usage in `scraper.service.ts`:

```typescript
import axios from "axios";

export class ScraperService {
  private crawlerApiUrl = "http://127.0.0.1:3001";

  async crawlArticle(url: string): Promise<string> {
    const response = await axios.post(`${this.crawlerApiUrl}/crawl`, {
      url,
      javascript_enabled: true,
      wait_until: "networkidle",
      timeout: 10000,
    });

    if (!response.data.success) {
      throw new Error(`Crawl failed: ${response.data.error}`);
    }

    return response.data.markdown;
  }

  async crawlBatch(urls: string[]): Promise<string[]> {
    const response = await axios.post(
      `${this.crawlerApiUrl}/crawl-batch`,
      urls,
    );

    return response.data.filter((r) => r.success).map((r) => r.markdown);
  }
}
```

## Environment Variables

- `CRAWLER_HOST` - Host to bind to (default: `127.0.0.1`)
- `CRAWLER_PORT` - Port to listen on (default: `3001`)
- `HTTP_PROXY` / `HTTPS_PROXY` - Proxy settings (optional)

## Troubleshooting

### Browser not found

If you get "Browser not found" error, Crawl4AI will attempt to install Chromium automatically. If this fails, install it manually:

```bash
# On macOS
brew install chromium

# On Ubuntu/Debian
sudo apt-get install chromium-browser

# On Windows
# Download from https://www.chromium.org/
```

### Port already in use

Change the `CRAWLER_PORT` in `.env` or pass it as an environment variable:

```bash
CRAWLER_PORT=3002 python main.py
```

## License

Same as Ground-0 main project
