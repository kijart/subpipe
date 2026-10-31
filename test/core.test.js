const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/js/core.js");

const ID = "UCabcdefghijklmnopqrstuv";

test("normalizeYouTubeUrl accepts channel IDs, handles and channel URLs", () => {
  assert.equal(C.normalizeYouTubeUrl(ID), `https://www.youtube.com/channel/${ID}`);
  assert.equal(C.normalizeYouTubeUrl("@someone"), "https://www.youtube.com/@someone");
  assert.equal(C.normalizeYouTubeUrl(`http://m.youtube.com/channel/${ID}/videos`), `https://www.youtube.com/channel/${ID}`);
  assert.equal(C.normalizeYouTubeUrl("youtube.com/@someone"), "https://www.youtube.com/@someone");
  assert.equal(C.normalizeYouTubeUrl("https://www.youtube.com/c/Name"), "https://www.youtube.com/c/Name");
  assert.equal(C.normalizeYouTubeUrl("https://www.youtube.com/user/name"), "https://www.youtube.com/user/name");
});

test("normalizeYouTubeUrl rejects unusable input", () => {
  assert.equal(C.normalizeYouTubeUrl(""), null);
  assert.equal(C.normalizeYouTubeUrl("https://example.com/channel/" + ID), null);
  assert.equal(C.normalizeYouTubeUrl("https://notyoutube.com/@someone"), null);
  assert.equal(C.normalizeYouTubeUrl("https://www.youtube.com/watch?v=abc"), null);
});

test("isWebUrl only accepts http and https URLs", () => {
  assert.equal(C.isWebUrl("https://www.youtube.com/@a"), true);
  assert.equal(C.isWebUrl("http://example.com"), true);
  assert.equal(C.isWebUrl("javascript:alert(1)"), false);
  assert.equal(C.isWebUrl("data:text/html,x"), false);
  assert.equal(C.isWebUrl("not a url"), false);
});

test("parseExport keeps valid entries and fills missing versions", () => {
  const parsed = C.parseExport(JSON.stringify({
    subscriptions: [
      { service_id: 0, url: "https://www.youtube.com/@a", name: "A" },
      { service_id: 1, url: "https://soundcloud.com/b" },
      { service_id: "0", url: "https://www.youtube.com/@bad", name: "Bad" },
      null,
    ],
  }));
  assert.deepEqual(parsed, {
    subscriptions: [
      { service_id: 0, url: "https://www.youtube.com/@a", name: "A" },
      { service_id: 1, url: "https://soundcloud.com/b", name: "" },
    ],
    ...C.DEFAULT_VERSION,
  });
});

test("parseExport rejects invalid JSON and files without subscriptions", () => {
  assert.throws(() => C.parseExport("{"), /not valid JSON/);
  assert.throws(() => C.parseExport(null), /no "subscriptions" list/);
  assert.throws(() => C.parseExport('{"foo":1}'), /no "subscriptions" list/);
});

test("serializeExport round-trips through parseExport in NewPipe key order", () => {
  const state = { subscriptions: [{ name: "A", url: "https://www.youtube.com/@a", service_id: 0 }], app_version: "1.0", app_version_int: 7 };
  const text = C.serializeExport(state);
  assert.equal(text, '{"subscriptions":[{"service_id":0,"url":"https://www.youtube.com/@a","name":"A"}],"app_version":"1.0","app_version_int":7}');
  assert.deepEqual(C.parseExport(text), state);
});

test("findDuplicate matches equivalent YouTube URLs", () => {
  const subs = [{ service_id: 0, url: `https://www.youtube.com/channel/${ID}`, name: "A" }];
  assert.equal(C.findDuplicate(subs, 0, `http://m.youtube.com/channel/${ID}/`), subs[0]);
  assert.equal(C.findDuplicate(subs, 0, `https://youtube.com/channel/${ID}`), subs[0]);
  assert.equal(C.findDuplicate(subs, 1, `https://www.youtube.com/channel/${ID}`), null);
  assert.equal(C.findDuplicate(subs, 0, "https://www.youtube.com/@other"), null);
});

test("findDuplicate compares other services by URL ignoring case and trailing slash", () => {
  const subs = [{ service_id: 1, url: "https://soundcloud.com/Artist", name: "A" }];
  assert.equal(C.findDuplicate(subs, 1, "https://soundcloud.com/artist/"), subs[0]);
});

test("mergeSubscriptions adds only new channels and counts them", () => {
  const current = [{ service_id: 0, url: `https://www.youtube.com/channel/${ID}`, name: "A" }];
  const incoming = [
    { service_id: 0, url: `https://m.youtube.com/channel/${ID}`, name: "A again" },
    { service_id: 0, url: "https://www.youtube.com/@b", name: "B" },
  ];
  const { subscriptions, added } = C.mergeSubscriptions(current, incoming);
  assert.equal(added, 1);
  assert.deepEqual(subscriptions.map((s) => s.name), ["A", "B"]);
  assert.equal(current.length, 1);
});

test("sortByName sorts case-insensitively without mutating the input", () => {
  const subs = [{ name: "beta" }, { name: "Alpha" }, { name: "gamma" }];
  assert.deepEqual(C.sortByName(subs).map((s) => s.name), ["Alpha", "beta", "gamma"]);
  assert.equal(subs[0].name, "beta");
});

test("exportFileName uses NewPipe's timestamped name", () => {
  assert.equal(C.exportFileName(new Date(2026, 0, 2, 3, 4)), "newpipe_subscriptions_202601020304.json");
});
