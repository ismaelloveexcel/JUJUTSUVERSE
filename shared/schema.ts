import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" })
    .defaultNow()
    .notNull(),
});

export const battles = pgTable("battles", {
  id: text("id").primaryKey(),
  player1Id: integer("player1_id")
    .references(() => users.id)
    .notNull(),
  player2Id: integer("player2_id")
    .references(() => users.id)
    .notNull(),
  winnerId: integer("winner_id").references(() => users.id),
  threatPeak: integer("threat_peak").notNull().default(0),
  turns: integer("turns").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" })
    .defaultNow()
    .notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  battlesWon: many(battles, { relationName: "winner" }),
  battlesAsPlayer1: many(battles, { relationName: "player1" }),
  battlesAsPlayer2: many(battles, { relationName: "player2" }),
}));

export const battlesRelations = relations(battles, ({ one }) => ({
  player1: one(users, {
    fields: [battles.player1Id],
    references: [users.id],
    relationName: "player1",
  }),
  player2: one(users, {
    fields: [battles.player2Id],
    references: [users.id],
    relationName: "player2",
  }),
  winner: one(users, {
    fields: [battles.winnerId],
    references: [users.id],
    relationName: "winner",
  }),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Battle = typeof battles.$inferSelect;
