import express from "express";
import cors from "cors";
import type { AppContext } from "./context.ts";
import { createRouter } from "./routes.ts";

export function createApp(ctx: AppContext) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "256kb" }));
  app.use((req, res, next) => {
    const requestId = String(req.header("x-request-id") ?? crypto.randomUUID());
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-content-type-options", "nosniff");
    next();
  });
  app.use(createRouter(ctx));
  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });
  return app;
}
