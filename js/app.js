const C = window.NPCore;
const N = window.NPChannels;
const STORAGE_KEY = "subpipe";
const AVATARS_KEY = "subpipe:avatars";
const SERVERS_KEY = "subpipe:servers";
const SERVICES = { 0: "YouTube", 1: "SoundCloud", 2: "media.ccc.de", 3: "PeerTube", 4: "Bandcamp" };
const $ = (id) => document.getElementById(id);

let state = load() || { subscriptions: [], ...C.DEFAULT_VERSION };

function load() {
  try { return C.parseExport(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, C.serializeExport(state)); } catch {}
}
function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function validServers(list) {
  return Array.isArray(list) ? list.filter((u) => typeof u === "string" && C.isWebUrl(u)) : [];
}

const storedServers = validServers(readJson(SERVERS_KEY));
let servers = storedServers.length ? storedServers : N.DEFAULT_INSTANCES;
let client = N.createClient(servers);

// Avatars are not part of the export; they are cached per channel ID in this browser only.
const storedAvatars = readJson(AVATARS_KEY);
const avatars = storedAvatars && typeof storedAvatars === "object" && !Array.isArray(storedAvatars) ? storedAvatars : {};
const pending = new Map();
const queue = [];
let active = 0;

function channelId(url) {
  try { return N.channelIdFromPath(new URL(url).pathname); } catch { return null; }
}

function rememberAvatar(id, url) {
  if (!id || !url || avatars[id] === url) return;
  avatars[id] = url;
  writeJson(AVATARS_KEY, avatars);
}

function fetchAvatar(id) {
  if (!pending.has(id)) {
    pending.set(id, new Promise((resolve) => { queue.push({ id, resolve }); pump(); }));
  }
  return pending.get(id);
}

// At most 3 lookups at a time so public servers don't rate-limit us.
function pump() {
  while (active < 3 && queue.length) {
    const { id, resolve } = queue.shift();
    active++;
    client.channel(id)
      .then((ch) => { rememberAvatar(id, ch.avatar); resolve(ch.avatar); })
      .catch(() => { pending.delete(id); resolve(""); })
      .finally(() => { active--; pump(); });
  }
}

function setAvatar(el, src) {
  const img = document.createElement("img");
  img.className = "a-avatar";
  img.alt = "";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.src = src;
  img.addEventListener("error", () => img.replaceWith(el), { once: true });
  el.replaceWith(img);
}

function avatarFor(name, src) {
  const el = document.createElement("span");
  el.className = "a-avatar";
  el.textContent = (name.trim()[0] || "?").toUpperCase();
  if (src) queueMicrotask(() => el.isConnected && setAvatar(el, src));
  return el;
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    const el = entry.target;
    fetchAvatar(el.dataset.channel).then((src) => { if (src && el.isConnected) setAvatar(el, src); });
  }
}, { rootMargin: "200px" });

function say(text, isError = false) {
  const box = $("toasts");
  const toast = document.createElement("div");
  toast.className = isError ? "m-toast m-toast--error" : "m-toast";
  if (isError) toast.setAttribute("role", "alert");
  const msg = document.createElement("span");
  msg.className = "m-toast__message";
  msg.textContent = text;
  const close = document.createElement("button");
  close.className = "a-button m-toast__close";
  close.type = "button";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Dismiss");

  let timer = null;
  const hide = () => {
    clearTimeout(timer);
    toast.classList.add("m-toast--leaving");
    setTimeout(() => toast.remove(), 300);
  };
  const arm = () => { timer = setTimeout(hide, isError ? 6000 : 3500); };
  close.addEventListener("click", hide);
  toast.addEventListener("mouseenter", () => clearTimeout(timer));
  toast.addEventListener("mouseleave", arm);

  toast.append(msg, close);
  box.append(toast);
  while (box.children.length > 4) box.firstElementChild.remove();
  arm();
}

function render() {
  const q = $("filter").value.trim().toLowerCase();
  const list = $("list");
  list.replaceChildren();
  const visible = state.subscriptions.filter((s) => !q || s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
  observer.disconnect();
  for (const s of visible) {
    const li = document.createElement("li");
    li.className = "m-item";
    const id = s.service_id === C.YOUTUBE ? channelId(s.url) : null;
    const avatar = avatarFor(s.name, id && avatars[id]);
    if (id && !avatars[id]) { avatar.dataset.channel = id; observer.observe(avatar); }
    const info = document.createElement("div");
    info.className = "m-item__info";
    const name = document.createElement("input");
    name.className = "a-input a-input--inline";
    name.value = s.name;
    name.setAttribute("aria-label", "Channel name");
    name.addEventListener("change", () => { s.name = name.value.trim() || s.name; name.value = s.name; save(); });
    const url = document.createElement("a");
    url.className = "a-link--muted";
    if (C.isWebUrl(s.url)) url.href = s.url;
    url.target = "_blank";
    url.rel = "noopener noreferrer";
    url.textContent = s.url;
    info.append(name, url);
    const badge = document.createElement("span");
    badge.className = "a-badge";
    badge.textContent = SERVICES[s.service_id] || `Service ${s.service_id}`;
    const del = document.createElement("button");
    del.className = "a-button a-button--danger";
    del.title = `Remove ${s.name}`;
    del.textContent = "✕";
    del.addEventListener("click", () => {
      state.subscriptions = state.subscriptions.filter((x) => x !== s);
      save(); render(); say(`Removed “${s.name}”.`);
    });
    li.append(avatar, info, badge, del);
    list.append(li);
  }
  if (!visible.length) {
    const li = document.createElement("li");
    li.className = "m-item m-item--empty";
    li.textContent = state.subscriptions.length ? "No matches." : "No subscriptions yet. Open an export or add a channel.";
    list.append(li);
  }
  const total = state.subscriptions.length;
  $("count").textContent = q ? `${visible.length} of ${total} shown` : `${total} subscription${total === 1 ? "" : "s"}`;
  $("exportBtn").disabled = !total;
}

async function readFile(file, merge) {
  try {
    const parsed = C.parseExport(await file.text());
    if (merge) {
      const { subscriptions, added } = C.mergeSubscriptions(state.subscriptions, parsed.subscriptions);
      state.subscriptions = subscriptions;
      say(`Merged ${file.name}: ${added} new, ${parsed.subscriptions.length - added} already present.`);
    } else {
      if (state.subscriptions.length && !confirm("Replace the current list with this file?")) return;
      state = parsed;
      say(`Loaded ${parsed.subscriptions.length} subscriptions from ${file.name}.`);
    }
    save(); render();
  } catch (e) {
    say(e.message, true);
  }
}

$("openFile").addEventListener("change", (e) => { if (e.target.files[0]) readFile(e.target.files[0], false); e.target.value = ""; });
$("mergeFile").addEventListener("change", (e) => { if (e.target.files[0]) readFile(e.target.files[0], true); e.target.value = ""; });

const drop = $("drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("o-dropzone--over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("o-dropzone--over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault(); drop.classList.remove("o-dropzone--over");
  if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0], false);
});

$("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const url = C.normalizeYouTubeUrl($("addUrl").value);
  const name = $("addName").value.trim();
  if (!url) return say("That doesn't look like a YouTube channel URL, @handle or channel ID.", true);
  const dup = C.findDuplicate(state.subscriptions, C.YOUTUBE, url);
  if (dup) return say(`Already subscribed as “${dup.name}”.`, true);
  state.subscriptions.push({ service_id: C.YOUTUBE, url, name });
  save(); render();
  $("addForm").reset(); $("addUrl").focus();
  say(`Added “${name}”.`);
});

let searchTimer = null;
let searchCtrl = null;

function formatCount(n) {
  if (n == null) return "";
  return `${new Intl.NumberFormat(undefined, { notation: "compact" }).format(n)} subscribers`;
}

function addChannel(ch) {
  const url = `https://www.youtube.com/channel/${ch.id}`;
  const dup = C.findDuplicate(state.subscriptions, C.YOUTUBE, url);
  if (dup) return say(`Already subscribed as “${dup.name}”.`, true);
  state.subscriptions.push({ service_id: C.YOUTUBE, url, name: ch.name });
  rememberAvatar(ch.id, ch.avatar);
  save(); render();
  say(`Added “${ch.name}”.`);
}

function showResults(channels) {
  const list = $("results");
  list.replaceChildren();
  for (const ch of channels) {
    const li = document.createElement("li");
    li.className = "m-item";
    const info = document.createElement("div");
    info.className = "m-item__info";
    const name = document.createElement("div");
    name.className = "m-item__title";
    name.textContent = ch.name;
    const meta = document.createElement("div");
    meta.className = "a-text--meta";
    meta.textContent = [ch.handle, formatCount(ch.subscribers)].filter(Boolean).join(" · ");
    info.append(name, meta);
    const btn = document.createElement("button");
    btn.className = "a-button";
    const subscribed = () => !!C.findDuplicate(state.subscriptions, C.YOUTUBE, `https://www.youtube.com/channel/${ch.id}`);
    const sync = () => { btn.disabled = subscribed(); btn.textContent = btn.disabled ? "Added" : "+ Add"; };
    sync();
    btn.addEventListener("click", () => { addChannel(ch); sync(); });
    li.append(avatarFor(ch.name, ch.avatar), info, btn);
    list.append(li);
  }
}

async function runLookup(text) {
  if (searchCtrl) searchCtrl.abort();
  const query = text.trim();
  if (query.length < 2) { $("results").replaceChildren(); $("lookupStatus").textContent = ""; return; }
  searchCtrl = new AbortController();
  const { signal } = searchCtrl;
  $("lookupStatus").textContent = "Searching…";
  try {
    const url = C.normalizeYouTubeUrl(query);
    const id = url && channelId(url);
    let channels;
    if (id) channels = [await client.channel(id, signal)];
    else channels = await client.search(url ? url.split("/").pop() : query, signal);
    if (signal.aborted) return;
    showResults(channels);
    $("lookupStatus").textContent = channels.length ? "" : "No channels found.";
  } catch (e) {
    if (signal.aborted) return;
    $("results").replaceChildren();
    $("lookupStatus").textContent = `Search failed. ${e.message} You can still add channels manually below.`;
  }
}

$("lookup").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runLookup(e.target.value), 400);
});

$("servers").value = servers.join("\n");
$("saveServers").addEventListener("click", () => {
  const valid = validServers($("servers").value.split(/\s+/).filter(Boolean));
  if (!valid.length) return say("Add at least one valid server URL.", true);
  servers = valid;
  writeJson(SERVERS_KEY, servers);
  client = N.createClient(servers);
  $("servers").value = servers.join("\n");
  say(`Saved ${servers.length} server${servers.length === 1 ? "" : "s"}.`);
  render();
});
$("resetServers").addEventListener("click", () => {
  servers = N.DEFAULT_INSTANCES;
  try { localStorage.removeItem(SERVERS_KEY); } catch {}
  client = N.createClient(servers);
  $("servers").value = servers.join("\n");
  say("Servers reset to defaults.");
});

for (const btn of document.querySelectorAll(".m-search__clear")) {
  btn.addEventListener("click", () => {
    const input = btn.previousElementSibling;
    input.value = "";
    input.dispatchEvent(new Event("input"));
    input.focus();
  });
}

$("filter").addEventListener("input", render);
$("sortBtn").addEventListener("click", () => { state.subscriptions = C.sortByName(state.subscriptions); save(); render(); });
$("clearBtn").addEventListener("click", () => {
  if (!state.subscriptions.length || !confirm("Remove all subscriptions from this list?")) return;
  state.subscriptions = []; save(); render(); say("List cleared.");
});
$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([C.serializeExport(state)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = C.exportFileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  say(`Exported ${state.subscriptions.length} subscriptions to ${a.download}.`);
});

render();
