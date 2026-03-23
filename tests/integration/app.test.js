import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { XMLParser } from 'fast-xml-parser';
import { createApp } from '../../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.resolve(__dirname, '..', '..', 'data', 'norm-macdonald-live.json');

function buildTestApp() {
  return createApp({
    dataPath,
    publicBaseUrl: 'http://localhost:8042'
  });
}

describe('HTTP integration', () => {
  it('health endpoint returns ok', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('search returns one podcast match for relevant query', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .get('/search')
      .query({ mediaType: 'podcast', query: 'norm macdonald live' });

    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(1);
    expect(res.body.matches[0].title).toBe('Norm Macdonald Live');
    expect(res.body.matches[0].feedUrl).toBe('http://localhost:8042/rss/norm-macdonald-live.xml');
    expect(res.body.matches[0].episodes).toHaveLength(39);
  });

  it('search supports title query parameter used by some metadata clients', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .get('/search')
      .query({ mediaType: 'podcast', title: 'norm macdonald live' });

    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(1);
    expect(res.body.matches[0].title).toBe('Norm Macdonald Live');
  });

  it('search returns no matches for wrong media type', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .get('/search')
      .query({ mediaType: 'book', query: 'norm macdonald live' });

    expect(res.status).toBe(200);
    expect(res.body.matches).toEqual([]);
  });

  it('podcast endpoint returns full metadata payload', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/podcast/norm-macdonald-live');

    expect(res.status).toBe(200);
    expect(res.body.podcast.title).toBe('Norm Macdonald Live');
    expect(res.body.episodes).toHaveLength(39);

    const last = res.body.episodes[res.body.episodes.length - 1];
    expect(last.title).toBe('Jim Carrey');
  });

  it('rss endpoint serves well-formed XML with 39 items', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/rss/norm-macdonald-live.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(res.text);

    expect(parsed.rss.channel.title).toBe('Norm Macdonald Live');
    expect(parsed.rss.channel.image.url).toBe('https://normmacdonaldarchive.com/og-image.png');
    expect(parsed.rss.channel.item).toHaveLength(39);
  });

  it('returns explicit empty matches for unrelated query', async () => {
    const app = buildTestApp();
    const res = await request(app)
      .get('/search')
      .query({ mediaType: 'podcast', query: 'zzzzzz-not-a-real-term' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ matches: [] });
  });
});

describe('HTTP integration without dataset', () => {
  function buildMissingDatasetApp() {
    return createApp({
      dataPath: '/tmp/definitely-missing-abs-norm.json',
      publicBaseUrl: 'http://localhost:8042'
    });
  }

  it('search returns 500 when dataset is missing', async () => {
    const app = buildMissingDatasetApp();
    const res = await request(app).get('/search').query({ mediaType: 'podcast', query: 'norm' });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Dataset not found');
  });

  it('podcast endpoint returns 500 when dataset is missing', async () => {
    const app = buildMissingDatasetApp();
    const res = await request(app).get('/podcast/norm-macdonald-live');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Dataset not found');
  });

  it('rss endpoint returns 500 when dataset is missing', async () => {
    const app = buildMissingDatasetApp();
    const res = await request(app).get('/rss/norm-macdonald-live.xml');

    expect(res.status).toBe(500);
    expect(res.text).toContain('Dataset not found');
  });
});
