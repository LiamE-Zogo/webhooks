import { reset } from "https://deno.land/std@0.77.0/fmt/colors.ts";
import { Router } from "jsr:@oak/oak";
import z from "zod";
import Database from "../../db/index.ts";

const router = new Router();

router.get("/status", (c) => {
  c.response.body = "Hello World";
  c.response.status = 200;
});

export const WebhookRequest = z.object({
  send_url: z.url(),
  data: z.record(z.string(), z.any()),
  secret: z.string(),
  callback_url: z.url(),
});
router.post("/send", async (c) => {
  try {
    const body = WebhookRequest.safeParse(await c.request.body.json());

    if (!body.success) {
      (c.response.body = { message: body.error.message }),
        (c.response.status = 400);
      return;
    }

    if (body.data?.secret === Deno.env.get("API_SECRET")) {
      console.log(
        "INSERT INTO webhooks (send_url, data, status,callback_url) VALUES (?, ?, 'available', ?);",
        [
          body.data?.send_url,
          JSON.stringify(body.data?.data),
          body.data?.callback_url,
        ].toString()
      );

      await Database._instance.client?.query(
        `INSERT INTO webhooks (send_url, data, status,callback_url) VALUES ('${
          body.data?.send_url
        }', '${JSON.stringify(body.data?.data)}', 'available', '${
          body.data?.callback_url
        }')`
      );
      console.log("inserted");
    } else {
      (c.response.body = { message: "Not authorized" }),
        (c.response.status = 403);
      return;
    }

    c.response.status = 204;
  } catch (err: unknown) {
    console.log(err);
    c.response.status = 500;
    c.response.body = { error: err };
  }
});

export default router;
