import { PGlite } from "@electric-sql/pglite";
import net from "node:net";
import { PostgresConnection } from "pg-gateway";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.resolve("./prisma/pgdata");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log(`Starting embedded PostgreSQL at ${dataDir}...`);
const db = new PGlite(dataDir);
await db.waitReady;
console.log("PGlite database engine ready.");

const server = net.createServer((socket) => {
  const connection = new PostgresConnection(socket, {
    serverVersion: "16.3 (PGlite 0.2.0)",
    authMode: "cleartextPassword",

    async validateCredentials(credentials) {
      // Accept dev credentials
      return true;
    },

    async onStartup() {
      await db.waitReady;
      return false;
    },

    async onMessage(data, { isAuthenticated }) {
      if (!isAuthenticated) return false;

      try {
        const results = await db.execProtocol(data);
        for (const [_, responseData] of results) {
          connection.sendData(responseData);
        }
      } catch (err) {
        console.error("Query error:", err);
        connection.sendError(err);
        connection.sendReadyForQuery();
      }
      return true;
    },
  });

  socket.on("error", (err) => {
    // Ignore client aborted / connection reset
  });
});

const PORT = 5432;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`✓ PostgreSQL wire protocol server running on 127.0.0.1:${PORT}`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down PG server...");
  server.close();
  await db.close();
  process.exit(0);
});
