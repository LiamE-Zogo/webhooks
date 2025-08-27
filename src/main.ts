import { Application } from "jsr:@oak/oak";
import router from "./api/routes/index.ts";
import Database from "./db/index.ts";
import { startWebhookWorkers } from "./webhooks/manager.ts";

const db = new Database();
await db.initialize();
await startWebhookWorkers();

const api = new Application();

api.use(router.routes());
api.use(router.allowedMethods());

await api.listen({ port: Number(Deno.env.get("API_PORT")) || 80 });
