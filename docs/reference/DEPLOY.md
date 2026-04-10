# Deploying BPscript Web UI

## Overview

BPscript web is a **static site** — no Node.js, no backend, no build step. Just a web server (nginx) serving files.

## File Structure

The entry point is `web/index.html` but it loads resources from parent directories (`../src/`, `../lib/`, `../dist/`). The server must serve the **project root**, not just `web/`.

```
/var/www/bpscript/              <- nginx root
├── web/index.html              <- entry point (URL: /web/)
├── web/demos/*.bps             <- demo scenes
├── web/timeline.js             <- Canvas timeline
├── web/editor/                 <- CodeMirror 6 grammars
├── web/help/reference.json     <- help panel data
├── src/dispatcher/             <- loaded via ../src/
├── src/transpiler/             <- loaded via ../src/
├── lib/*.json                  <- controls, alphabets, tunings, etc.
└── dist/bp3.js, bp3.wasm       <- WASM engine
```

## 1. Clone the repo

```bash
git clone https://github.com/roomi-fields/BPscript.git /var/www/bpscript
```

## 2. Nginx configuration

```nginx
server {
    listen 80;
    server_name bpscript.example.com;
    root /var/www/bpscript;

    # Serve the full project tree
    location / {
        try_files $uri $uri/ =404;
    }

    # WASM MIME type (required for BP3 engine)
    types {
        application/wasm wasm;
    }

    # Redirect / to /web/
    location = / {
        return 301 /web/;
    }

    # No cache during development
    add_header Cache-Control "no-cache";
}
```

## 3. HTTPS (required)

Chrome blocks Web MIDI API and AudioContext on plain HTTP. HTTPS is mandatory.

```bash
certbot --nginx -d bpscript.example.com
```

## 4. Critical requirements

| Requirement | Why |
|-------------|-----|
| MIME type `application/wasm` for `.wasm` files | BP3 engine won't load without it |
| HTTPS | Web MIDI API and AudioContext require secure context |
| Serve from project root, not `web/` | `index.html` loads `../src/`, `../lib/`, `../dist/` |
| No build step | Files are served as-is (ES modules, no bundler) |

## 5. Update

```bash
cd /var/www/bpscript && git pull
```

## 6. GitHub Pages (alternative)

GitHub Pages can also serve the site. Use a GitHub Actions workflow that deploys from the root:

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
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

Access at: `https://roomi-fields.github.io/BPscript/web/`

## 7. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Blank page, console shows WASM error | Missing MIME type for `.wasm` | Add `application/wasm` to nginx types |
| No sound, AudioContext suspended | HTTP instead of HTTPS | Enable HTTPS with certbot |
| MIDI button does nothing | HTTP or unsupported browser | Use Chrome/Edge with HTTPS |
| 404 on `../lib/*.json` | nginx root set to `web/` instead of project root | Set root to `/var/www/bpscript` |
| Fonts don't load | CSP or network issue | DM Sans and IBM Plex Mono load from Google Fonts CDN |
