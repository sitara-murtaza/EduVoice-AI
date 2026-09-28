# Vercel frontend + Cloudflare Worker API

This branch separates the existing Next.js UI from its `/api/*` handler. Vercel
hosts the UI and rewrites requests to the Worker, preserving the browser's
same-origin `/api/*` URLs and cookies. The repository's existing Sites project
and `.openai/hosting.json` are separate from this deployment.

## Before publishing

- Use Node.js 22.13+ and pnpm 11.25.0 (`corepack enable`).
- Have a Cloudflare account and an AssemblyAI key for voice features; add a
  Gemini key for the text tutor and AI grading.
- **Authentication blocker:** The API requires an authenticated user whenever
  an AI provider key is set. It uses Supabase Auth, but the current UI has no
  sign-in or sign-up controls. Configure and expose a supported sign-in flow,
  or design a protected guest access flow with durable abuse controls before
  offering paid AI features publicly. Do not disable the identity check just
  to get a successful deployment.
- If using Supabase Auth, create the `profiles` table with `user_id` as the
  unique owner key, `data` as JSON, and appropriate per-user RLS policies.
  This repository does not include that migration. The starter's D1 schema is
  empty; a Cloudflare D1 database is not required for the current API.

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

Despite their legacy `NEXT_PUBLIC_` names, the Supabase values above are read
inside the Worker. Never put provider API keys in Vercel client variables or
the GitHub repository. Set `FRONTEND_ORIGIN` once the Vercel URL is known.

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
- Test sign-in and one tutor request only after authentication is configured.
  Without a signed-in user, AI endpoints should respond with HTTP 401.
- Confirm a microphone session with actual AssemblyAI credentials and credits.
  The build and Wrangler dry run cannot test the provider's service.

GitHub Pages cannot run this API. The deleted GitHub Pages workflow should not
be restored for this setup.
