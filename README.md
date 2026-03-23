# abs-norm

Custom Audiobookshelf metadata provider for **Norm Macdonald Live**, using a repeatable flat-file dataset generated from <https://normmacdonaldarchive.com/nml>.

## What This Provides

- Audiobookshelf custom provider endpoint: `GET /search`
- Podcast-level metadata:
  - title
  - author
  - legacy iTunes page URL + iTunes ID
  - RSS feed URL (served by this app)
  - description
  - genres
  - tags
  - release date
  - language
  - explicit flag
  - cover image
- Per-episode metadata:
  - season/episode numbers
  - guest/title
  - release date
  - description
  - page URL
  - media URL (Archive embed URL)
  - thumbnail
- RSS feed endpoint for direct podcast import:
  - `GET /rss/norm-macdonald-live.xml`

## Nix + Make Workflow

```bash
make install
make scrape
make dev
```

The server defaults to port `8042`.

## Environment Variables

- `PORT` (default: `8042`)
- `PUBLIC_BASE_URL` (default: `http://localhost:$PORT`)
- `LEGACY_ITUNES_ID` (used during scraping; default: `625135046`)
- `LEGACY_ITUNES_PAGE_URL` (used during scraping; default derived from `LEGACY_ITUNES_ID`)

Example:

```bash
LEGACY_ITUNES_ID=625135046 make scrape
PUBLIC_BASE_URL=http://192.168.1.50:8042 make start
```

## Audiobookshelf Setup

1. Run the provider:

```bash
make start
```

1. In Audiobookshelf:

- Open Server Settings -> Metadata Tools -> Custom Metadata Providers
- Add provider URL: `http://<your-host>:8042`
- Set media type to `podcast`
- Save

1. For podcast metadata matching:

- Use metadata match for your podcast library item and select this custom provider result.

1. For direct feed ingestion (optional, recommended):

- Add podcast via RSS URL: `http://<your-host>:8042/rss/norm-macdonald-live.xml`

## Data Refresh

To re-scrape and rebuild the flat file:

```bash
make scrape
```

This rewrites `data/norm-macdonald-live.json` from the current archive site.

## Notes

- Audiobookshelf custom provider OpenAPI spec currently defines a book-oriented schema. This provider includes podcast-specific keys (`feedUrl`, `itunesId`, `itunesPageUrl`, `releaseDate`, `explicit`, `episodes`) as extension fields so data remains complete and portable.
- Legacy iTunes identifiers for delisted podcasts may not resolve via Apple APIs anymore.
