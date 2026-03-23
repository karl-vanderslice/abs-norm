SHELL := /usr/bin/env bash

NIX_DEV := nix develop "path:$(CURDIR)" -c

.PHONY: install update-lock dev start scrape lint test test-unit test-integration test-smoke coverage precommit-install precommit-run container-build-nix container-load-nix compose-up

install:
	$(NIX_DEV) npm ci

update-lock:
	$(NIX_DEV) npm install

dev:
	$(NIX_DEV) npm run dev

start:
	$(NIX_DEV) npm run start

scrape:
	$(NIX_DEV) npm run scrape

lint:
	$(NIX_DEV) npm run lint

test:
	$(NIX_DEV) npm test

test-unit:
	$(NIX_DEV) npm run test:unit

test-integration:
	$(NIX_DEV) npm run test:integration

test-smoke:
	$(NIX_DEV) npm run test:smoke

coverage:
	$(NIX_DEV) npm run coverage

precommit-install:
	$(NIX_DEV) npm run precommit:install

precommit-run:
	$(NIX_DEV) npm run precommit:run

container-build-nix:
	nix build "path:$(CURDIR)#containerImage"

container-load-nix:
	docker load < result

compose-up:
	docker-compose up
