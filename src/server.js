import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, '..', 'data', 'norm-macdonald-live.json');

const app = express();
const port = Number(process.env.PORT || 8042);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;

function loadDataset() {
  if (!fs.existsSync(DATA_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function normalize(value) {
  return (value || '').toString().toLowerCase().trim();
}

function escapeXml(value) {
  return (value || '')
    .toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function toRfc2822(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return new Date().toUTCString();
  return date.toUTCString();
}

function matchScore(query, haystackValues) {
  if (!query) return 1;
  const q = normalize(query);
  if (!q) return 1;

  let best = 0;
  for (const value of haystackValues) {
    const candidate = normalize(value);
    if (!candidate) continue;
    if (candidate === q) return 100;
    if (candidate.startsWith(q)) best = Math.max(best, 80);
    if (candidate.includes(q)) best = Math.max(best, 60);
  }
  return best;
}

function toAbsMatch(dataset) {
  const podcast = dataset.podcast;
  return {
    title: podcast.title,
    subtitle: podcast.subtitle,
    author: podcast.author,
    description: podcast.description,
    cover: podcast.cover,
    genres: podcast.genres,
    tags: podcast.tags,
    language: podcast.language,
    explicit: podcast.explicit,
    publisher: podcast.publisher,
    publishedYear: String(new Date(podcast.releaseDate).getUTCFullYear()),

    // Podcast-specific keys used by built-in iTunes provider payloads.
    id: podcast.itunesId,
    itunesId: podcast.itunesId,
    itunesPageUrl: podcast.itunesPageUrl,
    feedUrl: podcast.feedUrl,
    releaseDate: podcast.releaseDate,
    type: podcast.type,

    // Non-spec extension fields to make data fully portable.
    rssFeedUrl: podcast.feedUrl,
    episodes: dataset.episodes,
    source: podcast.source
  };
}

function buildRss(dataset) {
  const podcast = dataset.podcast;
  const items = dataset.episodes
    .map((episode) => {
      const enclosureUrl = episode.mediaUrl || episode.pageUrl;
      const enclosureType = episode.mediaUrl?.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'text/html';
      const guid = episode.guid || episode.slug;

      return [
        '    <item>',
        `      <title>${escapeXml(episode.title)}</title>`,
        `      <description>${escapeXml(episode.description || '')}</description>`,
        `      <pubDate>${escapeXml(toRfc2822(episode.releaseDate))}</pubDate>`,
        `      <guid isPermaLink="false">${escapeXml(guid)}</guid>`,
        `      <link>${escapeXml(episode.pageUrl)}</link>`,
        `      <enclosure url="${escapeXml(enclosureUrl)}" type="${escapeXml(enclosureType)}" length="0" />`,
        `      <itunes:episode>${episode.episodeNumber}</itunes:episode>`,
        `      <itunes:season>${episode.season}</itunes:season>`,
        `      <itunes:explicit>${podcast.explicit ? 'yes' : 'no'}</itunes:explicit>`,
        `      <itunes:image href="${escapeXml(episode.thumbnail || podcast.cover)}" />`,
        '    </item>'
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '  <channel>',
    `    <title>${escapeXml(podcast.title)}</title>`,
    `    <link>${escapeXml(podcast.itunesPageUrl)}</link>`,
    `    <description>${escapeXml(podcast.description)}</description>`,
    `    <language>${escapeXml(podcast.language)}</language>`,
    `    <pubDate>${escapeXml(toRfc2822(podcast.releaseDate))}</pubDate>`,
    `    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`,
    `    <itunes:author>${escapeXml(podcast.author)}</itunes:author>`,
    `    <itunes:summary>${escapeXml(podcast.description)}</itunes:summary>`,
    `    <itunes:explicit>${podcast.explicit ? 'yes' : 'no'}</itunes:explicit>`,
    `    <itunes:type>${escapeXml(podcast.type || 'episodic')}</itunes:type>`,
    `    <itunes:image href="${escapeXml(podcast.cover)}" />`,
    ...podcast.genres.map((genre) => `    <itunes:category text="${escapeXml(genre)}" />`),
    items,
    '  </channel>',
    '</rss>'
  ].join('\n');
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/search', (req, res) => {
  const dataset = loadDataset();
  if (!dataset) {
    return res.status(500).json({ error: 'Dataset not found. Run `make scrape` first.' });
  }

  const mediaType = normalize(req.query.mediaType);
  if (mediaType && mediaType !== 'podcast') {
    return res.json({ matches: [] });
  }

  const query = (req.query.query || '').toString();
  const author = (req.query.author || '').toString();

  const haystack = [
    dataset.podcast.title,
    dataset.podcast.subtitle,
    dataset.podcast.author,
    ...dataset.podcast.tags,
    ...dataset.podcast.genres,
    ...dataset.episodes.map((episode) => episode.title)
  ];

  const score = Math.max(matchScore(query, haystack), matchScore(author, [dataset.podcast.author]));
  if (score <= 0) {
    return res.json({ matches: [] });
  }

  return res.json({ matches: [toAbsMatch(dataset)] });
});

app.get('/podcast/norm-macdonald-live', (_req, res) => {
  const dataset = loadDataset();
  if (!dataset) {
    return res.status(500).json({ error: 'Dataset not found. Run `make scrape` first.' });
  }
  return res.json(dataset);
});

app.get('/rss/norm-macdonald-live.xml', (_req, res) => {
  const dataset = loadDataset();
  if (!dataset) {
    return res.status(500).type('application/xml').send('<error>Dataset not found. Run make scrape first.</error>');
  }

  // Ensure generated feed points to this running host.
  dataset.podcast.feedUrl = `${publicBaseUrl}/rss/norm-macdonald-live.xml`;

  return res.type('application/xml').send(buildRss(dataset));
});

app.listen(port, () => {
  console.log(`abs-norm listening on ${publicBaseUrl}`);
});
