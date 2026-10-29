const { spawn } = require("node:child_process");

// Web and narration share one persistent audio directory in this deployment.
function start({ spawnProcess = spawn, exit = (code) => process.exit(code), signals = process } = {}) {
  const children = [
    spawnProcess(process.execPath, [require.resolve("next/dist/bin/next"), "start"], { stdio: "inherit", env: process.env }),
    spawnProcess(process.execPath, [require.resolve("./audio-worker.cjs")], { stdio: "inherit", env: process.env }),
  ];
  let stopping = false;
  const stop = (code) => {
    if (stopping) return;
    stopping = true;
    for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
    const deadline = setTimeout(() => {
      for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
      exit(code);
    }, 5000);
    Promise.all(children.map((child) => child.exitCode !== null || child.signalCode ? Promise.resolve() : new Promise((resolve) => child.once("exit", resolve))))
      .then(() => { clearTimeout(deadline); exit(code); });
  };
  for (const child of children) {
    child.once("error", () => stop(1));
    child.once("exit", (code) => stop(code === 0 ? 1 : code || 1));
  }
  signals.once("SIGTERM", () => stop(0));
  signals.once("SIGINT", () => stop(0));
  return children;
}

module.exports = { start };
if (require.main === module) start();
