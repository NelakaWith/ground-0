export interface Provider {
  id: string;
  name: string;
  discoveryType: 'rss' | 'homepage';
  url: string;
  homepageUrl?: string;
}

export const providers: Provider[] = [
  {
    id: 'ada-derana-en',
    name: 'Ada Derana',
    discoveryType: 'rss',
    url: 'http://www.adaderana.lk/rss.php',
  },
  {
    id: 'daily-mirror-breaking-en',
    name: 'Daily Mirror (Breaking)',
    discoveryType: 'rss',
    url: 'https://www.dailymirror.lk/rss/breaking-news/108',
  },
  {
    id: 'daily-mirror-top-en',
    name: 'Daily Mirror (Top Stories)',
    discoveryType: 'rss',
    url: 'https://www.dailymirror.lk/rss/top-story/155',
  },
  {
    id: 'news-lk-en',
    name: 'News.lk',
    discoveryType: 'rss',
    url: 'https://www.news.lk/news?format=feed',
  },
  {
    id: 'economy-next-en',
    name: 'EconomyNext',
    discoveryType: 'rss',
    url: 'https://economynext.com/feed/',
  },
  {
    id: 'daily-news-en',
    name: 'Daily News',
    discoveryType: 'rss',
    url: 'https://dailynews.lk/feed/',
  },
  {
    id: 'the-island-en',
    name: 'The Island',
    discoveryType: 'rss',
    url: 'https://island.lk/feed/',
  },
  {
    id: 'sunday-observer-en',
    name: 'Sunday Observer',
    discoveryType: 'rss',
    url: 'https://www.sundayobserver.lk/feed/',
  },
  {
    id: 'newswire-en',
    name: 'Newswire.lk',
    discoveryType: 'rss',
    url: 'https://www.newswire.lk/feed/',
  },
  {
    id: 'the-morning-en',
    name: 'The Morning',
    discoveryType: 'homepage',
    url: 'https://www.themorning.lk/',
  },
];

export default providers;
