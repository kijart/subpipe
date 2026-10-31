# SubPipe <!-- omit in toc -->

[![GitHub Container Registry](https://img.shields.io/badge/ghcr-images-success.svg?logo=GitHub)](https://github.com/users/kijart/packages/container/package/subpipe)
[![Docker Hub](https://img.shields.io/badge/dockerhub-images-success.svg?logo=Docker)](https://hub.docker.com/r/kijart/subpipe)
[![Tag new version](https://github.com/kijart/subpipe/actions/workflows/tag-version.yml/badge.svg)](https://github.com/kijart/subpipe/actions/workflows/tag-version.yml)
[![Deploy to GitHub Pages](https://github.com/kijart/subpipe/actions/workflows/pages.yml/badge.svg)](https://github.com/kijart/subpipe/actions/workflows/pages.yml)
[![Publish container image](https://github.com/kijart/subpipe/actions/workflows/publish-image.yml/badge.svg)](https://github.com/kijart/subpipe/actions/workflows/publish-image.yml)
[![Dependabot Updates](https://github.com/kijart/subpipe/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/kijart/subpipe/actions/workflows/dependabot/dependabot-updates)
[![License: MIT](https://img.shields.io/github/license/kijart/subpipe)](LICENSE)

A small, browser-only subscription manager for [NewPipe](https://newpipe.net/).

Load a NewPipe subscriptions export, edit it — add, rename, remove, merge, sort — and download a file NewPipe can import again. No backend, no build step, no dependencies.

## Contents <!-- omit in toc -->

- [Features](#features)
- [Usage](#usage)
- [Running locally](#running-locally)
- [Docker](#docker)
- [Deployment](#deployment)
  - [Versioning](#versioning)
  - [Tagging workflow setup](#tagging-workflow-setup)
  - [GitHub Pages](#github-pages)
  - [Container images](#container-images)
  - [GitHub releases](#github-releases)
- [Search servers](#search-servers)
- [Privacy](#privacy)
- [Export format](#export-format)
- [Project structure](#project-structure)
- [AI assistance](#ai-assistance)
- [License](#license)
- [Disclaimer](#disclaimer)

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
docker compose up -d --build # build from source; or: podman compose up -d --build
docker compose up -d          # or: pull the published image from Docker Hub
```

The service sets both `build` and `image: docker.io/kijart/subpipe:latest`: without `--build` Compose pulls the image if it isn't present locally, and with `--build` it builds from source and tags the result with that same name. Run `docker compose pull` to update to the latest published version.

Then open <http://localhost:8080>.

Without Compose:

```sh
docker build -t subpipe . # or: podman build -t subpipe .
# optional: --build-arg VERSION=1.0.0 sets the version shown in the footer (default: none)
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
- sends security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, and a CSP that blocks embedding the app in frames);
- serves `index.html` with `Cache-Control: no-cache`, so a new version is picked up right away, and caches the other files for an hour;
- exposes `/healthz` for the built-in health check.

## Deployment

The app is deployed to GitHub Pages and published as a container image automatically when a version is released (see below). It can also be hosted on any static host (Netlify, Cloudflare Pages, …): upload the contents of `src/`.

### Versioning

The app follows [Semantic Versioning](https://semver.org/). Versions are git tags in the form `x.y.z`:

- **MAJOR**: incompatible changes, e.g. data saved in the browser (list, servers, theme) can no longer be read.
- **MINOR**: new features that keep compatibility.
- **PATCH**: bug fixes and small adjustments.

To release a version, run the [Tag new version](.github/workflows/tag-version.yml) workflow (**Actions → Tag new version → Run workflow**) from `master` and choose the part to increase: `major`, `minor` (default) or `patch`. It takes the highest `x.y.z` tag, increases it (`1.4.2` becomes `2.0.0`, `1.5.0` or `1.4.3`) and pushes the new tag on the latest `master` commit. It fails if that commit already has a version tag.

You can also tag a commit by hand:

```sh
git tag -a 1.0.0 -m "1.0.0"
git push --follow-tags
```

Pushing the tag deploys that version to GitHub Pages, publishes its [container images](#container-images) and creates a [GitHub release](#github-releases).

The tag is the only place the version lives. The footer of `src/index.html` holds the placeholder `<span id="version">dev</span>`, and the Pages and container workflows replace it with the tag when they publish, so there is no version number to bump by hand. Running the app from the repository shows `dev`; images built from `master` show the short commit SHA.

### Tagging workflow setup

Tags pushed with the workflow's own `GITHUB_TOKEN` do not trigger other workflows, so [Tag new version](.github/workflows/tag-version.yml) pushes the tag with a short-lived token from a GitHub App. One-time setup:

1. **Settings (your account) → Developer settings → GitHub Apps → New GitHub App:** give it a name (e.g. `subpipe-release`) and the repository URL as homepage, uncheck **Webhook → Active**, set **Repository permissions → Contents** to **Read and write**, and choose **Only on this account**.
2. On the app's page, **Private keys → Generate a private key** (downloads a `.pem` file).
3. **Install App** → your account → **Only select repositories** → this repository.
4. In this repository, **Settings → Secrets and variables → Actions:** add the variable `RELEASE_APP_CLIENT_ID` (the app's **Client ID**, on the **Variables** tab) and the secret `RELEASE_APP_PRIVATE_KEY` (the whole contents of the `.pem` file, on the **Secrets** tab). Then delete the local `.pem` file.

The tag is pushed by `<app-name>[bot]`. Only users with write access to the repository can run the workflow.

### GitHub Pages

The [Deploy to GitHub Pages](.github/workflows/pages.yml) workflow runs on every `x.y.z` tag. It:

1. fails if it is not run from a version tag;
2. publishes only the app files (`src/` and `LICENSE`, no `README.md` or Docker files), with the tag as the version shown in the footer;
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

1. builds the image and runs a smoke test (the container starts with the same restrictions Compose uses, passes its health check and serves the app with the right version in the footer) before pushing anything;
2. pushes every platform with OCI labels and annotations (source, version, revision, license), an SBOM and a build provenance attestation, using actions pinned to commit SHAs.

One-time setup in the repository:

1. Create a Docker Hub [access token](https://docs.docker.com/security/for-developers/access-tokens/) with **Read & Write** permission.
2. **Settings → Secrets and variables → Actions:** add the variable `DOCKERHUB_USERNAME` (your Docker Hub user, on the **Variables** tab) and the secret `DOCKERHUB_TOKEN` (the token, on the **Secrets** tab).
3. After the first run, open the package on GitHub (**Packages → subpipe → Package settings**) and change its visibility to **Public**, so the image can be pulled without logging in. GHCR uses the workflow's `GITHUB_TOKEN`, so it needs no secret.

### GitHub releases

The [Create GitHub release](.github/workflows/release.yml) workflow runs on every `x.y.z` tag and creates a release named after the tag, with notes generated from the changes since the previous version. If the release already exists, it does nothing, so re-pushing a tag is safe. It needs no setup.

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

```text
.
├── src/                   # The app, published as is (site root)
│   ├── index.html         # Page markup and Content Security Policy
│   ├── css/
│   │   └── styles.css     # Styles by Atomic Design level (light/dark themes)
│   ├── js/
│   │   ├── core.js        # NewPipe export parsing and writing, YouTube URL normalization,
│   │   │                  # duplicate detection, merge and sort (no DOM)
│   │   ├── channels.js    # Invidious / Piped client: search, lookup, server fallback (no DOM)
│   │   ├── theme.js       # Light / dark / auto theme toggle, applied before first paint
│   │   └── app.js         # UI: rendering, file open/merge/export, search, avatars, toasts
│   │                      # and localStorage persistence
│   └── img/
│       └── favicon.svg    # Icon
├── LICENSE                # MIT license (also published to GitHub Pages)
├── Dockerfile             # Container image (Docker/Podman)
├── compose.yaml           # Runs the container with Compose
├── container/
│   └── nginx/             # Mirrors /etc/nginx/ in the image
│       ├── conf.d/default.conf             # Server: caching, health check
│       └── snippets/security-headers.conf  # Headers shared by every location
└── .github/
    ├── dependabot.yml     # Weekly updates for actions and the base image
    └── workflows/
        ├── pages.yml          # Deploys version tags to GitHub Pages
        ├── publish-image.yml  # Publishes container images to GHCR and Docker Hub
        ├── release.yml        # Creates a GitHub release for each version tag
        └── tag-version.yml    # Pushes the next major / minor / patch version tag
```

## AI assistance

This project was developed with the help of AI coding assistants, used to generate and refactor code. All code has been manually reviewed and tested; the design, decisions and responsibility remain with the author.

## License

[MIT](LICENSE)

## Disclaimer

SubPipe is an independent project. It is not affiliated with NewPipe, YouTube, Invidious or Piped.
