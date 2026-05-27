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
- starts the packaged daemon only for local/runtime support that still needs WebContainer
- handles W3Kits-owned runtime API routes, including image generation and project/gallery state, in the browser runtime adapter before they reach the WebContainer daemon origin
- routes OpenAI-compatible requests through core with W3Kits runtime-session headers instead of doing daemon-side AI forwarding
- accepts nested OpenAI-compatible image response fields when core returns URLs or provider-specific image objects
- commits generated image assets locally before remote VFS writeback so successful generations are not reported as 502 when remote storage is slow or unavailable
- persists WebContainer daemon state through `/home/agent/.config/gpt-image-canvas`
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

## Release

1. Build and verify this package locally.
2. Publish the reviewed version to npm as `@w3kits/plugin-gpt-image-canvas`.
3. Update `plugin-marketplace/plugins/gpt-image-canvas/manifest.json` to the new npm package version and source commit.
4. Let `plugin-marketplace` CI upload the npm tarball and compiled assets to `https://plugin-gpt-image-canvas.w3kits.com`; this repository does not publish R2 assets directly for the approved marketplace path.
5. Verify the plugin origin serves the new bundle from `index.html` and the marketplace catalog reports the new version.
