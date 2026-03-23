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
const WIKIPEDIA_WIKITEXT_URL = 'https://en.wikipedia.org/w/api.php?action=parse&page=Norm_Macdonald_Live&prop=wikitext&format=json';

const LEGACY_ITUNES_ID = process.env.LEGACY_ITUNES_ID || '625135046';
const LEGACY_ITUNES_PAGE_URL = process.env.LEGACY_ITUNES_PAGE_URL || `https://itunes.apple.com/us/podcast/norm-macdonald-live/id${LEGACY_ITUNES_ID}`;
const IMDB_TITLE_ID = process.env.IMDB_TITLE_ID || 'tt6407712';
const LOCAL_MEDIA_PATH = process.env.LOCAL_MEDIA_PATH || '/mnt/media-podcasts/Norm Macdonald Live';

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

function pad2(value) {
  return String(value).padStart(2, '0');
}

function episodeKey(season, episodeNumber) {
  return `s${season}e${episodeNumber}`;
}

function normalizeGuestForFileTitle(guest) {
  return cleanText(guest)
    .replace(/\s+[\u2013-]\s+Part\s+/gi, ' (Pt ')
    .replace(/\s+Part\s+(\d+)/gi, ' (Pt $1)')
    .replace(/\(Pt\s*(\d+)\)?$/i, '(Pt $1)');
}

function buildDefaultFileTitle(season, episodeNumber, guest) {
  return `Norm Macdonald Live - S${pad2(season)}E${pad2(episodeNumber)} - Norm Macdonald with Guest ${normalizeGuestForFileTitle(guest)}`;
}

function normalizeGuestForFriendlyTitle(guest) {
  const map = new Map([
    ['Bob Einstein (Super Dave Osborne)', 'Super Dave'],
    ['Gilbert Gottfried (Part 1)', 'Gilbert Gottfried Pt. 1'],
    ['Gilbert Gottfried (Part 2)', 'Gilbert Gottfried Pt. 2'],
    ['Todd Glass (Part 1)', 'Todd Glass Pt. 1'],
    ['Todd Glass (Part 2)', 'Todd Glass Pt. 2'],
    ['Sarah Silverman (Part 1)', 'Sarah Silverman Pt. 1'],
    ['Sarah Silverman (Part 2)', 'Sarah Silverman Pt. 2']
  ]);

  if (map.has(guest)) return map.get(guest);

  return cleanText(guest)
    .replace(/\s+[\u2013-]\s+Part\s+(\d+)/gi, ' Pt. $1')
    .replace(/\s*\(Part\s*(\d+)\)/gi, ' Pt. $1')
    .replace(/\s*\(Pt\.?\s*(\d+)\)/gi, ' Pt. $1');
}

function buildFriendlyTitle(season, episodeNumber, guest) {
  return `S${season}.E${episodeNumber} · ${normalizeGuestForFriendlyTitle(guest)}`;
}

function buildFriendlyDescription(episode, fallback = '') {
  const guest = normalizeGuestForFriendlyTitle(episode.guest || episode.title || 'Guest');
  const season = episode.season;
  const episodeNumber = episode.episodeNumber;

  if (season === 1 && episodeNumber === 1) {
    return `The premiere episode of Norm Macdonald Live, with guest ${guest}.`;
  }
  if (/Pt\.\s*1$/i.test(guest)) {
    const baseGuest = guest.replace(/\s+Pt\.\s*1$/i, '');
    return `The first part of Norm Macdonald's sit down with ${baseGuest}.`;
  }
  if (/Pt\.\s*2$/i.test(guest)) {
    const baseGuest = guest.replace(/\s+Pt\.\s*2$/i, '');
    return `The second part of Norm Macdonald's sit down with ${baseGuest}.`;
  }
  if (season === 1) {
    return `Norm Macdonald and Adam Eget welcome ${guest} to the show.`;
  }

  const maybeSource = cleanText(fallback);
  if (maybeSource && maybeSource.length >= 45) {
    return maybeSource;
  }

  return `${guest} joins Norm on Season ${season} of Norm Macdonald Live.`;
}

function isVideoFilename(filename) {
  return /\.(mp4|m4v|mov|mkv|avi|webm|ogv)$/i.test(filename);
}

function buildLocalFilenameMap(localMediaPath) {
  const byEpisode = new Map();

  if (!localMediaPath || !fs.existsSync(localMediaPath)) {
    return byEpisode;
  }

  const files = fs.readdirSync(localMediaPath);
  for (const file of files) {
    if (!isVideoFilename(file)) continue;
    const match = file.match(/S(\d{2})E(\d{2})/i);
    if (!match) continue;

    const season = Number(match[1]);
    const episode = Number(match[2]);
    const stem = path.parse(file).name;
    byEpisode.set(episodeKey(season, episode), {
      fileName: file,
      fileTitle: stem
    });
  }

  return byEpisode;
}

function stripWikiMarkup(value) {
  return cleanText(
    (value || '')
      .replace(/\{\{[^{}]*\}\}/g, '')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
      .replace(/''+/g, '')
  );
}

function toIsoDate(dateText) {
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseWikipediaEpisodes(wikitext) {
  const seasonWordToNumber = {
    one: 1,
    two: 2,
    three: 3
  };

  const byEpisode = new Map();
  const sectionRegex = /===Season\s+(one|two|three)===([\s\S]*?)(?=\n===|$)/gi;
  let sectionMatch = null;

  while ((sectionMatch = sectionRegex.exec(wikitext)) !== null) {
    const season = seasonWordToNumber[sectionMatch[1].toLowerCase()];
    if (!season) continue;

    const sectionBody = sectionMatch[2];
    const rowRegex = /\|\s*(\d+)\s*\|\|\s*(\d+)\s*\|\|\s*([^|\n]+?)\s*\|\|\s*([^\n]+)/g;
    let rowMatch = null;
    while ((rowMatch = rowRegex.exec(sectionBody)) !== null) {
      const inSeason = Number(rowMatch[2]);
      const releaseDate = toIsoDate(stripWikiMarkup(rowMatch[3]));
      const subject = stripWikiMarkup(rowMatch[4]);
      if (!inSeason || !subject) continue;

      byEpisode.set(episodeKey(season, inSeason), {
        guest: subject,
        releaseDate
      });
    }
  }

  return byEpisode;
}

function parseImdbEpisodesFromHtml(html) {
  const $ = cheerio.load(html);
  const byEpisode = new Map();

  $('script[type="application/ld+json"]').each((_idx, element) => {
    const raw = $(element).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const payloads = Array.isArray(parsed) ? parsed : [parsed];
      payloads.forEach((payload) => {
        const list = payload?.itemListElement;
        if (!Array.isArray(list)) return;

        list.forEach((item) => {
          const episode = item?.item || item;
          const seasonNumber = Number(episode?.partOfSeason?.seasonNumber);
          const episodeNumber = Number(episode?.episodeNumber);
          if (!seasonNumber || !episodeNumber) return;

          byEpisode.set(episodeKey(seasonNumber, episodeNumber), {
            title: cleanText(episode?.name || ''),
            description: cleanText(episode?.description || ''),
            releaseDate: toIsoDate(episode?.datePublished || '')
          });
        });
      });
    } catch {
      // Ignore invalid json blocks.
    }
  });

  return byEpisode;
}

async function fetchWikipediaEpisodeMap() {
  const jsonText = await fetchText(WIKIPEDIA_WIKITEXT_URL).catch(() => null);
  if (!jsonText) return new Map();

  try {
    const payload = JSON.parse(jsonText);
    const wikitext = payload?.parse?.wikitext?.['*'] || '';
    if (!wikitext) return new Map();
    return parseWikipediaEpisodes(wikitext);
  } catch {
    return new Map();
  }
}

async function fetchImdbEpisodeMap() {
  const byEpisode = new Map();

  for (const season of [1, 2, 3]) {
    const url = `https://www.imdb.com/title/${IMDB_TITLE_ID}/episodes/?season=${season}`;
    const html = await fetchText(url).catch(() => null);
    if (!html) continue;

    const seasonMap = parseImdbEpisodesFromHtml(html);
    for (const [key, value] of seasonMap.entries()) {
      byEpisode.set(key, value);
    }
  }

  return byEpisode;
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

  const [wikipediaEpisodeMap, imdbEpisodeMap] = await Promise.all([
    fetchWikipediaEpisodeMap(),
    fetchImdbEpisodeMap()
  ]);
  const localFilenameMap = buildLocalFilenameMap(LOCAL_MEDIA_PATH);

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

    const key = episodeKey(episode.season, episode.episodeNumber);
    const wikipediaMetadata = wikipediaEpisodeMap.get(key);
    const imdbMetadata = imdbEpisodeMap.get(key);
    const localFile = localFilenameMap.get(key);

    if (wikipediaMetadata?.guest && !episode.guest) {
      episode.guest = wikipediaMetadata.guest;
      episode.title = wikipediaMetadata.guest;
    }

    if (wikipediaMetadata?.releaseDate && !episode.releaseDate) {
      episode.releaseDate = wikipediaMetadata.releaseDate;
    }

    if (imdbMetadata?.description) {
      const archiveDescription = cleanText(episode.description);
      if (!archiveDescription || archiveDescription.length < 50) {
        episode.description = imdbMetadata.description;
      }
    }

    const archiveDescription = cleanText(episode.description);
    episode.description = buildFriendlyDescription(episode, imdbMetadata?.description || archiveDescription);
    episode.friendlyTitle = buildFriendlyTitle(episode.season, episode.episodeNumber, episode.guest);
    episode.publishedDate = episode.releaseDate;

    episode.fileTitle = localFile?.fileTitle || buildDefaultFileTitle(episode.season, episode.episodeNumber, episode.guest);
    if (localFile?.fileName) {
      episode.localFileName = localFile.fileName;
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
      wikipedia: 'https://en.wikipedia.org/wiki/Norm_Macdonald_Live',
      imdbEpisodes: `https://www.imdb.com/title/${IMDB_TITLE_ID}/episodes/`
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
