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

The repository includes a [`Dockerfile`](Dockerfile) and a [`compose.yaml`](compose.yaml) that serve `src/` with an unprivileged nginx on port 8080. With Compose:

```sh
docker compose up -d --build # or: podman compose up -d --build
```

Then open <http://localhost:8080>.

Without Compose:

```sh
docker build -t subpipe . # or: podman build -t subpipe .
docker run -d --rm -p 8080:8080 --read-only --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges subpipe
```

To skip the build, use a prebuilt image from GitHub Container Registry or Docker Hub (see [Container images](#container-images) for the available tags):

```sh
docker run -d --rm -p 8080:8080 --read-only --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges ghcr.io/kijart/subpipe:latest
```

The container only serves the static files; your subscriptions are still processed in your browser and never reach it. It also:

- runs as a non-root user, with a read-only filesystem and no Linux capabilities (Compose sets this up for you);
- has a built-in health check that requests the home page.

## Deployment

The app is deployed to GitHub Pages and published as a container image automatically when a version is released (see below). It can also be hosted on any static host (Netlify, Cloudflare Pages, …): upload the contents of `src/`.

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

Pushing the tag deploys that version to GitHub Pages and publishes its [container images](#container-images).

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

### Container images

The [Publish container image](.github/workflows/publish-image.yml) workflow builds the image and pushes it to two registries:

- GitHub Container Registry: [`ghcr.io/kijart/subpipe`](https://github.com/kijart/subpipe/pkgs/container/subpipe)
- Docker Hub: [`docker.io/kijart/subpipe`](https://hub.docker.com/r/kijart/subpipe)

Both registries get the same tags:

| Tag      | Example  | Published on           | Points to                                          |
| -------- | -------- | ---------------------- | -------------------------------------------------- |
| `latest` | `latest` | every push to `master` | the latest `master`, which may not be released yet |
| `x.y.z`  | `1.1.0`  | every `x.y.z` tag      | that exact version; never changes                  |
| `x.y`    | `1.1`    | every `x.y.z` tag      | the latest patch release of `x.y`                  |
| `x`      | `1`      | every `x.y.z` tag      | the latest minor or patch release of `x`           |

For a stable deployment, use `x.y.z` or `x`; `latest` follows development. Pushes to `master` that only change files outside the image (README, other workflows) do not publish a new `latest`.

Every tag is a multi-architecture image, so Docker and Podman pull the right variant automatically:

| Platform       | Typical hardware                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `linux/amd64`  | Most PCs and servers (Intel, AMD)                                                                 |
| `linux/arm64`  | Apple Silicon (through Docker Desktop or Podman), Raspberry Pi 4/5 with a 64-bit OS, AWS Graviton |
| `linux/arm/v7` | Raspberry Pi 2/3/4 with a 32-bit OS                                                               |

On every run, the workflow:

1. builds the image and runs a smoke test (the container starts with the same restrictions Compose uses, passes its health check and serves the app) before pushing anything;
2. pushes every platform with OCI labels and annotations (source, version, revision, license), an SBOM and a build provenance attestation, using actions pinned to commit SHAs.

One-time setup in the repository:

1. Create a Docker Hub [access token](https://docs.docker.com/security/for-developers/access-tokens/) with **Read & Write** permission.
2. **Settings → Secrets and variables → Actions:** add the variable `DOCKERHUB_USERNAME` (your Docker Hub user, on the **Variables** tab) and the secret `DOCKERHUB_TOKEN` (the token, on the **Secrets** tab).
3. After the first run, open the package on GitHub (**Packages → subpipe → Package settings**) and change its visibility to **Public**, so the image can be pulled without logging in. GHCR uses the workflow's `GITHUB_TOKEN`, so it needs no secret.

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
