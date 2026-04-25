# Schedules

QualityForge ships a first-class **scheduling** feature that lets you run any
*test suite*, *no-code flow* or *STM validation* on a recurring cadence —
**without ever writing a cron expression by hand**.

The UI builder is at `/schedules`; the backend wiring uses **RedBeat**
(Redis-backed Celery scheduler) so you can edit schedules live and the very
next beat tick will see the change. There is **no extra service to install**:
the existing Redis container is reused.

---

## How it fits together

```
┌───────────────┐   ┌─────────────────┐   ┌────────────┐   ┌──────────────┐
│ Schedules UI  │──▶│ FastAPI         │──▶│ Postgres   │   │ Redis        │
│ (CronBuilder) │   │ /api/schedules  │   │ schedules  │◀──│ qf:redbeat:* │
└───────────────┘   └────────┬────────┘   └────────────┘   └──────┬───────┘
                             │                                    │ tick
                             ▼                                    ▼
                    ┌────────────────┐                ┌──────────────────────┐
                    │ redbeat_sync   │ ─────────────▶ │ Celery Beat (RedBeat)│
                    │ upsert/remove  │                │ scheduler.RedBeat... │
                    └────────────────┘                └──────────┬───────────┘
                                                                 │ schedule.run(id)
                                                                 ▼
                                                       ┌────────────────────┐
                                                       │ Worker: dispatcher │
                                                       │ → ExecutionRun     │
                                                       │ → downstream task  │
                                                       └────────────────────┘
```

* **Source of truth:** the `schedules` table (cron expression, target,
  cadence config, last/next run, counters).
* **Runtime mirror:** RedBeat keys under `qf:redbeat:*` in Redis. The API
  always rewrites Redis to match the row, so the two cannot drift.
* **Dispatcher task:** `schedule.run` — looks up the row, creates an
  `ExecutionRun(run_type=SCHEDULED, schedule_id=…)` and chains the right
  downstream task.

## Build a schedule from the UI

1. Open **Operations → Schedules** and click **New schedule**.
2. Pick the *target type* and *target* (e.g. a test suite from the dropdown).
3. Use the **CronBuilder** card:
   * Pick a frequency: Hourly · Daily · Weekly · Monthly · Custom.
   * Fill the time fields (or comma-separated days for weekly).
   * Choose your timezone — the cron is interpreted in *that* TZ but stored
     and surfaced in UTC so multi-region history stays comparable.
   * Watch the **live preview**: the cron string, an English description and
     the next 5 fire times update on every keystroke.
4. Click **Create schedule**. The API:
   * validates the cron with `croniter`,
   * stores the row,
   * upserts the matching RedBeat entry in Redis,
   * computes `next_run_at`.

The schedules table now shows the new entry with **Active** toggle, **Run
now** ⚡, **Edit** and **Delete** actions.

## Run, pause and trace

| Action       | Where                              | Effect |
|--------------|------------------------------------|--------|
| Pause        | Toggle in the row, or Pause button | Sets status `PAUSED` and disables the RedBeat entry. |
| Resume       | Same toggle                         | Sets status `ACTIVE` and re-enables the entry. |
| Run now ⚡   | Row action / detail page            | Calls `/schedules/{id}/run-now`. Creates an `ExecutionRun` immediately and tags it with this schedule. |
| Edit         | Row action / detail page            | Opens the same builder pre-filled with the current cadence. |
| Detail       | Click the schedule name             | Shows reliability stats, the next 5 upcoming runs and the **full run history** (filtered by `schedule_id`). |
| Delete       | Row action                          | Removes the row and the RedBeat entry; existing runs stay in history. |

## Cron expressions cheat sheet

```
┌──────────── minute       (0–59)
│ ┌────────── hour         (0–23)
│ │ ┌──────── day of month (1–31)
│ │ │ ┌────── month        (1–12)
│ │ │ │ ┌──── day of week  (0–6, 0 = Sunday)
│ │ │ │ │
* * * * *
```

Examples:

| Cron            | Meaning                                |
|-----------------|----------------------------------------|
| `*/15 * * * *`  | Every 15 minutes                       |
| `0 * * * *`     | Every hour on the hour                 |
| `0 2 * * *`     | Every day at 02:00                     |
| `30 9 * * 1-5`  | Weekdays at 09:30                      |
| `0 8 1 * *`     | First of every month at 08:00          |

If you ever need a non-preset rhythm, switch the builder to **Custom** and
paste your expression — `cronstrue` describes it for you and `cron-parser`
shows the next 5 firings.

## API endpoints

| Method | Path                                       | Notes                                  |
|--------|--------------------------------------------|----------------------------------------|
| POST   | `/projects/{projectId}/schedules`          | Create a schedule (any role allowed by `require_qa`). |
| GET    | `/projects/{projectId}/schedules`          | List schedules (filters: `status_filter`, `target_type`). |
| GET    | `/schedules/{id}`                          | Read a single schedule.                |
| PATCH  | `/schedules/{id}`                          | Update name, description, cadence, TZ. |
| DELETE | `/schedules/{id}`                          | Delete + remove RedBeat entry.         |
| POST   | `/schedules/{id}/pause`                    | Mark `PAUSED`.                         |
| POST   | `/schedules/{id}/resume`                   | Mark `ACTIVE`.                         |
| POST   | `/schedules/{id}/run-now`                  | Trigger a run immediately.             |
| GET    | `/schedules/{id}/runs`                     | History of `ExecutionRun`s for this schedule. |
| POST   | `/schedules/preview`                       | Validate a cadence and get the next *N* fire times. Used by the UI builder. |

## Operating notes

* The Beat container must run with the RedBeat scheduler. We've already
  wired this up — the compose file launches `celery beat
  --scheduler redbeat.RedBeatScheduler -l info` for you.
* `redbeat_redis_url` defaults to `CELERY_BROKER_URL`; set both to the same
  Redis if you split brokers/backends in production.
* A schedule that fires while its target has been deleted simply records a
  failure on the schedule's counters and *does not* crash the worker.
* All API mutations go through `require_qa` — Admins, QA Managers, QA
  Engineers and Data Engineers can manage schedules; viewers read them.
