# Contributing

## Team

| Member | GitHub | Main areas |
|---|---|---|
| Iram Shahzadi | [@Iram-Shahzadii](https://github.com/Iram-Shahzadii) | Frontend, backend, AI harness, sandbox, workers, deliverables |
| _Add team member_ | _@username_ | _area_ |

Each member's work is visible in the commit and pull-request history (`git log --author`, GitHub **Insights → Contributors**).

## Workflow

1. Update `main`: `git checkout main && git pull`
2. Create a feature branch: `git checkout -b feature/<short-name>` (or `fix/...`, `docs/...`)
3. Commit small, clear changes using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(frontend): add candlestick chart`
   - `fix(backend): handle missing earnings data`
   - `docs: update README`
4. Push: `git push -u origin feature/<short-name>`
5. Open a **Pull Request** into `main` and fill in the template.
6. CI (GitHub Actions) must be green: backend lint + tests, frontend lint + build, Docker build.
7. Merge, then delete the branch.

## Branch history

| Branch | What it added |
|---|---|
| `main` | Project structure, README, env example |
| `feature/frontend-ui` | React app, design system, animations, 6 pages |
| `feature/backend-ai-harness` | FastAPI, Yahoo data, MCP server, Gemini tool-calling harness |
| `feature/sandbox-workers-ci` | Python sandbox, Celery + Redis jobs, Docker compose, CI |
| `docs/deliverables` | Miro content, Jira CSV, architecture diagram, presentation |

## Run checks locally

```bash
# backend
cd backend
pip install ruff pytest
ruff check . ../sandbox
pytest -q

# frontend
cd frontend
npm run lint
npm run build
```

## Rules

- Never commit secrets. Keys live only in `.env` (ignored by git); `.env.example` holds placeholders.
- Every analysis result must carry its **sources** and **assumptions**.
- Custom Python runs only inside the sandbox.
