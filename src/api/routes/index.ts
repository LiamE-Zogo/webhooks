import { Router } from "jsr:@oak/oak";

const router = new Router();

router.get("/status", (c) => {
  c.response.body = "Hello World";
  c.response.status = 200;
});

export default router;
