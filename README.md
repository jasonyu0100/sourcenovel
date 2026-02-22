# SourceNovel

An AI-powered authoring platform that turns your story ideas into illustrated, interactive web novels with manga-style visuals. Built with [Claude Code](https://claude.com/claude-code) and Next.js.

## How It Works

SourceNovel is driven by **18 Claude Code skills** — specialized prompt workflows that guide Claude through every stage of novel production. Each skill encapsulates a distinct creative task, from narrative planning to visual design to video assembly. You invoke them as slash commands (`/workflow-*`) and Claude handles the rest.

The skills are organized into four phases:

- **Setup (3 skills)** — Series creation, arc definition, and chapter initialization. Interactive conversations where you and Claude establish story direction together.
- **Text (5 skills)** — The writing pipeline. Claude builds context from your sources, plans beats, drafts prose in your style, self-reviews against the outline, and generates an explorable web tree.
- **Visual (6 skills)** — Manga production. Claude extracts a spatial model from your prose, designs sets and costumes, builds a world reference library with generated images, composes panel prompts, renders pages, and assembles narrated video.
- **Integration (2 skills)** — Finalization. Generates interactive episode data and checks arc progress.
- **Utility (2 skills)** — Status checks and step resets.

The skills act as a structured creative process — each one prompts Claude with the right context, constraints, and output format so the result is consistent and builds on previous steps. You stay in control of direction; the skills handle execution.

## What You Get

- **Skill-driven authoring** — 18 purpose-built workflows guide Claude through writing, illustration, and production
- **Manga-style illustrations** — Panel images generated from spatial models and visual direction
- **Chapter videos** — Narrated video with TTS dialogue and background music
- **Interactive web reader** — Explorable chapter views with episode mode, reading progress, theme customization
- **EPUB export** — Download your story as an ebook

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Claude Code](https://claude.com/claude-code) CLI installed
- API keys:
  - [Replicate](https://replicate.com/) — image generation (optional, for visual features)
  - [ElevenLabs](https://elevenlabs.io/) — TTS and music generation (optional, for audio features)
  - [OpenRouter](https://openrouter.ai/) — powers interactive episode AI on the frontend

### 1. Clone and install

```bash
git clone https://github.com/jasonyu0100/sourcenovel.git
cd sourcenovel
npm install
```

### 2. Add API keys (optional)

Copy the example env and add your keys:

```bash
cp .env.example .env
```

Edit `.env` with your API tokens:

```
REPLICATE_API_TOKEN=your_token_here
ELEVEN_LABS_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
```

Replicate and ElevenLabs are only needed for image, video, and music generation. OpenRouter is needed for interactive episode mode on the frontend. The writing workflow works without any of them.

### 3. Start your series

Open Claude Code in the project directory:

```bash
claude
```

Then run:

```
/workflow-new-series
```

Claude will have a conversation with you about your story — genre, protagonist, setting, tone. By the end, you'll have a complete series foundation: a series bible, visual style guide, writing module, direction module, and generated cover art.

### 4. Define your first arc

```
/workflow-new-arc
```

An arc is a group of chapters with a shared narrative thread. You'll define the key beats, a central question, and an engagement strategy.

### 5. Write your first chapter

```
/workflow-new-chapter
```

This kicks off the chapter pipeline. Claude will guide you through each step automatically.

## Pipeline

The workflow has three phases:

```
concept → memory → route → compose → review → web
                                ↑         |
                                └─rewrite─┘
                                          ↓
model → set → world → staging → pages → video → episode → complete
```

### Text Phase — Writing

| Step | Command | What happens |
|------|---------|-------------|
| 1 | `/workflow-new-chapter` | Set the chapter's objective and direction |
| 2 | `/workflow-memory` | Gather context from sources and previous chapters |
| 3 | `/workflow-route` | Plan the chapter beat by beat (8-15 nodes) |
| 4 | `/workflow-compose` | Write the full draft following your outline and style |
| 5 | `/workflow-review` | Quality check — pass or targeted revision |
| 6 | `/workflow-web` | Generate interactive explorable tree view |

After web: proceed to `/workflow-model` for visual production, or skip to `/workflow-episode` for text-only output.

### Visual Phase — Manga Production (optional)

| Step | Command | What happens |
|------|---------|-------------|
| 7 | `/workflow-model` | Extract spatial model — scenes, beats, positions, dialogue |
| 8 | `/workflow-set` | Design the production set — locations, costumes, props |
| 9 | `/workflow-world` | Create world entries and generate reference images |
| 10 | `/workflow-staging` | Transform beats into manga panel prompts |
| 11 | `/workflow-pages` | Generate panel images from staging prompts |
| 12 | `/workflow-video` | Generate narrated chapter video with TTS and BGM |

### Integration Phase — Finalization

| Step | Command | What happens |
|------|---------|-------------|
| 13 | `/workflow-episode` | Generate episode.json for interactive chapter mode |
| 14 | `/workflow-complete` | Finalize chapter, check arc progress, plan next steps |

## All Commands

| Command | Description |
|---------|-------------|
| `/workflow-new-series` | Create a new series with full foundation |
| `/workflow-new-arc` | Define a new story arc |
| `/workflow-new-chapter` | Start a new chapter |
| `/workflow-memory` | Build chapter context |
| `/workflow-route` | Plan chapter beats |
| `/workflow-compose` | Write the chapter |
| `/workflow-review` | Review and revise |
| `/workflow-web` | Generate interactive web view |
| `/workflow-model` | Extract spatial model from prose |
| `/workflow-set` | Design production set |
| `/workflow-world` | Create world references and images |
| `/workflow-staging` | Generate manga panel prompts |
| `/workflow-pages` | Generate panel images |
| `/workflow-video` | Generate narrated chapter video |
| `/workflow-episode` | Generate interactive episode data |
| `/workflow-complete` | Finalize chapter |
| `/workflow-status` | Check current progress |
| `/workflow-reset` | Redo a workflow step |

## Project Structure

```
series/                  # Your authoring workspace
  {your-series}/
    series.md            # Series identity
    style.md             # Visual/audio style guide
    modules/
      writing-module.md  # Prose style guide (voice, POV, style)
      direction-module.md # Visual storytelling guide
    sources/             # *.md (general) + {arc-num}/*.md (arc-specific)
    arcs/{arc-num}/      # concept.md, arc.md, formula.md
    chapters/{chapter-num}/
      concept.md         # Chapter direction
      memory.md, route.md, draft.md, review.md, web.md
      meta.json
      media/             # background-music.mp3, chapter-video-*.mp4
      pages/
        model.md         # Spatial model (positions + beats)
        set.md           # Set design (locations, costumes, props)
        staging.md       # Full panel prompts
        {P}/             # page.jpg + individual panel images
    world/               # index.md + characters/, locations/, elements/
                         # Each entry: {slug}.md + {slug}.jpg (reference)

public/                  # Published content
app/                     # Next.js web reader
components/              # React UI components
scripts/                 # Build and sync utilities
```

## Deploying

The web reader is a standard Next.js app. Deploy to [Vercel](https://vercel.com):

```bash
npm run build
```

Or push to GitHub and connect to Vercel for automatic deployments.

## License

MIT
