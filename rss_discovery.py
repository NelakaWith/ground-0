import asyncio
from curl_cffi.requests import AsyncSession
import feedparser
# We use the explicit RSS endpoints we already know about
providers = [
    {
        "id": "ada-derana-en",
        "name": "Ada Derana",
        "rss_url": "http://www.adaderana.lk/rss.php"
    },
    {
        "id": "daily-mirror-breaking-en",
        "name": "Daily Mirror (Breaking)",
        "rss_url": "https://www.dailymirror.lk/rss/breaking-news/108"
    },
    {
        "id": "daily-mirror-top-en",
        "name": "Daily Mirror (Top Stories)",
        "rss_url": "https://www.dailymirror.lk/rss/top-story/155"
    },
    {
        "id": "news-lk-en",
        "name": "News.lk",
        "rss_url": "https://www.news.lk/news?format=feed"
    },
    {
        "id": "economy-next-en",
        "name": "EconomyNext",
        "rss_url": "https://economynext.com/feed/"
    },
    {
        "id": "divaina-si",
        "name": "Divaina",
        "rss_url": "https://divaina.lk/feed/"
    },
    {
        "id": "daily-news-en",
        "name": "Daily News",
        "rss_url": "https://dailynews.lk/feed/"
    },
    {
        "id": "the-island-en",
        "name": "The Island",
        "rss_url": "https://island.lk/feed/"
    },
    {
        "id": "lankadeepa-si",
        "name": "Lankadeepa",
        "rss_url": "https://www.lankadeepa.lk/rss/news/1"
    },
    {
        "id": "lankadeepa-foreign-si",
        "name": "Lankadeepa (Foreign)",
        "rss_url": "https://www.lankadeepa.lk/rss/foreign/48"
    },
    {
        "id": "dinamina-si",
        "name": "Dinamina",
        "rss_url": "https://www.dinamina.lk/feed/"
    }
]

async def fetch_and_parse(session, provider, semaphore):
    async with semaphore:
        try:
            # Rotating to Safari often bypasses strict Cloudflare rules
            response = await session.get(provider['rss_url'], impersonate="safari15_5", timeout=15)

            if response.status_code != 200:
                return {**provider, "status": "failed", "error": f"HTTP {response.status_code}"}

            # Feed the raw XML text into feedparser
            feed = feedparser.parse(response.text)

            # Extract the top 3 articles
            articles = []
            for entry in feed.entries[:3]:
                articles.append({
                    "title": entry.get("title", "No Title"),
                    "link": entry.get("link", "No Link")
                })

            return {**provider, "status": "success", "articles": articles}

        except Exception as e:
            return {**provider, "status": "failed", "error": str(e)}

async def main():
    semaphore = asyncio.Semaphore(3)

    async with AsyncSession() as session:
        tasks = [fetch_and_parse(session, provider, semaphore) for provider in providers]
        results = await asyncio.gather(*tasks)

        print("--- Latest News Extracted ---\n")
        for res in results:
            print(f"[{res['id'].upper()}]")
            if res['status'] == 'success':
                for i, article in enumerate(res['articles'], 1):
                    print(f"  {i}. {article['title']}")
                    print(f"     Link: {article['link']}")
            else:
                print(f"  ❌ Failed: {res['error']}")
            print("-" * 40)

if __name__ == "__main__":
    asyncio.run(main())

# https://rss.feedspot.com/sri_lanka_news_rss_feeds/