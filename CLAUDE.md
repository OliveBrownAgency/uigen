# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run start        # Start production server

# Database
npm run setup        # Install deps + generate Prisma client + run migrations
npm run db:reset     # Reset database (destructive)
npx prisma studio    # Open Prisma database GUI

# Testing & Linting
npm test             # Run Vitest tests (watch mode)
npx vitest run       # Run tests once
npx vitest run src/lib/__tests__/file-system.test.ts  # Run single test file
npm run lint         # ESLint via Next.js

# Code generation
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create and apply a new migration
```

## Environment

Requires `.env` with:
- `ANTHROPIC_API_KEY` — if absent, the app falls back to a `MockLanguageModel` that generates static example components
- `JWT_SECRET` — for session tokens
- `DATABASE_URL` — SQLite path (default: `file:./dev.db`)

The app loads with `cross-env NODE_OPTIONS=--require=./node-compat.cjs` for Node.js compatibility in the Next.js runtime.

## Architecture

UIGen is a full-stack AI-powered React component generator. Users describe components in natural language; Claude generates code into a **virtual (in-memory) file system** that renders live in an iframe.

### Request Flow

1. User sends a message → `POST /api/chat` (`src/app/api/chat/route.ts`)
2. Route streams a response via Vercel AI SDK `streamText` using `claude-haiku-4-5` (`maxDuration = 120`)
3. Claude calls tools (`str_replace_editor`, `file_manager`) to write/modify files
4. Tool call args are intercepted client-side via `onToolCall` in `ChatContext` and applied directly to `VirtualFileSystem` — the server-side tool execution runs in parallel but the client applies changes immediately for responsiveness
5. `PreviewFrame` re-renders the iframe whenever `refreshTrigger` increments
6. Completed projects are saved to SQLite via Prisma in the `onFinish` callback (requires auth)

### Key Abstractions

**`VirtualFileSystem`** (`src/lib/file-system.ts`) — in-memory file tree (Maps). Serialized to JSON for DB persistence in the `Project.data` column. Always has `/App.jsx` as the component entry point. The full serialized FS is sent with every chat request so the server can reconstruct state.

**`FileSystemContext`** / **`ChatContext`** (`src/lib/contexts/`) — React contexts bridging streaming AI tool calls with the UI. `FileSystemContext.handleToolCall` applies `str_replace_editor` and `file_manager` tool args to the virtual FS; `ChatContext` wires up the Vercel AI SDK `useChat` hook and forwards tool calls there.

**`provider.ts`** (`src/lib/provider.ts`) — factory returning either the real Anthropic model or `MockLanguageModel`. The mock simulates streaming with tool calls for local dev without an API key; it uses `maxSteps: 4` vs `40` for the real model.

**AI Tools** (`src/lib/tools/`) — two tools exposed to Claude:
- `str_replace_editor`: `view` / `create` / `str_replace` / `insert` / `undo_edit` (undo_edit is not implemented — returns an error string)
- `file_manager`: `rename` / `delete` files or directories

**Preview Pipeline** (`src/lib/transform/jsx-transformer.ts`) — runs entirely in the browser:
1. Each `.jsx/.tsx/.js/.ts` file is transformed with Babel standalone (JSX + optional TypeScript)
2. Transformed code is turned into a blob URL (`createBlobURL`)
3. `createImportMap` builds an ES module import map: local files → blob URLs (with `@/` alias support), third-party packages → `https://esm.sh/<pkg>`, missing local imports → auto-generated placeholder modules
4. `createPreviewHTML` injects the import map + Tailwind CDN + an error boundary into a full HTML document set as `iframe.srcdoc`

**System Prompt** (`src/lib/prompts/generation.tsx`) — instructs Claude to generate self-contained React components using Tailwind CSS, with `/App.jsx` as entry point and `@/` imports for cross-file references.

**Anonymous Work Tracking** (`src/lib/anon-work-tracker.ts`) — when a user works without being signed in, chat messages and the serialized file system are stored in `sessionStorage`. On sign-in/sign-up, this data is used to create a project so no work is lost.

### Database

SQLite via Prisma. Two models:
- `User` — email + bcrypt-hashed password, JWT sessions via `jose` (7-day expiry, `httpOnly` cookie)
- `Project` — stores `messages` (chat history as JSON string) and `data` (serialized `VirtualFileSystem` as JSON string). `userId` is nullable (supports anonymous projects)

Only `/api/projects` and `/api/filesystem` routes are protected by middleware; `/api/chat` is open but only persists to DB when a valid session exists.

### Testing

Tests use Vitest + React Testing Library + JSDOM. Test files live in `__tests__/` subdirectories next to the code they test. No DOM or Next.js router mocking conventions are established — check existing tests for patterns.

### Path Alias

`@/*` resolves to `src/*` (configured in `tsconfig.json` and `vitest.config.mts`). Inside the preview iframe, `@/` imports are resolved by the import map in `jsx-transformer.ts`.
