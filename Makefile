SHELL := /usr/bin/env bash

NIX_DEV := nix develop "path:$(CURDIR)" -c

.PHONY: install dev start scrape lint

install:
	$(NIX_DEV) npm install

dev:
	$(NIX_DEV) npm run dev

start:
	$(NIX_DEV) npm run start

scrape:
	$(NIX_DEV) npm run scrape

lint:
	$(NIX_DEV) npm run lint
