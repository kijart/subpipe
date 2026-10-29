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

To host it, publish the contents of `src/` on GitHub Pages or any static host.

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
