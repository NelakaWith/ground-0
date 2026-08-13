export interface Provider {
  id: string;
  name: string;
  discoveryType: 'rss' | 'homepage';
  url: string;
  homepageUrl?: string;
  articleSelector?: string;
}

export const providers: Provider[] = [
  {
    id: 'ada-derana-en',
    name: 'Ada Derana',
    discoveryType: 'rss',
    url: 'http://www.adaderana.lk/rss.php',
    articleSelector: '.news-content',
  },
  {
    id: 'daily-mirror-breaking-en',
    name: 'Daily Mirror (Breaking)',
    discoveryType: 'rss',
    url: 'https://www.dailymirror.lk/rss/breaking-news/108',
    articleSelector: '.inner-text',
  },
  {
    id: 'daily-mirror-top-en',
    name: 'Daily Mirror (Top Stories)',
    discoveryType: 'rss',
    url: 'https://www.dailymirror.lk/rss/top-story/155',
    articleSelector: '.inner-text',
  },
  {
    id: 'news-lk-en',
    name: 'News.lk',
    discoveryType: 'rss',
    url: 'https://www.news.lk/news?format=feed',
    articleSelector: '.item-page',
  },
  {
    id: 'economy-next-en',
    name: 'EconomyNext',
    discoveryType: 'rss',
    url: 'https://economynext.com/feed/',
    articleSelector: '.story-content',
  },
  {
    id: 'daily-news-en',
    name: 'Daily News',
    discoveryType: 'rss',
    url: 'https://dailynews.lk/feed/',
    articleSelector: '.entry-content',
  },
  {
    id: 'the-island-en',
    name: 'The Island',
    discoveryType: 'rss',
    url: 'https://island.lk/feed/',
    articleSelector: '.entry-content',
  },
  {
    id: 'sunday-observer-en',
    name: 'Sunday Observer',
    discoveryType: 'rss',
    url: 'https://www.sundayobserver.lk/feed/',
    articleSelector: '.entry-content',
  },
  {
    id: 'newswire-en',
    name: 'Newswire.lk',
    discoveryType: 'rss',
    url: 'https://www.newswire.lk/feed/',
    articleSelector: '.entry-content',
  },
];

export default providers;
