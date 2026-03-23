import { describe, expect, it } from 'vitest';
import dataset from '../../data/norm-macdonald-live.json' with { type: 'json' };

describe('dataset schema and invariants', () => {
  it('contains expected podcast-level fields', () => {
    expect(dataset.podcast.title).toBeTruthy();
    expect(dataset.podcast.author).toBeTruthy();
    expect(dataset.podcast.feedUrl).toBeTruthy();
    expect(dataset.podcast.itunesId).toBeTruthy();
    expect(dataset.podcast.language).toBe('en');
    expect(dataset.podcast.explicit).toBeTypeOf('boolean');
    expect(Array.isArray(dataset.podcast.tags)).toBe(true);
    expect(Array.isArray(dataset.podcast.genres)).toBe(true);
  });

  it('has complete 39-episode run with unique slugs and guids', () => {
    expect(dataset.episodes).toHaveLength(39);

    const slugs = new Set(dataset.episodes.map((e) => e.slug));
    const guids = new Set(dataset.episodes.map((e) => e.guid));

    expect(slugs.size).toBe(39);
    expect(guids.size).toBe(39);
  });

  it('ensures each episode has required metadata and thumbnail/media URLs', () => {
    for (const ep of dataset.episodes) {
      expect(ep.title).toBeTruthy();
      expect(ep.guest).toBeTruthy();
      expect(ep.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ep.description).toBeTruthy();
      expect(ep.pageUrl).toMatch(/^https:\/\//);
      expect(ep.thumbnail).toMatch(/^https:\/\//);
      expect(ep.mediaUrl.length).toBeGreaterThan(0);
      expect(ep.season).toBeGreaterThanOrEqual(1);
      expect(ep.episodeNumber).toBeGreaterThanOrEqual(1);
    }
  });
});
