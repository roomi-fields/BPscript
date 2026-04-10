# Deploying BPscript Web UI

## Overview

BPscript web is a **static site** — no Node.js, no backend, no build step beyond assembling files.

## Build

```bash
./build-web.sh
```

Creates a self-contained `public/` directory with `index.html` at the root and all paths resolved as `./` (no `../` parent references).

```
public/
├── index.html          <- entry point (serves at /)
├── timeline.js
├── editor/             <- CodeMirror 6 grammars
├── help/               <- help panel data
├── demos/*.bps         <- demo scenes
├── src/dispatcher/     <- runtime dispatcher
├── src/transpiler/     <- BPscript compiler
├── lib/*.json          <- controls, alphabets, tunings
└── dist/bp3.js, bp3.wasm  <- WASM engine
```

## Deploy to VPS (nginx)

```bash
# Build
./build-web.sh

# Upload
rsync -av public/ user@vps:/var/www/bpscript/
```

Nginx config:
```nginx
server {
    listen 443 ssl;
    server_name bpscript.example.com;
    root /var/www/bpscript;

    location / {
        try_files $uri $uri/ =404;
    }

    types {
        application/wasm wasm;
    }
}
```

## Deploy to GitHub Pages

```yaml
# .github/workflows/pages.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: ./build-web.sh
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: 'public'
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Requirements

| Requirement | Why |
|-------------|-----|
| HTTPS | Web MIDI API and AudioContext require secure context |
| MIME type `application/wasm` | BP3 WASM engine won't load without it |
| No build tools needed | `build-web.sh` uses only cp/sed |

## Update

```bash
cd /path/to/BPscript && git pull && ./build-web.sh
rsync -av public/ user@vps:/var/www/bpscript/
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page, WASM error | Add `application/wasm` to nginx types |
| No sound | Enable HTTPS (certbot) |
| MIDI button does nothing | Use Chrome/Edge with HTTPS |
| Module specifier error | Run `build-web.sh` — it fixes `../` to `./` |
