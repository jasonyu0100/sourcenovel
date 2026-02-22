# Web Novel Template

An AI-powered authoring platform that turns your story ideas into illustrated, interactive web novels. Built with [Claude Code](https://claude.com/claude-code) and Next.js.

## What You Get

- **AI-assisted writing** — Claude helps you write chapters step by step: outline, draft, review
- **Generated illustrations** — Images created from your visual style guide
- **Ambient music** — Background tracks composed for each chapter
- **Interactive web reader** — Explorable chapter views, reading progress, theme customization
- **EPUB export** — Download your story as an ebook

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Claude Code](https://claude.com/claude-code) CLI installed
- API keys for image/music generation (optional, for media features):
  - [Replicate](https://replicate.com/) — image generation
  - [ElevenLabs](https://elevenlabs.io/) — music generation

### 1. Clone and install

```bash
git clone https://github.com/jasonyu0100/web-novel-template.git
cd web-novel-template
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
```

These are only needed for image and music generation. The writing workflow works without them.

### 3. Start your series

Open Claude Code in the project directory:

```bash
claude
```

Then run:

```
/workflow-new-series
```

Claude will have a conversation with you about your story — genre, protagonist, setting, tone. By the end, you'll have a complete series foundation: a series bible, visual style guide, writing module, and generated cover art.

This also replaces the example "Intro to Forge" series with your own.

### 4. Define your first arc

```
/workflow-new-arc
```

An arc is a group of chapters with a shared narrative thread. You'll define the key beats, a central question, and an engagement strategy.

### 5. Write your first chapter

```
/workflow-new-chapter
```

This kicks off the chapter pipeline. Claude will guide you through each step automatically:

| Step | What happens |
|------|-------------|
| **Concept** | Set the chapter's objective and direction |
| **Memory** | Claude gathers context from your sources and previous chapters |
| **Route** | Plan the chapter beat by beat (you can adjust before writing) |
| **Compose** | Claude writes the full draft following your outline and style |
| **Review** | Quality check against the outline — pass or targeted revision |
| **Web** | Generate an interactive explorable view |
| **Complete** | Finalize and check arc progress |

### 6. Add media (optional)

```
/workflow-media
```

Generates illustrations, background music, and visual story highlights. Requires Replicate and ElevenLabs API keys.

### 7. Publish and preview

```
/workflow-sync
```

Syncs your work to the web reader. Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your story live.

## Workflow Commands

| Command | Description |
|---------|-------------|
| `/workflow-new-series` | Create a new series (replaces intro-to-forge) |
| `/workflow-new-arc` | Define a new story arc |
| `/workflow-new-chapter` | Start a new chapter |
| `/workflow-memory` | Build chapter context |
| `/workflow-route` | Plan chapter beats |
| `/workflow-compose` | Write the chapter |
| `/workflow-review` | Review and revise |
| `/workflow-web` | Generate interactive web view |
| `/workflow-complete` | Finalize chapter |
| `/workflow-media` | Generate images, music, highlights |
| `/workflow-sync` | Publish to web reader |
| `/workflow-status` | Check current progress |
| `/workflow-reset` | Redo a workflow step |
| `/workflow-video` | Generate narrated chapter video |
| `/workflow-arc-video` | Combine chapter videos into arc video |

## Project Structure

```
series/                  # Your authoring workspace
  {your-series}/
    series.md            # Series identity
    style.md             # Visual/audio style guide
    modules/             # Writing module (voice, POV, style)
    sources/             # Character sheets, world-building
    arcs/                # Arc definitions
    chapters/            # Chapter files and media
    world/               # Visual references

public/                  # Published content (synced from series/)
app/                     # Next.js web reader
components/              # React UI components
```

## Deploying

The web reader is a standard Next.js app. Deploy to [Vercel](https://vercel.com):

```bash
npm run build
```

Or push to GitHub and connect to Vercel for automatic deployments.

## License

MIT
