// ===========================================================================
// ensure-db — make `npm run dev` work even when PostgreSQL is not running.
//
// The app talks plain Prisma to localhost:5432 by default, so every page that
// reads data (POS catalog, reports, users, …) and the login endpoint fail with
//   "Can't reach database server at `localhost:5432`"
// whenever the embedded PostgreSQL has not been started yet. That is the single
// most common reason a fresh checkout "does not run in the browser".
//
// This script is the `dev`/`start` preflight:
//   1. Read DATABASE_URL (process env first, then .env).
//   2. If it points at a local server and that port already answers → exit.
//   3. Otherwise boot the embedded cluster in the background and wait for it.
//   4. If it points anywhere remote (Docker/production) → never touch it, just
//      report and let the app surface its own connection error.
//
// It never stops an existing database and never fails the dev command when the
// server is already healthy.
// ===========================================================================

import { spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const READY_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 500;

const isLocalHost = (host) =>
  host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "";

/** Minimal `.env` reader — only what DATABASE_URL needs. */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return "";
  try {
    const line = fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((l) => /^\s*DATABASE_URL\s*=/.test(l));
    if (!line) return "";
    return line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

function parseDatabaseUrl() {
  const raw = process.env.DATABASE_URL || readEnvFile(path.resolve(".env"));
  if (!raw) return null;
  try {
    const { hostname, port } = new URL(raw);
    return { host: hostname, port: Number(port || 5432) };
  } catch {
    return null;
  }
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDatabase(host, port) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await canConnect(host, port)) return true;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

async function main() {
  const target = parseDatabaseUrl();

  if (!target) {
    console.warn(
      "[db] DATABASE_URL is not set — skipping the database preflight.",
    );
    return;
  }

  const { host, port } = target;

  if (!isLocalHost(host)) {
    // Docker / staging / production. Leave the server alone entirely.
    return;
  }

  if (await canConnect(host, port)) {
    console.log(`[db] PostgreSQL reachable on ${host}:${port}`);
    return;
  }

  console.log(
    `[db] PostgreSQL is not running on ${host}:${port} — starting it in the background…`,
  );

  const child = spawn(process.execPath, ["scripts/run-pg.mjs"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  if (await waitForDatabase(host, port)) {
    console.log(`[db] PostgreSQL ready on ${host}:${port}.`);
    return;
  }

  console.error(
    `[db] Could not reach PostgreSQL on ${host}:${port} after ${READY_TIMEOUT_MS / 1000}s.\n` +
      `     Run "npm run db:start" in a separate terminal to watch its logs, and\n` +
      `     "npm run db:push && npm run db:seed" on a fresh database.`,
  );
  process.exitCode = 1;
}

main().catch((err) => {
  console.warn(`[db] Database preflight skipped: ${err?.message || err}`);
});