export function normalize(value) {
  return (value || '').toString().toLowerCase().trim();
}

export function escapeXml(value) {
  return (value || '')
    .toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function toRfc2822(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return new Date().toUTCString();
  return date.toUTCString();
}

export function matchScore(query, haystackValues) {
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

export function toAbsMatch(dataset) {
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
    id: podcast.itunesId,
    itunesId: podcast.itunesId,
    itunesPageUrl: podcast.itunesPageUrl,
    feedUrl: podcast.feedUrl,
    releaseDate: podcast.releaseDate,
    type: podcast.type,
    rssFeedUrl: podcast.feedUrl,
    episodes: dataset.episodes,
    source: podcast.source
  };
}

export function buildRss(dataset) {
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
