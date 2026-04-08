"""
Crawl4AI microservice for Ground-0 platform
Exposes Crawl4AI functionality via FastAPI for consumption by NestJS apps/api
"""
import asyncio
import os
from contextlib import asynccontextmanager
from typing import Any, Optional, Protocol

from crawl4ai import AsyncWebCrawler
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Try to import content filtering (available in crawl4ai >=0.4.x)
try:
    from crawl4ai.content_filter_strategy import PruningContentFilter
    from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
    _HAS_CONTENT_FILTER = True
except ImportError:
    _HAS_CONTENT_FILTER = False

load_dotenv()

class _CrawlResult(Protocol):
    """Minimal protocol matching crawl4ai's CrawlResult."""
    markdown: Any  # str in 0.3.x, MarkdownGenerationResult in 0.4.x
    html: str


def _extract_markdown(result: _CrawlResult) -> str:
    """Extract the best available markdown from a CrawlResult, across API versions."""
    md = result.markdown
    # 0.4.x: markdown is a MarkdownGenerationResult object
    if hasattr(md, 'fit_markdown') and md.fit_markdown:
        return md.fit_markdown
    if hasattr(md, 'raw_markdown'):
        return md.raw_markdown
    # 0.3.x: markdown is a plain string
    return md or ""


# Global crawler instance
crawler: Optional[AsyncWebCrawler] = None


class CrawlRequest(BaseModel):
    """Request schema for crawling"""
    url: str
    javascript_enabled: bool = True
    wait_until: str = "networkidle"
    timeout: int = 10000


class CrawlResponse(BaseModel):
    """Response schema for crawl results"""
    url: str
    markdown: str
    raw_html: Optional[str] = None
    success: bool
    error: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage crawler lifecycle"""
    global crawler
    # Startup
    crawler = AsyncWebCrawler()
    print("✓ Crawl4AI initialized")
    yield
    # Shutdown
    if crawler:
        await crawler.close()
        print("✓ Crawl4AI closed")


app = FastAPI(title="Crawl4AI Microservice", version="0.1.0", lifespan=lifespan)


async def _arun(url: str, **kwargs: Any) -> _CrawlResult:
    """Typed wrapper around arun to bypass AsyncGenerator stubs."""
    # Use PruningContentFilter for article-only extraction when available (crawl4ai >=0.4.x)
    if _HAS_CONTENT_FILTER:
        kwargs.setdefault(
            'markdown_generator',
            DefaultMarkdownGenerator(
                content_filter=PruningContentFilter(
                    threshold=0.1, 
                    threshold_type="dynamic",
                    min_word_threshold=30
                )
            )
        )
    
    # Exclude common noisy sections entirely
    kwargs.setdefault('excluded_tags', ['nav', 'footer', 'header', 'script', 'style', 'noscript', 'form', 'iframe', 'svg'])
    kwargs.setdefault('remove_overlay_elements', True)
    
    return await crawler.arun(url, **kwargs)  # type: ignore[misc, return-value]


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "crawl4ai-microservice"}


@app.post("/crawl", response_model=CrawlResponse)
async def crawl(request: CrawlRequest) -> CrawlResponse:
    """
    Crawl a URL and extract markdown content

    Args:
        request: CrawlRequest with URL and options

    Returns:
        CrawlResponse with markdown and raw HTML
    """
    global crawler

    if not crawler:
        raise HTTPException(status_code=503, detail="Crawler not initialized")

    try:
        result = await _arun(
            request.url,
            javascript_enabled=request.javascript_enabled,
            wait_until=request.wait_until,
            timeout=request.timeout,
        )

        return CrawlResponse(
            url=request.url,
            markdown=_extract_markdown(result),
            raw_html=result.html,
            success=True,
            error=None,
        )
    except Exception as e:
        return CrawlResponse(
            url=request.url,
            markdown="",
            raw_html=None,
            success=False,
            error=str(e),
        )


@app.post("/crawl-batch")
async def crawl_batch(urls: list[str]):
    """
    Crawl multiple URLs in parallel

    Args:
        urls: List of URLs to crawl

    Returns:
        List of CrawlResponse objects
    """
    global crawler

    if not crawler:
        raise HTTPException(status_code=503, detail="Crawler not initialized")

    tasks = [
        _arun(url, javascript_enabled=True, wait_until="networkidle", timeout=10000)
        for url in urls
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    responses = []
    for url, result in zip(urls, results):
        if isinstance(result, BaseException):
            responses.append(
                CrawlResponse(
                    url=url,
                    markdown="",
                    raw_html=None,
                    success=False,
                    error=str(result),
                )
            )
        else:
            responses.append(
                CrawlResponse(
                    url=url,
                    markdown=result.markdown,
                    raw_html=result.html,
                    success=True,
                    error=None,
                )
            )

    return responses


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("CRAWLER_PORT", 3001))
    host = os.getenv("CRAWLER_HOST", "127.0.0.1")

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
    )
