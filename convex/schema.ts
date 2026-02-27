import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    tokens: v.number(),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  interactions: defineTable({
    seriesId: v.string(),
    chapterNum: v.number(),
    userId: v.string(),
    userName: v.string(),
    userImage: v.optional(v.string()),
    characterName: v.string(),
    mode: v.optional(v.string()),
    startBeatIndex: v.optional(v.number()),
    startedAt: v.number(),
    lastBeatAt: v.number(),
    beatCount: v.number(),
  })
    .index("by_chapter", ["seriesId", "chapterNum"])
    .index("by_user", ["userId"]),

  episodePlays: defineTable({
    seriesId: v.string(),
    chapterNum: v.number(),
    userId: v.optional(v.string()),
    startedAt: v.number(),
  })
    .index("by_series", ["seriesId"])
    .index("by_series_chapter", ["seriesId", "chapterNum"])
    .index("by_user", ["userId"]),

  beats: defineTable({
    interactionId: v.id("interactions"),
    index: v.number(),
    userChoice: v.string(),
    narration: v.string(),
    speaker: v.optional(v.string()),
    dialogue: v.optional(v.string()),
    location: v.optional(v.string()),
    choices: v.array(v.string()),
    panelUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_interaction", ["interactionId", "index"]),

  worldConversations: defineTable({
    seriesId: v.string(),
    locationSlug: v.string(),
    characterSlug: v.string(),
    userId: v.string(),
    userName: v.string(),
    userImage: v.optional(v.string()),
    startedAt: v.number(),
    lastMessageAt: v.number(),
    messageCount: v.number(),
  })
    .index("by_user_character", ["userId", "seriesId", "characterSlug"])
    .index("by_series", ["seriesId"]),

  worldMessages: defineTable({
    conversationId: v.id("worldConversations"),
    index: v.number(),
    role: v.string(),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId", "index"]),
});
