import type { Express } from "express";
import { type Server } from "http";
import { apiRouter } from "./routes/api";
import { setupWS } from "./websocket";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.use("/api", apiRouter);
  setupWS(httpServer, app);
  return httpServer;
}
