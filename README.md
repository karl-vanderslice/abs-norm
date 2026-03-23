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

1. Start this service.
2. In Audiobookshelf, go to Server Settings -> Metadata Tools -> Custom Metadata Providers.
3. Add `http://<your-host>:8042` as a provider for media type `podcast`.
4. Match metadata on your Norm Macdonald Live podcast item.

Optional direct feed import URL:

`http://<your-host>:8042/rss/norm-macdonald-live.xml`

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

## Notes For Self-Hosting

- Intended for private networks and trusted environments.
- If you publish this beyond your LAN, put it behind your normal reverse proxy and access controls.
- The upstream catalog source can change over time, so refresh with `make scrape` when needed.
