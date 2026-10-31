const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../src/js/channels.js");

const ID = "UCabcdefghijklmnopqrstuv";

function mockFetch(t, handler) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    const { status = 200, body = {} } = handler(url);
    return { ok: status < 400, status, json: async () => body };
  });
  return calls;
}

test("instanceType picks the API from the host name", () => {
  assert.equal(N.instanceType("https://api.piped.example"), "piped");
  assert.equal(N.instanceType("https://invidious.example"), "invidious");
});

test("unproxy points Piped avatar URLs back at Google's CDN", () => {
  assert.equal(
    N.unproxy("https://pipedproxy.example/ytc/abc=s88?host=yt3.googleusercontent.com"),
    "https://yt3.googleusercontent.com/ytc/abc=s88",
  );
  assert.equal(N.unproxy("//yt3.ggpht.com/a.jpg"), "https://yt3.ggpht.com/a.jpg");
  assert.equal(N.unproxy("https://evil.example/a?host=evil.example"), "https://evil.example/a?host=evil.example");
  assert.equal(N.unproxy(""), "");
});

test("channelIdFromPath extracts a channel ID", () => {
  assert.equal(N.channelIdFromPath(`/channel/${ID}`), ID);
  assert.equal(N.channelIdFromPath("/@handle"), null);
});

test("fromInvidiousSearch keeps channels and picks a thumbnail of at least 64px", () => {
  const result = N.fromInvidiousSearch([
    { type: "video", authorId: ID },
    {
      type: "channel",
      authorId: ID,
      author: "A",
      subCount: 10,
      channelHandle: "@a",
      authorThumbnails: [{ url: "//img/32", width: 32 }, { url: "//img/176", width: 176 }, { url: "//img/76", width: 76 }],
    },
  ]);
  assert.deepEqual(result, [{ id: ID, name: "A", avatar: "https://img/76", subscribers: 10, handle: "@a" }]);
});

test("fromPipedSearch keeps channels with a channel URL", () => {
  const result = N.fromPipedSearch({
    items: [
      { type: "channel", url: `/channel/${ID}`, name: "A", thumbnail: "https://p.example/a?host=yt3.googleusercontent.com", subscribers: -1 },
      { type: "channel", url: "/c/no-id", name: "B" },
    ],
  });
  assert.deepEqual(result, [{ id: ID, name: "A", avatar: "https://yt3.googleusercontent.com/a", subscribers: null, handle: "" }]);
});

test("search results without a name get an empty name", () => {
  assert.equal(N.fromInvidiousSearch([{ type: "channel", authorId: ID }])[0].name, "");
  assert.equal(N.fromPipedSearch({ items: [{ type: "channel", url: `/channel/${ID}` }] })[0].name, "");
});

test("client falls back to the next server and then prefers it", async (t) => {
  const calls = mockFetch(t, (url) =>
    url.startsWith("https://invidious.down") ? { status: 500 } : { body: { id: ID, name: "A", avatarUrl: "" } });
  const client = N.createClient(["https://invidious.down/", "https://api.piped.up"]);

  assert.equal((await client.channel(ID)).name, "A");
  assert.deepEqual(calls, [`https://invidious.down/api/v1/channels/${ID}`, `https://api.piped.up/channel/${ID}`]);

  await client.search("a b");
  assert.equal(calls[2], "https://api.piped.up/search?q=a%20b&filter=channels");
});

test("client reports every failed server", async (t) => {
  mockFetch(t, () => ({ status: 503 }));
  const client = N.createClient(["https://a.example", "https://b.example"]);
  await assert.rejects(client.search("x"), /https:\/\/a\.example: HTTP 503; https:\/\/b\.example: HTTP 503/);
});

test("client uses the Invidious API for hosts without 'piped'", async (t) => {
  const calls = mockFetch(t, (url) => url.includes("/search") ? { body: [] } : {
    body: { authorId: ID, author: "A", subCount: 5, authorThumbnails: [{ url: "//img/100", width: 100 }] },
  });
  const client = N.createClient(["https://invidious.example"]);

  assert.deepEqual(await client.search("a b"), []);
  assert.deepEqual(await client.channel(ID), { id: ID, name: "A", avatar: "https://img/100", subscribers: 5, handle: "" });
  assert.deepEqual(calls, [
    "https://invidious.example/api/v1/search?q=a%20b&type=channel",
    `https://invidious.example/api/v1/channels/${ID}`,
  ]);
});

test("client stops trying servers once the request is aborted", async (t) => {
  const ctrl = new AbortController();
  const calls = mockFetch(t, () => {
    ctrl.abort();
    return { status: 500 };
  });
  const client = N.createClient(["https://a.example", "https://b.example"]);
  await assert.rejects(client.search("x", ctrl.signal), /HTTP 500/);
  assert.equal(calls.length, 1);
});
