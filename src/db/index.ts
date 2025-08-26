import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

export async function initialize() {
  await createDatabase();
  await applyMigrations();
  return createPool();
}

async function createPool() {
  const pool_options = {
    db: Deno.env.get("DB_NAME") || "webhooks",
    hostname: Deno.env.get("DB_HOST") || "localhost",
    password: Deno.env.get("DB_PASSWORD") || "password",
    port: parseInt(Deno.env.get("DB_PORT") || "3306"),
    username: Deno.env.get("DB_USER") || "root",
    poolSize: 20,
  };

  const client = await new Client().connect(pool_options);
  return client;
}

async function createDatabase() {
  console.log("creating database");

  const DB_HOST = Deno.env.get("DB_HOST") || "localhost";
  const DB_PORT = parseInt(Deno.env.get("DB_PORT") || "3306");

  const client_options = {
    hostname: DB_HOST,
    password: Deno.env.get("DB_PASSWORD") || "password",
    port: DB_PORT,
    username: Deno.env.get("DB_USER") || "root",
  };

  const client = new Client();
  await client.connect(client_options);

  const db_name = Deno.env.get("DB_NAME") || "webhooks";
  const db_exists = await client.query(
    `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${db_name}'`
  );
  if (db_exists.length === 0) {
    await client.execute(`CREATE DATABASE ${db_name}`);
  }
  await client.close();
}

interface SqlMigration {
  id: number;
  applied_at: Date;
}

async function applyMigrations() {
  const client_options = {
    db: Deno.env.get("DB_NAME") || "webhooks",
    hostname: Deno.env.get("DB_HOST") || "localhost",
    password: Deno.env.get("DB_PASSWORD") || "password",
    port: parseInt(Deno.env.get("DB_PORT") || "3306"),
    username: Deno.env.get("DB_USER") || "root",
  };

  const client = new Client();
  await client.connect(client_options);

  try {
    await client.transaction(async (conn) => {
      // Create sql migrations table
      await conn.execute(`
      CREATE TABLE IF NOT EXISTS _sql_migrations (
        id INT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
      `);

      // Get existing migrations
      const existing_migrations = (await conn.query(
        "SELECT * FROM _sql_migrations"
      )) as SqlMigration[];

      const pending_migrations: string[] = [];
      for await (const file of Deno.readDir("./db/migrations")) {
        if (file.isFile) {
          console.log("checking migration:", file.name);
          const migration_id = parseInt(file.name.replace(".sql", ""));
          if (!existing_migrations.find((m) => m.id === migration_id)) {
            pending_migrations.push(file.name);
          }
        }
      }

      const sorted_pending_migrations = pending_migrations.sort((a, b) => {
        const a_id = parseInt(a.replace(".sql", ""));
        const b_id = parseInt(b.replace(".sql", ""));
        return a_id - b_id;
      });

      for await (const migration of sorted_pending_migrations) {
        console.log("applying migration:", migration);
        const migration_id = parseInt(migration.replace(".sql", ""));

        const filePath = `./db/migrations/${migration}`;
        const content = await Deno.readTextFile(filePath);

        // Split content into individual statements and execute each one
        const statements = content
          .split(";")
          .map((stmt) => stmt.trim())
          .filter((stmt) => stmt.length > 0);

        for (const statement of statements) {
          await conn.execute(statement);
        }

        // Only track the migration if it applied successfully
        await conn.execute(
          `INSERT INTO _sql_migrations (id) VALUES (${migration_id})`
        );
      }
    });
  } catch (err: unknown) {
    console.log(err);
    // TODO: Notify of failure to apply migrations.
    // This should be immediate and dealt with ASAP as nothing will work without this
  }
  await client.close();
}
