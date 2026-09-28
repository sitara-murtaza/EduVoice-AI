# Vercel frontend + Cloudflare Worker API

This branch separates the existing Next.js UI from its `/api/*` handler. Vercel
hosts the UI and rewrites requests to the Worker, preserving the browser's
same-origin `/api/*` URLs and cookies. The repository's existing Sites project
and `.openai/hosting.json` are separate from this deployment.

## Before publishing

- Use Node.js 22.13+ and pnpm 11.25.0 (`corepack enable`).
- Have a Cloudflare account and an AssemblyAI key for voice features; add a
  Gemini key for the text tutor and AI grading.
- Create a Cloudflare Turnstile widget for the Vercel production hostname. It
  provides account-free guest access. Store its site key and secret in the
  Worker; do not configure Supabase if using this mode. Learning progress stays
  in the visitor's browser rather than syncing across devices.
- Set billing limits and monitor usage with your AI providers. The Worker has
  per-guest and global minute-based rate limiting, but Cloudflare's counters
  are local to each location and eventually consistent, so they are not a
  strict spending cap.
- The starter's D1 schema is empty. No database is required for guest mode.

## 1. Deploy the Cloudflare API

From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm deploy:api
```

Wrangler will ask you to authenticate and returns an `https://...workers.dev`
URL. In Cloudflare Workers & Pages > `eduvoice-api` > Settings > Variables and
Secrets, add the following **server-side** values:

| Name | Use |
| --- | --- |
| `ASSEMBLYAI_API_KEY` | Live tutor, interviewer, transcription and optional resume analysis |
| `GEMINI_API_KEY` | Text tutor and quiz grading |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL used by the Worker |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key used by the Worker |
| `FRONTEND_ORIGIN` | Exact Vercel production origin, such as `https://eduvoice-ai.vercel.app` |
| `GEMINI_MODEL` | Optional; defaults to `gemini-2.5-flash` |
| `TURNSTILE_SITE_KEY` | Public site key for the Vercel hostname |
| `TURNSTILE_SECRET_KEY` | Secret key for Turnstile server verification |
| `GUEST_SESSION_SECRET` | A unique, random secret (at least 32 bytes) for signing guest cookies |

Leave the Supabase variables unset for account-free guest access; they are an
alternative mode that requires an account UI and a `profiles` table with
per-user RLS. Despite their legacy `NEXT_PUBLIC_` names, they are read inside
the Worker. Never put provider API keys in Vercel client variables or the
GitHub repository. Set `FRONTEND_ORIGIN` once the Vercel URL is known.

## 2. Deploy the Vercel frontend

1. In Vercel, choose **Add New > Project**, import `sitara-murtaza/EduVoice-AI`,
   and select the branch containing this migration once it is merged.
2. Keep the root directory as `./` and the detected framework as **Next.js**.
3. Set `CLOUDFLARE_API_URL` to the Worker origin from step 1, without `/api` or
   a trailing slash. The build command is `pnpm build` and the install command
   is `pnpm install --frozen-lockfile` (or leave Vercel's detected pnpm defaults).
4. Deploy. Add the resulting production origin as the Worker's
   `FRONTEND_ORIGIN` and redeploy the Worker if needed. Preview domains need
   their own allowed origin strategy; the current Worker accepts one origin.

For local frontend development, set `CLOUDFLARE_API_URL` in ignored `.env.local`
and run `corepack pnpm dev`. For local Worker development run
`corepack pnpm dev:api`, with secret values in ignored `.dev.vars`.

## 3. Check the two services

- Open `https://<worker>/api/config` and `https://<vercel>/api/config`.
  Both should return JSON. The second URL must be served through Vercel's
  external rewrite.
- Open a tutor page, complete Turnstile and test one AI request. A direct AI
  request without a valid guest cookie should respond with HTTP 401. Guest
  cookies expire after one day, and the visitor can complete Turnstile again.
- Confirm a microphone session with actual AssemblyAI credentials and credits.
  The build and Wrangler dry run cannot test the provider's service.

GitHub Pages cannot run this API. The deleted GitHub Pages workflow should not
be restored for this setup.
