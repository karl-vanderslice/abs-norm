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
  const releaseDate = new Date(podcast.releaseDate);
  const publishedYear = Number.isNaN(releaseDate.getTime()) ? undefined : String(releaseDate.getUTCFullYear());

  const episodes = dataset.episodes.map((episode) => ({
    ...episode,
    title: episode.friendlyTitle || episode.fileTitle || episode.title,
    displayTitle: episode.fileTitle || episode.title,
    subtitle: episode.guest || episode.title || '',
    summary: episode.description || '',
    publishedDate: episode.publishedDate || episode.releaseDate,
    explicit: podcast.explicit,
    image: episode.thumbnail || podcast.cover
  }));

  return {
    title: podcast.title,
    subtitle: podcast.subtitle,
    author: podcast.author,
    narrator: podcast.author,
    description: podcast.description,
    cover: podcast.cover,
    image: podcast.cover,
    genres: podcast.genres,
    tags: podcast.tags,
    language: podcast.language,
    explicit: podcast.explicit,
    publisher: podcast.publisher,
    publishedYear,
    id: podcast.itunesId,
    itunesId: podcast.itunesId,
    itunesPageUrl: podcast.itunesPageUrl,
    feedUrl: podcast.feedUrl,
    rssFeedUrl: podcast.feedUrl,
    releaseDate: podcast.releaseDate,
    type: podcast.type,
    mediaType: 'podcast',
    numEpisodes: dataset.episodes.length,
    episodes,
    source: podcast.source
  };
}

export function buildRss(dataset) {
  const podcast = dataset.podcast;
  const toSubtitle = (value, limit = 220) => {
    const normalized = (value || '').toString().replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit - 1).trimEnd()}…`;
  };

  const items = dataset.episodes
    .map((episode) => {
      const enclosureUrl = episode.mediaUrl || episode.pageUrl;
      const enclosureType = episode.mediaUrl?.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'text/html';
      const guid = episode.guid || episode.slug;
      const episodeTitle = episode.friendlyTitle || episode.fileTitle || episode.title;
      const summary = episode.description || '';

      return [
        '    <item>',
        `      <title>${escapeXml(episodeTitle)}</title>`,
        `      <description>${escapeXml(summary)}</description>`,
        `      <content:encoded><![CDATA[${summary.replaceAll(']]>', ']]]]><![CDATA[>')}]]></content:encoded>`,
        `      <pubDate>${escapeXml(toRfc2822(episode.releaseDate))}</pubDate>`,
        `      <guid isPermaLink="false">${escapeXml(guid)}</guid>`,
        `      <link>${escapeXml(episode.pageUrl)}</link>`,
        `      <enclosure url="${escapeXml(enclosureUrl)}" type="${escapeXml(enclosureType)}" length="0" />`,
        `      <itunes:author>${escapeXml(podcast.author)}</itunes:author>`,
        `      <itunes:summary>${escapeXml(summary)}</itunes:summary>`,
        `      <itunes:subtitle>${escapeXml(toSubtitle(summary) || episode.guest || '')}</itunes:subtitle>`,
        `      <itunes:episode>${episode.episodeNumber}</itunes:episode>`,
        `      <itunes:season>${episode.season}</itunes:season>`,
        '      <itunes:episodeType>full</itunes:episodeType>',
        `      <itunes:explicit>${podcast.explicit ? 'yes' : 'no'}</itunes:explicit>`,
        `      <itunes:image href="${escapeXml(episode.thumbnail || podcast.cover)}" />`,
        '    </item>'
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(podcast.title)}</title>`,
    `    <link>${escapeXml(podcast.itunesPageUrl)}</link>`,
    `    <atom:link href="${escapeXml(podcast.feedUrl)}" rel="self" type="application/rss+xml" />`,
    `    <description>${escapeXml(podcast.description)}</description>`,
    `    <language>${escapeXml(podcast.language)}</language>`,
    `    <pubDate>${escapeXml(toRfc2822(podcast.releaseDate))}</pubDate>`,
    `    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`,
    '    <generator>abs-norm</generator>',
    '    <image>',
    `      <url>${escapeXml(podcast.cover)}</url>`,
    `      <title>${escapeXml(podcast.title)}</title>`,
    `      <link>${escapeXml(podcast.itunesPageUrl)}</link>`,
    '    </image>',
    `    <itunes:author>${escapeXml(podcast.author)}</itunes:author>`,
    `    <itunes:summary>${escapeXml(podcast.description)}</itunes:summary>`,
    `    <itunes:subtitle>${escapeXml(podcast.subtitle || '')}</itunes:subtitle>`,
    `    <itunes:explicit>${podcast.explicit ? 'yes' : 'no'}</itunes:explicit>`,
    `    <itunes:type>${escapeXml(podcast.type || 'episodic')}</itunes:type>`,
    `    <itunes:image href="${escapeXml(podcast.cover)}" />`,
    ...podcast.genres.map((genre) => `    <itunes:category text="${escapeXml(genre)}" />`),
    items,
    '  </channel>',
    '</rss>'
  ].join('\n');
}
