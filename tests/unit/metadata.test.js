import { describe, expect, it } from 'vitest';
import {
  buildRss,
  escapeXml,
  matchScore,
  normalize,
  toAbsMatch,
  toRfc2822
} from '../../src/metadata.js';
import dataset from '../../data/norm-macdonald-live.json' with { type: 'json' };

describe('metadata helpers', () => {
  it('normalizes casing and whitespace', () => {
    expect(normalize('  NoRm MacDonald LIVE  ')).toBe('norm macdonald live');
  });

  it('escapes XML entities', () => {
    expect(escapeXml('A&B <x> "q"')).toBe('A&amp;B &lt;x&gt; &quot;q&quot;');
  });

  it('formats RFC2822 dates', () => {
    expect(toRfc2822('2013-03-26')).toContain('Tue, 26 Mar 2013');
  });

  it('scores exact query matches highest', () => {
    expect(matchScore('Norm Macdonald Live', ['Norm Macdonald Live'])).toBe(100);
    expect(matchScore('Norm', ['Norm Macdonald Live'])).toBeGreaterThan(0);
    expect(matchScore('zzz', ['Norm Macdonald Live'])).toBe(0);
  });

  it('maps dataset to ABS custom provider shape', () => {
    const match = toAbsMatch(dataset);
    expect(match.title).toBe('Norm Macdonald Live');
    expect(match.feedUrl).toContain('/rss/norm-macdonald-live.xml');
    expect(match.itunesId).toBeTruthy();
    expect(match.episodes).toHaveLength(39);
  });

  it('builds RSS including all 39 items', () => {
    const rss = buildRss(dataset);
    const itemCount = (rss.match(/<item>/g) || []).length;
    expect(itemCount).toBe(39);
    expect(rss).toContain('<itunes:type>episodic</itunes:type>');
    expect(rss).toContain('<title>Norm Macdonald Live</title>');
  });
});
