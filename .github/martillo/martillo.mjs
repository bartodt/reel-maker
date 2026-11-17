// usage: node martillo.mjs <name> <line-file> <runs> <timeout-s>
// Runs one ffmpeg command line over and over, spawned like src/lib/ffmpeg.ts does, and reports hangs.
import { spawn, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [name, lineFile, runs, timeoutS] = process.argv.slice(2);
const line = readFileSync(lineFile, "utf8").trim().split("\n").at(-1);
let hangs = 0;

function snapshot(pid) {
  const run = (cmd, args) => {
    try {
      return execFileSync(cmd, args, { encoding: "utf8" });
    } catch (e) {
      return String(e.stdout ?? e);
    }
  };
  return process.platform === "darwin"
    ? run("sample", [String(pid), "2"])
    : run("ps", ["-L", "-o", "tid,stat,pcpu,wchan:32,comm", "-p", String(pid)]) +
        run("grep", ["-E", "VmRSS|Threads", `/proc/${pid}/status`]);
}

for (let i = 0; i < Number(runs); i++) {
  const t0 = Date.now();
  const p = spawn("bash", ["-c", `exec ffmpeg ${line}`]);
  let err = "";
  p.stderr.on("data", (d) => (err += d));
  p.stdout.on("data", () => {});
  let hung = false;
  const timer = setTimeout(() => {
    hung = true;
    hangs++;
    console.log(`::group::${name} run ${i} HUNG after ${timeoutS} s, pid ${p.pid}`);
    console.log(snapshot(p.pid));
    console.log("::endgroup::");
    p.kill("SIGKILL");
  }, Number(timeoutS) * 1000);
  const code = await new Promise((r) => p.on("close", r));
  clearTimeout(timer);
  console.log(`${name} run ${i} ${hung ? "HUNG" : `code=${code}`} ms=${Date.now() - t0}${err ? ` err=${err.trim().slice(-300)}` : ""}`);
}
console.log(`${name}: ${hangs} hung out of ${runs}`);
process.exitCode = hangs ? 1 : 0;
