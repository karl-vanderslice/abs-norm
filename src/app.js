import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDatasetFromPath } from './dataset.js';
import { buildRss, matchScore, normalize, toAbsMatch } from './metadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_DIR = path.resolve(__dirname, '..', 'static');

function withRuntimeFeedUrl(dataset, publicBaseUrl) {
  const feedUrl = `${publicBaseUrl}/rss/norm-macdonald-live.xml`;
  const cover = `${publicBaseUrl}/assets/norm-macdonald-live.jpg`;
  return {
    ...dataset,
    podcast: {
      ...dataset.podcast,
      feedUrl,
      cover
    },
    episodes: dataset.episodes.map((episode) => ({
      ...episode,
      thumbnail: cover
    }))
  };
}

export function createApp({ dataPath, publicBaseUrl }) {
  const app = express();

  app.use('/assets', express.static(STATIC_DIR));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/search', (req, res) => {
    const dataset = loadDatasetFromPath(dataPath);
    if (!dataset) {
      return res.status(500).json({ error: 'Dataset not found. Run `make scrape` first.' });
    }
    const runtimeDataset = withRuntimeFeedUrl(dataset, publicBaseUrl);

    const mediaType = normalize(req.query.mediaType);
    if (mediaType && mediaType !== 'podcast') {
      return res.json({ matches: [] });
    }

    const query = (req.query.query || req.query.title || '').toString();
    const author = (req.query.author || '').toString();

    const haystack = [
      runtimeDataset.podcast.title,
      runtimeDataset.podcast.subtitle,
      runtimeDataset.podcast.author,
      ...runtimeDataset.podcast.tags,
      ...runtimeDataset.podcast.genres,
      ...runtimeDataset.episodes.map((episode) => episode.title)
    ];

    const titleScore = query ? matchScore(query, haystack) : 0;
    const authorScore = author ? matchScore(author, [runtimeDataset.podcast.author]) : 0;
    const score = Math.max(titleScore, authorScore);
    if (score <= 0) {
      return res.json({ matches: [] });
    }

    return res.json({ matches: [toAbsMatch(runtimeDataset)] });
  });

  app.get('/podcast/norm-macdonald-live', (_req, res) => {
    const dataset = loadDatasetFromPath(dataPath);
    if (!dataset) {
      return res.status(500).json({ error: 'Dataset not found. Run `make scrape` first.' });
    }

    return res.json(withRuntimeFeedUrl(dataset, publicBaseUrl));
  });

  app.get('/rss/norm-macdonald-live.xml', (_req, res) => {
    const dataset = loadDatasetFromPath(dataPath);
    if (!dataset) {
      return res.status(500).type('application/xml').send('<error>Dataset not found. Run make scrape first.</error>');
    }

    const runtimeDataset = withRuntimeFeedUrl(dataset, publicBaseUrl);
    return res.type('application/xml').send(buildRss(runtimeDataset));
  });

  return app;
}
