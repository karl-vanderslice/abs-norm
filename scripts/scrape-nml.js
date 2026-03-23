import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'data', 'norm-macdonald-live.json');

const ARCHIVE_BASE = 'https://normmacdonaldarchive.com';
const LIST_URL = `${ARCHIVE_BASE}/nml`;

const LEGACY_ITUNES_ID = process.env.LEGACY_ITUNES_ID || '625135046';
const LEGACY_ITUNES_PAGE_URL = process.env.LEGACY_ITUNES_PAGE_URL || `https://itunes.apple.com/us/podcast/norm-macdonald-live/id${LEGACY_ITUNES_ID}`;

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'abs-norm-scraper/0.1 (+https://github.com/karl-vanderslice/abs-norm)'
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

function unique(values) {
  return [...new Set(values)];
}

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function extractEpisodeLinks(listHtml) {
  const $ = cheerio.load(listHtml);
  const slugs = [];

  $('a[href^="/nml/s"]').each((_idx, element) => {
    const href = $(element).attr('href') || '';
    if (/^\/nml\/s\d-e\d+-[a-z0-9-]+$/i.test(href)) {
      slugs.push(href.replace('/nml/', ''));
    }
  });

  return unique(slugs).sort((a, b) => {
    const aa = a.match(/^s(\d+)-e(\d+)-/i);
    const bb = b.match(/^s(\d+)-e(\d+)-/i);
    if (!aa || !bb) return a.localeCompare(b);

    const seasonDiff = Number(aa[1]) - Number(bb[1]);
    if (seasonDiff !== 0) return seasonDiff;
    return Number(aa[2]) - Number(bb[2]);
  });
}

function parseEpisodePage(slug, html, coverFallback) {
  const $ = cheerio.load(html);

  const heading = cleanText($('h1').first().text());
  const headingMatch = heading.match(/^S\s*(\d+)\s*:\s*E\s*(\d+)\s*[\u2014-]\s*(.+)$/i);
  if (!headingMatch) {
    throw new Error(`Failed to parse season/episode heading for slug ${slug}`);
  }

  const season = Number(headingMatch[1]);
  const episodeNumber = Number(headingMatch[2]);
  const guest = cleanText(headingMatch[3]);

  const airedText = cleanText($('p').filter((_idx, el) => $(el).text().includes('Aired')).first().text());
  const releaseDate = (airedText.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
  if (!releaseDate) {
    throw new Error(`Failed to parse release date for slug ${slug}`);
  }

  const watchUrl = $('iframe').first().attr('src') ||
    $('a[href*="archive.org/embed"]').first().attr('href') ||
    $('meta[property="og:url"]').attr('content') ||
    '';

  const aboutHeader = $('h2').filter((_idx, el) => cleanText($(el).text()).toLowerCase() === 'about this episode').first();
  const description = cleanText(aboutHeader.length ? aboutHeader.parent().find('p').first().text() : $('meta[name="description"]').attr('content'));

  const pageUrl = `${ARCHIVE_BASE}/nml/${slug}`;
  const thumbnail =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    coverFallback;

  return {
    slug,
    guid: `nml-${slug}`,
    season,
    episodeNumber,
    title: guest,
    guest,
    releaseDate,
    description,
    pageUrl,
    mediaUrl: watchUrl,
    thumbnail: thumbnail || coverFallback,
    tags: [`season-${season}`, 'norm-macdonald-live', guest]
  };
}

async function main() {
  console.log(`Fetching episode list from ${LIST_URL}`);
  const listHtml = await fetchText(LIST_URL);
  const slugs = extractEpisodeLinks(listHtml);

  if (slugs.length !== 39) {
    throw new Error(`Expected 39 episodes, found ${slugs.length}`);
  }

  const episodes = [];
  let coverFallback = `${ARCHIVE_BASE}/og-image.png`;

  for (const slug of slugs) {
    const url = `${ARCHIVE_BASE}/nml/${slug}`;
    console.log(`Scraping ${url}`);
    const html = await fetchText(url);
    const episode = parseEpisodePage(slug, html, coverFallback);

    if (episode.thumbnail) {
      coverFallback = episode.thumbnail;
    }

    episodes.push(episode);
  }

  episodes.sort((a, b) => {
    const seasonDiff = a.season - b.season;
    if (seasonDiff !== 0) return seasonDiff;
    return a.episodeNumber - b.episodeNumber;
  });

  episodes.forEach((episode, idx) => {
    episode.episodeOverall = idx + 1;
  });

  const podcast = {
    title: 'Norm Macdonald Live',
    subtitle: 'The complete 39-episode run of Norm Macdonald Live',
    author: 'Norm Macdonald',
    publisher: 'Video Podcast Network / JASH',
    description: 'Discontinued audio/video comedy talk podcast hosted by Norm Macdonald with co-host Adam Eget. Metadata sourced from the Norm Macdonald Archive and Wikipedia episode chronology.',
    genres: ['Comedy', 'Talk Show', 'Interview'],
    tags: ['norm-macdonald', 'norm-macdonald-live', 'comedy', 'interview', 'archive'],
    releaseDate: episodes[0].releaseDate,
    language: 'en',
    explicit: true,
    type: 'episodic',
    cover: coverFallback,
    itunesId: LEGACY_ITUNES_ID,
    itunesPageUrl: LEGACY_ITUNES_PAGE_URL,
    feedUrl: 'http://localhost:8042/rss/norm-macdonald-live.xml',
    source: {
      archiveList: LIST_URL,
      wikipedia: 'https://en.wikipedia.org/wiki/Norm_Macdonald_Live'
    }
  };

  const output = {
    generatedAt: new Date().toISOString(),
    podcast,
    episodes
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${episodes.length} episodes to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
