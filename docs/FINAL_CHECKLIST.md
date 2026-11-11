# Final checklist — project brief vs. what was built

## 1. Problem statement
- [x] AI stock market assistant: market data + company research + analysis in one chat → `frontend/src/pages/ChatPage.jsx`, `backend/app/harness/agent.py`

## 2. Product features
- [x] **Technical analysis:** candlestick charts, indicators (SMA 20/50/200, RSI, MACD), trend, volume → Technicals page, `analysis.py`
- [x] **Fundamental analysis:** financial statements, earnings, valuation, company performance → Fundamentals page, `market.get_fundamentals`
- [x] **Python-powered calculations:** comparisons, projections (Monte Carlo), what-if scenarios, backtests → `sandbox/scripts/`, Compare + What-if pages
- [x] **Clear explanations, interactive charts and tables, with sources and assumptions** → every chat answer and page has a Sources / Assumptions block

## 3. Technical implementation
- [x] **AI harness:** model (Gemini) + context (last 10 messages) + permissions (read / compute, 6-call budget) + workflow → `app/harness/`
- [x] **MCP integrations:** MCP server with 5 market-data / company tools → `backend/mcp_server/server.py`
- [x] **Tool calling:** Gemini function calling, 9 tools → `app/harness/tools.py`
- [x] **Python sandbox:** isolated process; Docker container with no internet, read-only, non-root, CPU/RAM limits → `sandbox/`
- [x] **Background processing:** Celery workers + Redis queue, progress tracking, 3 retries with backoff, saved results → `app/worker.py`, `app/jobs/`, Analyses page

## 4. Deliverables
- [x] **Miro board:** research, user journeys, wireframes, system flow → `docs/miro/` (+ import guide)
- [x] **Jira board:** epics, stories, tasks, owners, acceptance criteria → `docs/jira/jira_import.csv` (+ import guide)
- [x] **GitHub repository:** working code, CONTRIBUTING, feature-branch pull requests, GitHub Actions (lint + tests + build) → repo + `.github/`
- [x] **AWS-style architecture diagram:** services, integrations, data flow, workers, queue, sandbox → `docs/architecture/` (draw.io + PNG + Mermaid)
- [x] **Brief presentation:** problem, features, architecture, demo, with speaker notes → `docs/presentation/AI_Stock_Market_Assistant.pptx`

## My requirements
- [x] React (Vite) with Framer Motion animations: page transitions, chat messages, chart/table load, hover, skeletons, progress bars
- [x] Institutional Sovereign design system: tokens as CSS variables, dark theme, emerald/red/amber/indigo, mono tabular numbers, 12/8/4 grid
- [x] FastAPI backend, Redis + Celery, Docker sandbox, MCP, tool calling, AI harness
- [x] No keys in code: `.env` (git-ignored) + `.env.example`
- [x] Free data source (Yahoo Finance via yfinance, no key) and free AI key (Gemini)

## Still to do (5 minutes each)
- [x] Chat and Analyses screenshots in README
- [ ] Optional: add Technicals, Fundamentals, Compare, What-if screenshots
- [ ] Import Miro and Jira content, then put both links in the README
- [ ] Rehearse the demo once with the speaker notes
