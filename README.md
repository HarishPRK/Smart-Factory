# Smart Factory Dashboard

An industrial monitoring dashboard built with React 19, TypeScript, and Vite.

## Tech Stack

- **React 19** with TypeScript
- **Vite** (rolldown-vite) for fast builds
- **Tailwind CSS** for styling
- **Vitest** + Testing Library for tests
- **GitHub Actions** for CI/CD
- **GitHub Pages** for hosting

## Getting Started

```bash
npm install
npm run dev
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Type-check + production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run preview` | Preview the production build locally |

---

## Development Workflow

### Making changes

1. Make your changes locally
2. Run `npm run lint` to catch any lint errors
3. Run `npm run build` to verify it compiles without type errors
4. Run `npm run test` to make sure the tests pass
5. Commit and push to `master`

### What happens automatically (CI)

Every push to `master` triggers the **CI workflow** on GitHub Actions. It runs:

1. Lint
2. Build (includes TypeScript type-check)
3. Tests

You can see the results in the **Actions** tab on GitHub. CI is informational only — it won't block your push.

### Deploying to GitHub Pages

Deployment is **manual**. When you're ready to publish your changes:

1. Go to the repo on GitHub
2. Click the **Actions** tab
3. Select **"Deploy to GitHub Pages"** in the left sidebar
4. Click **"Run workflow"** → **"Run workflow"**
5. Wait for it to finish — the live URL will appear in the run summary

Live site: `https://harishprk.github.io/smart-factory/`

---

## Project Structure

```
src/
├── components/
│   ├── Dashboard.tsx       # Main dashboard layout
│   ├── ActiveMachinery.tsx # Machine status panel
│   ├── CurrentConsumption.tsx
│   ├── KPIBar.tsx
│   └── ZoneTabs.tsx
├── Weather.tsx             # Weather widget
├── App.tsx
└── main.tsx
```
