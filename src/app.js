import express from 'express';
import { loadDatasetFromPath } from './dataset.js';
import { buildRss, matchScore, normalize, toAbsMatch } from './metadata.js';

export function createApp({ dataPath, publicBaseUrl }) {
  const app = express();

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/search', (req, res) => {
    const dataset = loadDatasetFromPath(dataPath);
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

    const titleScore = query ? matchScore(query, haystack) : 0;
    const authorScore = author ? matchScore(author, [dataset.podcast.author]) : 0;
    const score = Math.max(titleScore, authorScore);
    if (score <= 0) {
      return res.json({ matches: [] });
    }

    return res.json({ matches: [toAbsMatch(dataset)] });
  });

  app.get('/podcast/norm-macdonald-live', (_req, res) => {
    const dataset = loadDatasetFromPath(dataPath);
    if (!dataset) {
      return res.status(500).json({ error: 'Dataset not found. Run `make scrape` first.' });
    }

    return res.json(dataset);
  });

  app.get('/rss/norm-macdonald-live.xml', (_req, res) => {
    const dataset = loadDatasetFromPath(dataPath);
    if (!dataset) {
      return res.status(500).type('application/xml').send('<error>Dataset not found. Run make scrape first.</error>');
    }

    dataset.podcast.feedUrl = `${publicBaseUrl}/rss/norm-macdonald-live.xml`;
    return res.type('application/xml').send(buildRss(dataset));
  });

  return app;
}
