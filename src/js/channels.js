(function (root) {
  // Hosts containing "piped" use the Piped API; everything else the Invidious API.
  const DEFAULT_INSTANCES = ["https://invidious.f5.si", "https://api.piped.private.coffee"];
  const TIMEOUT_MS = 8000;

  function instanceType(base) {
    return /piped/i.test(new URL(base).hostname) ? "piped" : "invidious";
  }

  function absolute(url) {
    if (!url) {
      return "";
    }
    return url.startsWith("//") ? `https:${url}` : url;
  }

  // Piped serves avatars through its own proxy (".../ytc/...?host=yt3.googleusercontent.com");
  // point back at Google's CDN so cached URLs survive the instance going away.
  function unproxy(url) {
    try {
      const u = new URL(absolute(url));
      const host = u.searchParams.get("host");
      if (!host || !/googleusercontent\.com$/.test(host)) {
        return u.href;
      }
      u.searchParams.delete("host");
      return `https://${host}${u.pathname}${u.search}`;
    } catch {
      return "";
    }
  }

  function pickThumbnail(thumbs) {
    if (!Array.isArray(thumbs) || !thumbs.length) {
      return "";
    }
    const sorted = thumbs.slice().sort((a, b) => a.width - b.width);
    return absolute((sorted.find((t) => t.width >= 64) || sorted[sorted.length - 1]).url);
  }

  function channelIdFromPath(path) {
    const m = /\/channel\/(UC[\w-]{22})/.exec(path || "");
    return m ? m[1] : null;
  }

  function fromInvidiousSearch(items) {
    return (items || [])
      .filter((i) => i.type === "channel" && i.authorId)
      .map((i) => ({
        id: i.authorId,
        name: String(i.author ?? ""),
        avatar: pickThumbnail(i.authorThumbnails),
        subscribers: i.subCount ?? null,
        handle: i.channelHandle || "",
      }));
  }

  function fromPipedSearch(data) {
    return ((data && data.items) || [])
      .filter((i) => i.type === "channel" && channelIdFromPath(i.url))
      .map((i) => ({
        id: channelIdFromPath(i.url),
        name: String(i.name ?? ""),
        avatar: unproxy(i.thumbnail),
        subscribers: i.subscribers >= 0 ? i.subscribers : null,
        handle: "",
      }));
  }

  function fromInvidiousChannel(d) {
    return { id: d.authorId, name: String(d.author ?? ""), avatar: pickThumbnail(d.authorThumbnails), subscribers: d.subCount ?? null, handle: "" };
  }

  function fromPipedChannel(d) {
    return { id: d.id, name: String(d.name ?? ""), avatar: unproxy(d.avatarUrl), subscribers: d.subscriberCount ?? null, handle: "" };
  }

  async function getJson(url, signal) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    if (signal) {
      signal.addEventListener("abort", onAbort);
    }
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  }

  // Tries each instance in order, starting with the last one that worked.
  function createClient(instances = DEFAULT_INSTANCES) {
    let preferred = 0;

    async function attempt(build, signal) {
      const errors = [];
      for (let n = 0; n < instances.length; n++) {
        const i = (preferred + n) % instances.length;
        const base = instances[i].replace(/\/+$/, "");
        try {
          const result = await build(base, instanceType(base), signal);
          preferred = i;
          return result;
        } catch (e) {
          if (signal && signal.aborted) {
            throw e;
          }
          errors.push(`${base}: ${e.message}`);
        }
      }
      throw new Error(`No server answered (${errors.join("; ") || "no servers configured"}).`);
    }

    function search(query, signal) {
      const q = encodeURIComponent(query);
      return attempt(async (base, type, sig) =>
        type === "piped"
          ? fromPipedSearch(await getJson(`${base}/search?q=${q}&filter=channels`, sig))
          : fromInvidiousSearch(await getJson(`${base}/api/v1/search?q=${q}&type=channel`, sig)), signal);
    }

    function channel(id, signal) {
      return attempt(async (base, type, sig) =>
        type === "piped"
          ? fromPipedChannel(await getJson(`${base}/channel/${id}`, sig))
          : fromInvidiousChannel(await getJson(`${base}/api/v1/channels/${id}`, sig)), signal);
    }

    return { search, channel };
  }

  const api = {
    DEFAULT_INSTANCES,
    instanceType,
    unproxy,
    channelIdFromPath,
    fromInvidiousSearch,
    fromPipedSearch,
    createClient,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.NPChannels = api;
  }
})(this);
