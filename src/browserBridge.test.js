const assert = require("assert");
const { createBrowserBridge } = require("./browserBridge");

async function main() {
  const bridge = createBrowserBridge({ port: 19235 });
  const port = await bridge.start();
  assert.strictEqual(port, 19235);

  const health = await fetch(`http://127.0.0.1:${port}/v1/health`).then((r) =>
    r.json()
  );
  assert.strictEqual(health.ok, true);

  await fetch(`http://127.0.0.1:${port}/v1/hello`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userAgent: "test" }),
  });

  // Simulate extension polling after enqueue
  const pending = bridge.highlight([{ selector: "#x", label: "X" }]);
  const poll = await fetch(`http://127.0.0.1:${port}/v1/poll`).then((r) =>
    r.json()
  );
  assert.strictEqual(poll.commands.length, 1);
  assert.strictEqual(poll.commands[0].type, "highlight");

  await fetch(`http://127.0.0.1:${port}/v1/result`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: poll.commands[0].id, ok: true, count: 1 }),
  });
  const result = await pending;
  assert.strictEqual(result.ok, true);

  const somPending = bridge.snapshotSom({ showBadges: false });
  const somPoll = await fetch(`http://127.0.0.1:${port}/v1/poll`).then((r) =>
    r.json()
  );
  assert.strictEqual(somPoll.commands[0].type, "som");
  assert.strictEqual(somPoll.commands[0].payload.showBadges, false);

  await fetch(`http://127.0.0.1:${port}/v1/result`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: somPoll.commands[0].id, ok: true, elements: [] }),
  });
  await somPending;

  await bridge.stop();
  console.log("browserBridge.test.js ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
