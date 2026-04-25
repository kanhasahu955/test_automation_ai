# QualityForge AI — Documentation

This folder contains visual diagrams and a Postman collection for exploring and testing the platform.

## Diagrams

Generated infographics and architecture diagrams are stored as PNGs at the workspace asset location.

| # | Topic | Path |
|---|---|---|
| 1 | App overview / capabilities | `assets/01-qualityforge-overview.png` |
| 2 | System architecture (containers + data flow) | `assets/02-architecture.png` |
| 3 | End-to-end user flow (8 stages) | `assets/03-end-to-end-flow.png` |
| 4 | Database ER diagram (all tables + FKs) | `assets/04-er-diagram.png` |
| 5 | Complete REST API surface | `assets/05-api-surface.png` |
| 6 | Tech stack & libraries | `assets/06-tech-stack.png` |
| 7 | How to start (Getting Started) | `assets/07-getting-started.png` |
| 8 | Test execution sequence (UML) | `assets/08-execution-sequence.png` |
| 9 | AI Studio internals | `assets/09-ai-studio-internals.png` |
| 10 | STM Converter pipeline (Excel → SQL) | `assets/10-stm-pipeline.png` |
| 11 | No-Code DSL → executable script pipeline | `assets/11-nocode-pipeline.png` |

The Mermaid version of the ER diagram is embedded directly in the project [`README.md`](../README.md#database-schema-er) so it renders natively on GitHub/GitLab.

## Postman Collection

Two files are provided:

- `qualityforge-ai.postman_collection.json` — full request collection grouped into 16 folders (Health, Auth, Users, Projects, Environments, Test Cases, Test Suites, No-Code Flows, Executions, AI Studio, STM Converter, SQL Tests, Data Sources, Metadata, Data Profiling, Quality Rules, Reports, Notifications, Audit Logs).
- `qualityforge-ai.postman_environment.json` — companion environment with all the variables (`baseUrl`, `accessToken`, `projectId`, …).

### How to use

1. **Import** both JSON files into Postman (or any compatible tool — Bruno, Insomnia, Hoppscotch).
2. Select the **QualityForge AI - Local** environment.
3. Run **Auth → Login (JSON)** with the default seeded admin credentials:
   - `admin@qualityforge.ai` / `Admin@12345`
   The post-response test script auto-populates `accessToken`, `refreshToken`, and `userId`.
4. Run **Projects → Create project** — the `projectId` collection variable is auto-saved.
5. Repeat the same flow for environments, test cases, suites, flows, data sources, STM, etc. Each `Create *` request auto-fills the corresponding ID variable.
6. Bearer auth is configured at the collection level (`Authorization: Bearer {{accessToken}}`) and inherited by every request — no per-request setup needed.

### Notes

- The `baseUrl` defaults to `http://localhost:8080/api/v1` (Nginx). Change to `http://localhost:8000/api/v1` to bypass the proxy and hit the backend directly.
- Endpoints requiring elevated roles (`require_admin`, `require_manager`, `require_qa`, `require_data`) are enforced via FastAPI dependencies — login as a user with the appropriate `role`.
- File upload requests (e.g. STM upload) accept any `.xlsx` / `.xls` file via multipart `file` form field.
- For the live, always-current API definition, hit Swagger UI at `http://localhost:8080/api/docs` or fetch the OpenAPI spec at `http://localhost:8080/api/openapi.json`.
