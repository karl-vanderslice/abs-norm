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

All `npm` / `npx` operations are expected to run inside `nix develop` (via `make` targets).

```bash
make install
make scrape
make dev
```

The server defaults to port `8042`.

## Containerization

Only Nix-native container builds are supported.

### Build And Run (Nix Image)

Build a Nix-native OCI image tarball:

```bash
nix build .#containerImage
```

Load into Docker and run:

```bash
docker load < result
docker run --rm -p 8042:8042 --name abs-norm abs-norm:nix
```

Compose with the prebuilt Nix image:

```bash
docker-compose up
```

Published image location:

- ghcr.io/karl-vanderslice/abs-norm:latest

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

## Docker Compose: Audiobookshelf + Provider

Bring up both services together:

```bash
ABS_NORM_PUBLIC_BASE_URL=http://abs-norm:8042 docker-compose --profile stack up
```

After startup:

1. Open Audiobookshelf at `http://localhost:13378`
1. Add custom metadata provider URL as `http://abs-norm:8042`
1. Use RSS URL `http://abs-norm:8042/rss/norm-macdonald-live.xml` for in-network ingestion

The compose network lets `audiobookshelf` resolve `abs-norm` by service name.

This is implemented with a single [docker-compose.yml](docker-compose.yml) using Compose profiles (no second compose file needed).

## CI/CD And Publishing

GitHub Actions workflows:

- CI: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Container publish: [.github/workflows/publish-container.yml](.github/workflows/publish-container.yml)

Behavior:

- CI runs lint/tests and builds the Nix app + Nix container image
- CI uploads the built image tarball as a GitHub Actions artifact
- Publish workflow pushes container images to GHCR on `master`/`main` and `v*` tags
- Published tags include `latest`, `sha-<shortsha>`, and the git tag name when the event is a tag

Nix infrastructure actions are pinned to current major releases from Determinate Systems:

- DeterminateSystems/nix-installer-action@v21
- DeterminateSystems/magic-nix-cache-action@v13

## Data Refresh

To re-scrape and rebuild the flat file:

```bash
make scrape
```

This rewrites `data/norm-macdonald-live.json` from the current archive site.

## Pre-commit

Install git hooks:

```bash
make precommit-install
```

Run hooks manually:

```bash
make precommit-run
```

The pre-commit pipeline runs lint + full tests inside `nix develop`.

## Nix-native npm/npx Usage

- Install deps reproducibly: `make install` (`npm ci` inside `nix develop`)
- Update lockfile intentionally: `make update-lock` (`npm install` inside `nix develop`)
- Run scripts with local binaries via npm (npx-equivalent resolution) inside Nix shell through make targets.

## Test Suite

Run all tests:

```bash
make test
```

Breakdown:

- Unit tests: `make test-unit`
- Integration tests (HTTP route behavior): `make test-integration`
- Smoke test (real process + curl/jq endpoint validation): `make test-smoke`
- Coverage: `make coverage`

## Notes

- Audiobookshelf custom provider OpenAPI spec currently defines a book-oriented schema. This provider includes podcast-specific keys (`feedUrl`, `itunesId`, `itunesPageUrl`, `releaseDate`, `explicit`, `episodes`) as extension fields so data remains complete and portable.
- Legacy iTunes identifiers for delisted podcasts may not resolve via Apple APIs anymore.
