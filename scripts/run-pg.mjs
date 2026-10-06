import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";

const dbDir = path.resolve("./prisma/pg-cluster");
const isFirstRun = !fs.existsSync(dbDir);

const pg = new EmbeddedPostgres({
  databaseDir: dbDir,
  port: 5432,
  user: "postgres",
  password: "password",
  persistent: true,
});

async function main() {
  try {
    if (isFirstRun) {
      console.log("Initialising PostgreSQL cluster at:", dbDir);
      await pg.initialise();
      console.log("✓ PostgreSQL initialised.");
    }

    console.log("Starting PostgreSQL server on port 5432...");
    await pg.start();
    console.log("✓ PostgreSQL started successfully on port 5432!");

    try {
      await pg.createDatabase("perfume_pos");
      console.log("✓ Database 'perfume_pos' ready.");
    } catch (e) {
      // Database might already exist
      console.log("Database 'perfume_pos' already exists or ready.");
    }

    console.log("PostgreSQL is running and ready for Prisma & connections.");

    // Keep process alive
    process.on("SIGINT", async () => {
      console.log("Stopping PostgreSQL...");
      await pg.stop();
      process.exit(0);
    });
  } catch (err) {
    console.error("Failed to start Embedded PostgreSQL:", err);
    process.exit(1);
  }
}

main();
