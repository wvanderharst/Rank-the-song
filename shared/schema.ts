import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const songs = pgTable("songs", {
  id: serial("id").primaryKey(),
  placement: integer("placement").notNull(),
  artist: text("artist").notNull(),
  title: text("title").notNull(),
  year: integer("year").notNull(),
  youtubeId: text("youtube_id").notNull(),
  spotifyUri: text("spotify_uri"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertSongSchema = createInsertSchema(songs).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songs.$inferSelect;
