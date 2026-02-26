import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const storePanelImage = mutation({
  args: {
    interactionId: v.id("interactions"),
    index: v.number(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Failed to get storage URL");

    const beat = await ctx.db
      .query("beats")
      .withIndex("by_interaction", (q) =>
        q.eq("interactionId", args.interactionId).eq("index", args.index)
      )
      .unique();

    if (beat) {
      await ctx.db.patch(beat._id, { panelUrl: url });
    }

    return url;
  },
});

export const createInteraction = mutation({
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

    return await ctx.db.insert("interactions", {
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
    interactionId: v.id("interactions"),
    userChoice: v.string(),
    narration: v.string(),
    speaker: v.optional(v.string()),
    dialogue: v.optional(v.string()),
    location: v.optional(v.string()),
    choices: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const interaction = await ctx.db.get(args.interactionId);
    if (!interaction) throw new Error("Interaction not found");

    const beatIndex = interaction.beatCount;

    const beatId = await ctx.db.insert("beats", {
      interactionId: args.interactionId,
      index: beatIndex,
      userChoice: args.userChoice,
      narration: args.narration,
      speaker: args.speaker,
      dialogue: args.dialogue,
      location: args.location,
      choices: args.choices,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.interactionId, {
      lastBeatAt: Date.now(),
      beatCount: beatIndex + 1,
    });

    return { beatId, index: beatIndex };
  },
});

export const getInteractionBeats = query({
  args: { interactionId: v.id("interactions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("beats")
      .withIndex("by_interaction", (q) => q.eq("interactionId", args.interactionId))
      .collect();
  },
});

export const getChapterInteractions = query({
  args: {
    seriesId: v.string(),
    chapterNum: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("interactions")
      .withIndex("by_chapter", (q) =>
        q.eq("seriesId", args.seriesId).eq("chapterNum", args.chapterNum)
      )
      .order("desc")
      .take(20);
  },
});

export const getChoicesAtBeat = query({
  args: {
    seriesId: v.string(),
    chapterNum: v.number(),
    beatIndex: v.number(),
    excludeInteractionId: v.optional(v.id("interactions")),
  },
  handler: async (ctx, args) => {
    const interactions = await ctx.db
      .query("interactions")
      .withIndex("by_chapter", (q) =>
        q.eq("seriesId", args.seriesId).eq("chapterNum", args.chapterNum)
      )
      .collect();

    if (interactions.length === 0) return [];

    const choiceMap = new Map<
      string,
      { choice: string; count: number; interactionId: string; userName: string; userImage?: string }
    >();

    for (const interaction of interactions) {
      if (args.excludeInteractionId && interaction._id === args.excludeInteractionId) continue;
      if (args.beatIndex >= interaction.beatCount) continue;

      const beat = await ctx.db
        .query("beats")
        .withIndex("by_interaction", (q) =>
          q.eq("interactionId", interaction._id).eq("index", args.beatIndex)
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
          interactionId: interaction._id,
          userName: interaction.userName,
          userImage: interaction.userImage,
        });
      }
    }

    return Array.from(choiceMap.values()).sort((a, b) => b.count - a.count);
  },
});

export const getInteraction = query({
  args: { interactionId: v.id("interactions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.interactionId);
  },
});

// --- Episode play tracking ---

export const recordEpisodePlay = mutation({
  args: {
    seriesId: v.string(),
    chapterNum: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    return await ctx.db.insert("episodePlays", {
      seriesId: args.seriesId,
      chapterNum: args.chapterNum,
      userId: identity?.subject ?? undefined,
      startedAt: Date.now(),
    });
  },
});

export const getSeriesPlayCount = query({
  args: { seriesId: v.string() },
  handler: async (ctx, args) => {
    const plays = await ctx.db
      .query("episodePlays")
      .withIndex("by_series", (q) => q.eq("seriesId", args.seriesId))
      .collect();
    return plays.length;
  },
});

export const getSeriesInteractionCount = query({
  args: { seriesId: v.string() },
  handler: async (ctx, args) => {
    const interactions = await ctx.db
      .query("interactions")
      .withIndex("by_chapter", (q) => q.eq("seriesId", args.seriesId))
      .collect();
    return interactions.length;
  },
});

export const getChapterPlayCount = query({
  args: { seriesId: v.string(), chapterNum: v.number() },
  handler: async (ctx, args) => {
    const plays = await ctx.db
      .query("episodePlays")
      .withIndex("by_series_chapter", (q) =>
        q.eq("seriesId", args.seriesId).eq("chapterNum", args.chapterNum)
      )
      .collect();
    return plays.length;
  },
});
