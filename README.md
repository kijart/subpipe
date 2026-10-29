# SubPipe

A small, browser-only subscription manager for [NewPipe](https://newpipe.net/).

Load a NewPipe subscriptions export, edit it — add, rename, remove, merge, sort — and download a file NewPipe can import again. No backend, no build step, no dependencies.

## Features

- **Open or drop** a NewPipe `.json` export.
- **Merge** another export into the current list; channels already present are skipped.
- **Search YouTube channels** through public [Invidious](https://invidious.io/) or [Piped](https://github.com/TeamPiped/Piped) instances, or paste a channel URL, `@handle` or `UC…` channel ID.
- **Add manually** when search is unavailable.
- **Rename, remove, filter and sort A–Z** your subscriptions.
- **Channel avatars** fetched on demand and cached in your browser.
- **Light, dark or automatic theme**, remembered in your browser.
- **Export JSON** in the same format NewPipe writes (`newpipe_subscriptions_YYYYMMDDHHMM.json`).

## Usage

1. In NewPipe, go to **Subscriptions → ⋮ → Export to** and save the `.json` file.
2. Open SubPipe and drop the file onto the page, or click **Open file**.
3. Edit the list.
4. Click **Export JSON**.
5. In NewPipe, go to **Subscriptions → ⋮ → Import from → Previous export** and pick the downloaded file.

## Running locally

SubPipe is a static site; everything it serves lives in `src/`. Open `src/index.html` directly, or serve that folder with any static server:

```sh
python3 -m http.server 8000 --directory src
# then open http://localhost:8000
```

## Docker

The image serves `src/` with [nginx-unprivileged](https://hub.docker.com/r/nginxinc/nginx-unprivileged) on port 8080, as a non-root user.

```sh
docker compose up -d --build
# then open http://localhost:8080
```

Without Compose:

```sh
docker build -t subpipe .
docker run --rm -p 8080:8080 subpipe
```

## Deployment

The app is deployed to GitHub Pages automatically when a version is released (see below). It can also be hosted on any static host (Netlify, Cloudflare Pages, …): upload the contents of `src/`.

### Versioning

The app follows [Semantic Versioning](https://semver.org/). Versions are git tags in the form `x.y.z`:

- **MAJOR**: incompatible changes, e.g. data saved in the browser (list, servers, theme) can no longer be read.
- **MINOR**: new features that keep compatibility.
- **PATCH**: bug fixes and small adjustments.

To release a version, tag the commit and push the tag:

```sh
git tag -a 1.0.0 -m "1.0.0"
git push --follow-tags
```

Pushing the tag deploys that version to GitHub Pages.

### GitHub Pages

The [Deploy to GitHub Pages](.github/workflows/pages.yml) workflow runs on every `x.y.z` tag. It:

1. fails if it is not run from a version tag;
2. publishes only the app files (`src/` and `LICENSE`, no `README.md` or Docker files);
3. deploys with the official Pages actions, pinned to commit SHAs and with the minimum permissions needed.

To redeploy an existing version, run the workflow manually (**Actions → Deploy to GitHub Pages → Run workflow**) and choose the version tag in **Use workflow from**. Runs from a branch are rejected.

One-time setup in the repository:

1. **Settings → Pages → Build and deployment → Source:** select **GitHub Actions**.
2. **Settings → Environments → github-pages → Deployment branches and tags:** add a **tag** rule `*.*.*`. By default the environment only allows the default branch, so deployments from tags are rejected until this rule exists.

The app will be available at `https://<user>.github.io/<repo>/`. All paths are relative, so it works from a subpath.

## Search servers

Channel search and avatars use public Invidious / Piped instances, tried in order. You can edit the list in the app under **Search servers (Invidious / Piped)**: one URL per line. Hosts containing `piped` use the Piped API; the rest use the Invidious API.

To find more servers:

- [Invidious instances](https://api.invidious.io/): choose ones with **API** and **CORS** enabled.
- [Piped instances](https://github.com/TeamPiped/documentation/blob/main/content/docs/public-instances/index.md): use the **API URL** column.

Public instances come and go. If search fails, try other servers or use **Add manually**.

## Privacy

- Everything runs in your browser. Your subscription file is never uploaded anywhere.
- The current list, the server list, cached avatars and the theme choice are kept in your browser's `localStorage`.
- Search queries and channel lookups are sent to the Invidious / Piped servers you configure.

## Export format

SubPipe reads and writes NewPipe's subscription export format:

```json
{
  "subscriptions": [
    { "service_id": 0, "url": "https://www.youtube.com/channel/UC…", "name": "Channel name" }
  ],
  "app_version": "0.29.1",
  "app_version_int": 1015
}
```

Subscriptions from other NewPipe services (SoundCloud, PeerTube, etc.) are kept as they are. Search and manual adding only cover YouTube.

## Project structure

```
src/
  index.html            Page markup and Content Security Policy
  css/styles.css        Styles
  js/core.js            NewPipe export parsing and writing, YouTube URL normalization,
                        duplicate detection, merge and sort (no DOM)
  js/channels.js        Invidious / Piped client: channel search and lookup, server
                        fallback, response normalization (no DOM)
  js/theme.js           Light / dark / auto theme toggle, applied before first paint
  js/app.js             UI: rendering, file open/merge/export, search, avatars, toasts
                        and localStorage persistence
  img/favicon.svg       Icon
```

## License

[MIT](LICENSE)

## Disclaimer

SubPipe is an independent project. It is not affiliated with NewPipe, YouTube, Invidious or Piped.
