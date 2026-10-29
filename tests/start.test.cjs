const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { start } = require("../scripts/start.cjs");

test("startup supervises web and narration together and stops both on failure", async () => {
  const calls = [];
  const children = [];
  let result;
  start({
    signals: new EventEmitter(),
    exit: (code) => { result = code; },
    spawnProcess(command, args, options) {
      calls.push({ command, args, options });
      const child = new EventEmitter();
      child.exitCode = null;
      child.kill = (signal) => { child.signalCode = signal; queueMicrotask(() => child.emit("exit", null, signal)); };
      children.push(child);
      return child;
    },
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0].args[0], /next/);
  assert.match(calls[1].args[0], /audio-worker\.cjs$/);
  assert.equal(calls[0].options.env, calls[1].options.env);
  children[1].exitCode = 2;
  children[1].emit("exit", 2);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(result, 2);
  assert.equal(children[0].signalCode, "SIGTERM");
});
