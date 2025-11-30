import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { asc, desc } from "drizzle-orm";

export const apiRouter = Router();

apiRouter.get("/leaderboard", async (_req, res, next) => {
  try {
    const leaders = await db
      .select()
      .from(users)
      .orderBy(desc(users.wins), asc(users.losses), asc(users.createdAt))
      .limit(10);

    res.json(leaders);
  } catch (error) {
    next(error);
  }
});
