# QualityForge AI

QualityForge AI is an **AI-powered Quality Engineering Platform** for modern data
and software teams. It unifies test management, no-code automation, AI-driven
test generation, data profiling, STM (Source-to-Target Mapping) validation,
quality monitoring, and audit-grade reporting in a single product.

## What you can do

- **Manage projects, test suites, and test cases** with rich tagging, traceability and history.
- **Design tests visually** with the No-Code Designer (drag-and-drop flows).
- **Generate tests from natural language** using AI Studio (LLMs + structured prompts).
- **Convert STM specs to validation SQL** automatically with the STM Converter.
- **Profile sources** to discover schema drift, null ratios, distinct counts, and patterns.
- **Monitor quality trends** in real time with dashboards and alerts.
- **Run scheduled or ad-hoc executions** and ship results to reports + audit logs.

## High-level architecture

```text
                ┌─────────────────────────────────────┐
                │            Frontend (React)         │
                │  Vite · Redux Toolkit · Ant Design  │
                └────────────────┬────────────────────┘
                                 │ REST (JWT)
                ┌────────────────▼────────────────────┐
                │        FastAPI Backend (uv)         │
                │  Controller → Service → Repository  │
                └───┬───────┬──────────┬──────────┬──┘
                    │       │          │          │
                ┌───▼──┐ ┌──▼───┐ ┌────▼────┐ ┌───▼────┐
                │MySQL │ │Redis │ │ Celery  │ │Airflow │
                └──────┘ └──────┘ └─────────┘ └────────┘
```

> Tip: read the **Architecture** page next for the full deep-dive, including the
> repository pattern, base classes, and the YAML configuration system.

## Where to go from here

- **Quick Start** → spin up the platform in under 5 minutes.
- **Configuration** → understand YAML layering, env files, and secrets.
- **Docker / Celery / Airflow / Nginx** → operational setup pages, one per service.
- **Using the App** → screen-by-screen walk-through.
- **API Reference** → REST endpoints, auth, pagination.
- **Troubleshooting** → curated fixes for common issues.
