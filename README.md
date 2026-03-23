# abs-norm

abs-norm is a small metadata service for self-hosted Audiobookshelf.

It is purpose-built for the Norm Macdonald Live catalog and is intended for homelab or other trusted internal infrastructure.

## What It Does

- Exposes an Audiobookshelf custom metadata provider endpoint at `GET /search`
- Serves an RSS feed at `GET /rss/norm-macdonald-live.xml`
- Returns podcast and episode metadata from a local JSON dataset

This project is opinionated and intentionally narrow in scope.

## Quick Start (Nix + Make)

All project commands run through `nix develop` via the Makefile.

```bash
make install
make scrape
make start
```

Default port is `8042`.

Health check:

```bash
curl http://localhost:8042/healthz
```

## Use With Audiobookshelf

### 1) Start abs-norm and verify reachability

Start this service and confirm Audiobookshelf can reach it:

```bash
curl http://<abs-norm-host>:8042/healthz
```

Expected response:

```json
{"ok":true}
```

### 2) Add as a custom metadata provider

In Audiobookshelf:

1. Go to Server Settings -> Metadata Tools -> Custom Metadata Providers.
2. Add provider base URL: `http://<abs-norm-host>:8042`
3. Set media type to `podcast`.
4. Save.

abs-norm implements the custom provider search endpoint at:

`GET /search`

### 3) Use the provider on a podcast item

1. Open your podcast item in Audiobookshelf.
2. Open the metadata/match dialog for that item.
3. Select your custom provider.
4. Search for `Norm Macdonald Live` (or use Quick Match).
5. Apply the match.

The provider returns podcast-level metadata plus episode metadata (description, image, season/episode info, and related fields).

### 4) (Optional) Import as RSS feed directly

If you want feed-based import instead of matching through metadata provider, use:

`http://<abs-norm-host>:8042/rss/norm-macdonald-live.xml`

### Troubleshooting

- If Audiobookshelf logs show `ssrf-req-filter` blocked calls to private/container IPs, whitelist the provider host in Audiobookshelf:
	- `SSRF_REQUEST_FILTER_WHITELIST=<abs-norm-hostname>`
- If metadata match shows no results, verify query term includes `Norm Macdonald Live` and that ABS can resolve/reach `<abs-norm-host>`.
- Ensure `PUBLIC_BASE_URL` is set correctly for your deployment so feed URLs are emitted with the correct host.

## Docker Compose

Run provider only:

```bash
docker-compose up
```

Run provider + Audiobookshelf stack:

```bash
ABS_NORM_PUBLIC_BASE_URL=http://abs-norm:8042 docker-compose --profile stack up
```

The compose network allows Audiobookshelf to reach this service at `http://abs-norm:8042`.

## Configuration

- `PORT`: listen port (default `8042`)
- `PUBLIC_BASE_URL`: public base URL used in feed metadata (default `http://localhost:$PORT`)
- `LEGACY_ITUNES_ID`: used during scraping (default `625135046`)
- `LEGACY_ITUNES_PAGE_URL`: used during scraping (default derived from `LEGACY_ITUNES_ID`)

Example:

```bash
PUBLIC_BASE_URL=http://192.168.1.50:8042 make start
```

## Updating The Dataset

Rebuild the local dataset from the upstream archive source:

```bash
make scrape
```

This rewrites `data/norm-macdonald-live.json`.

## Development And Tests

```bash
make lint
make test
```

Other useful targets:

- `make dev`
- `make test-unit`
- `make test-integration`
- `make test-smoke`
- `make coverage`
