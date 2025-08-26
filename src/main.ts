import { Application } from "jsr:@oak/oak";
import router from "./api/routes/index.ts";
import { initialize } from "./db/index.ts";

const db = await initialize();

const api = new Application();

api.use(router.routes());
api.use(router.allowedMethods());

await api.listen({ port: Number(Deno.env.get("API_PORT")) || 80 });
