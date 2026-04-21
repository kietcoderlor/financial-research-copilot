# Financial Research Copilot Frontend

Next.js app for querying the FastAPI backend and rendering grounded answers plus citations.

## Local Setup

1. Copy env template:

```bash
cp .env.local.example .env.local
```

2. Start dev server:

```bash
npm install
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

## Commands

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Production API URL

Use `.env.production.example` as template and set `NEXT_PUBLIC_API_URL` to the deployed ALB URL.

## Automated Workflows

- `frontend-ci.yml`: lint + typecheck + build on PR/push for `frontend/**`.
- `frontend-vercel.yml`: production deploy to Vercel using repository secrets:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
