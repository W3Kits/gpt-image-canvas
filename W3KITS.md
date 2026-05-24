# W3KITS

## Repositories

- W3Kits fork: `https://github.com/W3Kits/gpt-image-canvas`
- upstream: `https://github.com/mrslimslim/gpt-image-canvas`
- marketplace slug: `gpt-image-canvas`
- published package: `@w3kits/plugin-gpt-image-canvas`
- runtime: `webcontainer`

## What W3Kits Changes

- packages the web app for the shared W3Kits WebContainer runtime
- builds a browser daemon entry under `dist/browser-daemon.js`
- runs the plugin API inside the WebContainer daemon instead of relying on browser-side `fetch` fallback
- routes OpenAI-compatible requests through `W3KITS_OPENAI_BASE_URL`
- keeps the upstream standalone API app out of the WebContainer package because native `better-sqlite3` and `sharp` still block direct boot there
- verifies the W3Kits package shape before publish

## What Stays Upstream-Owned

- canvas UX and editor behavior
- upstream data model where it does not block W3Kits packaging
- non-W3Kits deployment targets

## Build

```bash
pnpm build
pnpm verify:w3kits-package
```
