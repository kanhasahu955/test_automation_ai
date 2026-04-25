/**
 * In-app documentation registry.
 *
 * Each entry imports the raw Markdown body via Vite's `?raw` import, so the
 * docs are bundled with the SPA and don't require a separate fetch. Add a
 * new doc by:
 *   1. Dropping a Markdown file in this folder.
 *   2. Adding an entry below (preserving order — that's the sidebar order).
 */

import overview from "./overview.md?raw";
import quickStart from "./quick-start.md?raw";
import architecture from "./architecture.md?raw";
import configuration from "./configuration.md?raw";
import dockerDoc from "./docker.md?raw";
import celeryDoc from "./celery.md?raw";
import airflowDoc from "./airflow.md?raw";
import nginxDoc from "./nginx.md?raw";
import operationsDoc from "./operations.md?raw";
import schedulesDoc from "./schedules.md?raw";
import usingTheApp from "./using-the-app.md?raw";
import apiReference from "./api-reference.md?raw";
import downloads from "./downloads.md?raw";
import troubleshooting from "./troubleshooting.md?raw";

import {
  ApiOutlined,
  AppstoreOutlined,
  BookOutlined,
  CalendarOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  GlobalOutlined,
  MonitorOutlined,
  RocketOutlined,
  SettingOutlined,
  ScheduleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { createElement } from "react";

export type DocSection = {
  /** URL slug — `/docs/<slug>`. */
  slug: string;
  title: string;
  description: string;
  group: "Get started" | "Architecture" | "Operations" | "Reference";
  icon: ReactNode;
  body: string;
};

const ico = (Icon: typeof BookOutlined): ReactNode => createElement(Icon);

export const DOCS: DocSection[] = [
  {
    slug: "overview",
    title: "Overview",
    description: "What QualityForge AI is and what it can do.",
    group: "Get started",
    icon: ico(BookOutlined),
    body: overview,
  },
  {
    slug: "quick-start",
    title: "Quick Start",
    description: "Run the platform locally in under 5 minutes.",
    group: "Get started",
    icon: ico(RocketOutlined),
    body: quickStart,
  },
  {
    slug: "using-the-app",
    title: "Using the App",
    description: "Screen-by-screen walk-through of every feature.",
    group: "Get started",
    icon: ico(AppstoreOutlined),
    body: usingTheApp,
  },
  {
    slug: "architecture",
    title: "Architecture",
    description: "Modules, base classes, layering, and data flow.",
    group: "Architecture",
    icon: ico(ExperimentOutlined),
    body: architecture,
  },
  {
    slug: "configuration",
    title: "Configuration",
    description: "YAML overlays, env vars, and secrets.",
    group: "Architecture",
    icon: ico(SettingOutlined),
    body: configuration,
  },
  {
    slug: "docker",
    title: "Docker",
    description: "Compose files, volumes, and full-stack workflows.",
    group: "Operations",
    icon: ico(CloudServerOutlined),
    body: dockerDoc,
  },
  {
    slug: "celery",
    title: "Celery",
    description: "Workers, queues, and async task patterns.",
    group: "Operations",
    icon: ico(CodeOutlined),
    body: celeryDoc,
  },
  {
    slug: "airflow",
    title: "Airflow",
    description: "DAGs for long-running orchestrated pipelines.",
    group: "Operations",
    icon: ico(ScheduleOutlined),
    body: airflowDoc,
  },
  {
    slug: "nginx",
    title: "Nginx",
    description: "Reverse proxy, TLS, and hardening.",
    group: "Operations",
    icon: ico(GlobalOutlined),
    body: nginxDoc,
  },
  {
    slug: "schedules",
    title: "Schedules",
    description: "Build cron schedules from the UI; track every run.",
    group: "Operations",
    icon: ico(CalendarOutlined),
    body: schedulesDoc,
  },
  {
    slug: "operations",
    title: "Operations Console",
    description: "Live health for Redis, Celery, Flower, Airflow — all from the UI.",
    group: "Operations",
    icon: ico(MonitorOutlined),
    body: operationsDoc,
  },
  {
    slug: "api-reference",
    title: "API Reference",
    description: "REST conventions, auth, pagination, errors.",
    group: "Reference",
    icon: ico(ApiOutlined),
    body: apiReference,
  },
  {
    slug: "downloads",
    title: "Downloads",
    description: "Excel deliverables — full API spec, STM template, schedule template.",
    group: "Reference",
    icon: ico(DownloadOutlined),
    body: downloads,
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Curated fixes for the most common issues.",
    group: "Reference",
    icon: ico(WarningOutlined),
    body: troubleshooting,
  },
];

export const DOC_GROUPS = [
  "Get started",
  "Architecture",
  "Operations",
  "Reference",
] as const;

export const findDoc = (slug: string | undefined): DocSection | undefined =>
  DOCS.find((d) => d.slug === slug);

export const DEFAULT_DOC_SLUG = "overview";
