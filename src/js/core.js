(function (root) {
  const YOUTUBE = 0;
  const DEFAULT_VERSION = { app_version: "0.29.1", app_version_int: 1015 };
  const CHANNEL_ID = /^UC[\w-]{22}$/;

  // Returns the canonical https://www.youtube.com/... form NewPipe stores, or null.
  function normalizeYouTubeUrl(input) {
    const value = String(input || "").trim();
    if (!value) {
      return null;
    }
    if (CHANNEL_ID.test(value)) {
      return `https://www.youtube.com/channel/${value}`;
    }
    if (/^@[\w.-]+$/.test(value)) {
      return `https://www.youtube.com/${value}`;
    }

    let url;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      return null;
    }
    if (!/(^|\.)youtube\.com$/i.test(url.hostname)) {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "channel" && CHANNEL_ID.test(parts[1] || "")) {
      return `https://www.youtube.com/channel/${parts[1]}`;
    }
    if (parts[0] && parts[0].startsWith("@") && parts[0].length > 1) {
      return `https://www.youtube.com/${parts[0]}`;
    }
    if ((parts[0] === "c" || parts[0] === "user") && parts[1]) {
      return `https://www.youtube.com/${parts[0]}/${parts[1]}`;
    }
    return null;
  }

  function isWebUrl(value) {
    try {
      return /^https?:$/.test(new URL(value).protocol);
    } catch {
      return false;
    }
  }

  function parseExport(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("The file is not valid JSON.");
    }
    if (!data || !Array.isArray(data.subscriptions)) {
      throw new Error('The file has no "subscriptions" list; is it a NewPipe export?');
    }
    const subscriptions = data.subscriptions
      .filter((s) => s && typeof s.url === "string" && Number.isInteger(s.service_id))
      .map((s) => ({ service_id: s.service_id, url: s.url, name: String(s.name ?? "") }));
    return {
      subscriptions,
      app_version: typeof data.app_version === "string" ? data.app_version : DEFAULT_VERSION.app_version,
      app_version_int: Number.isInteger(data.app_version_int) ? data.app_version_int : DEFAULT_VERSION.app_version_int,
    };
  }

  // Same key order NewPipe writes.
  function serializeExport(state) {
    return JSON.stringify({
      subscriptions: state.subscriptions.map((s) => ({ service_id: s.service_id, url: s.url, name: s.name })),
      app_version: state.app_version,
      app_version_int: state.app_version_int,
    });
  }

  function urlKey(serviceId, url) {
    const normalized = serviceId === YOUTUBE ? normalizeYouTubeUrl(url) : null;
    return (normalized || url).replace(/\/+$/, "").toLowerCase();
  }

  function findDuplicate(subscriptions, serviceId, url) {
    const key = urlKey(serviceId, url);
    return subscriptions.find((s) => s.service_id === serviceId && urlKey(s.service_id, s.url) === key) || null;
  }

  function mergeSubscriptions(current, incoming) {
    const result = current.slice();
    let added = 0;
    for (const s of incoming) {
      if (!findDuplicate(result, s.service_id, s.url)) {
        result.push(s);
        added++;
      }
    }
    return { subscriptions: result, added };
  }

  function sortByName(subscriptions) {
    return subscriptions.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  function exportFileName(date = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `newpipe_subscriptions_${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}${p(date.getHours())}${p(date.getMinutes())}.json`;
  }

  const api = {
    YOUTUBE,
    DEFAULT_VERSION,
    normalizeYouTubeUrl,
    isWebUrl,
    parseExport,
    serializeExport,
    findDuplicate,
    mergeSubscriptions,
    sortByName,
    exportFileName,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.NPCore = api;
  }
})(this);
