import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const storePanelImage = mutation({
  args: {
    sessionId: v.id("sessions"),
    index: v.number(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Failed to get storage URL");

    const beat = await ctx.db
      .query("beats")
      .withIndex("by_session", (q) =>
        q.eq("sessionId", args.sessionId).eq("index", args.index)
      )
      .unique();

    if (beat) {
      await ctx.db.patch(beat._id, { panelUrl: url });
    }

    return url;
  },
});

export const createSession = mutation({
  args: {
    seriesId: v.string(),
    chapterNum: v.number(),
    characterName: v.string(),
    mode: v.optional(v.string()),
    startBeatIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return await ctx.db.insert("sessions", {
      seriesId: args.seriesId,
      chapterNum: args.chapterNum,
      userId: identity.subject,
      userName: user?.name ?? "Anonymous",
      userImage: user?.imageUrl,
      characterName: args.characterName,
      mode: args.mode,
      startBeatIndex: args.startBeatIndex,
      startedAt: Date.now(),
      lastBeatAt: Date.now(),
      beatCount: 0,
    });
  },
});

export const addBeat = mutation({
  args: {
    sessionId: v.id("sessions"),
    userChoice: v.string(),
    narration: v.string(),
    speaker: v.optional(v.string()),
    dialogue: v.optional(v.string()),
    location: v.optional(v.string()),
    choices: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const beatIndex = session.beatCount;

    const beatId = await ctx.db.insert("beats", {
      sessionId: args.sessionId,
      index: beatIndex,
      userChoice: args.userChoice,
      narration: args.narration,
      speaker: args.speaker,
      dialogue: args.dialogue,
      location: args.location,
      choices: args.choices,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.sessionId, {
      lastBeatAt: Date.now(),
      beatCount: beatIndex + 1,
    });

    return { beatId, index: beatIndex };
  },
});

export const getSessionBeats = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("beats")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const getChapterSessions = query({
  args: {
    seriesId: v.string(),
    chapterNum: v.number(),
  },
  handler: async (ctx, args) => {
    const chapterSessions = await ctx.db
      .query("sessions")
      .withIndex("by_chapter", (q) =>
        q.eq("seriesId", args.seriesId).eq("chapterNum", args.chapterNum)
      )
      .order("desc")
      .take(20);

    return chapterSessions;
  },
});

export const getChoicesAtBeat = query({
  args: {
    seriesId: v.string(),
    chapterNum: v.number(),
    beatIndex: v.number(),
    excludeSessionId: v.optional(v.id("sessions")),
  },
  handler: async (ctx, args) => {
    // Get all sessions for this chapter (active and complete)
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_chapter", (q) =>
        q.eq("seriesId", args.seriesId).eq("chapterNum", args.chapterNum)
      )
      .collect();

    if (sessions.length === 0) return [];

    // For each session, get the beat at this index
    const choiceMap = new Map<
      string,
      { choice: string; count: number; sessionId: string; userName: string; userImage?: string }
    >();

    for (const session of sessions) {
      // Skip the current user's active session
      if (args.excludeSessionId && session._id === args.excludeSessionId) continue;
      if (args.beatIndex >= session.beatCount) continue;

      const beat = await ctx.db
        .query("beats")
        .withIndex("by_session", (q) =>
          q.eq("sessionId", session._id).eq("index", args.beatIndex)
        )
        .unique();

      if (!beat) continue;

      const existing = choiceMap.get(beat.userChoice);
      if (existing) {
        existing.count++;
      } else {
        choiceMap.set(beat.userChoice, {
          choice: beat.userChoice,
          count: 1,
          sessionId: session._id,
          userName: session.userName,
          userImage: session.userImage,
        });
      }
    }

    return Array.from(choiceMap.values()).sort((a, b) => b.count - a.count);
  },
});

export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});
