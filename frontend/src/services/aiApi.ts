import { connectSocket, getSocket } from "./socket";
import { BaseApiClient } from "./BaseApiClient";

export type GeneratedTestCase = {
  title: string;
  description?: string;
  preconditions?: string;
  expected_result?: string;
  priority?: string;
  test_type?: string;
  steps?: { step_order: number; action: string; expected_result?: string }[];
};

export type GenerateTestCasesResponse = {
  items: GeneratedTestCase[];
  used_fallback: boolean;
};

export type GenerateFlowResponse = {
  flow_json: Record<string, unknown>;
  used_fallback: boolean;
};

export type GenerateSqlResponse = { sql: string };

export type FailureAnalysis = {
  summary: string;
  likely_root_cause: string;
  suggested_fix: string;
  is_flaky: boolean;
};

export type EdgeCasesResponse = { edge_cases: string[]; used_fallback: boolean };

export type AiStatus = {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  source: "db" | "env" | null;
  reason: string | null;
};

export class AiApiClient extends BaseApiClient {
  constructor() {
    super("/ai");
  }

  status(): Promise<AiStatus> {
    return this.get<AiStatus>("/status");
  }

  generateTestCases(requirement: string, count = 5): Promise<GenerateTestCasesResponse> {
    return this.post<GenerateTestCasesResponse>("/generate-test-cases", { requirement, count });
  }

  generateFlow(scenario: string): Promise<GenerateFlowResponse> {
    return this.post<GenerateFlowResponse>("/generate-no-code-flow", { scenario });
  }

  generateSql(mappingJson: Record<string, unknown>): Promise<GenerateSqlResponse> {
    return this.post<GenerateSqlResponse>("/generate-sql-validation", { mapping_json: mappingJson });
  }

  analyzeFailure(test_name: string, error_message: string, logs?: string): Promise<FailureAnalysis> {
    return this.post<FailureAnalysis>("/analyze-failure", { test_name, error_message, logs });
  }

  edgeCases(requirement: string): Promise<EdgeCasesResponse> {
    return this.post<EdgeCasesResponse>("/suggest-edge-cases", { requirement });
  }
}

const client = new AiApiClient();

// ---------------------------------------------------------------------------
// Streaming over Socket.IO — token-by-token UX for AI Studio
// ---------------------------------------------------------------------------
//
// Wire format:
//   client emits  ai:generate-test-cases   { request_id, requirement, count, project_id? }
//   server emits  ai:meta   { request_id, provider, model, source, used_fallback }
//                 ai:token  { request_id, delta }
//                 ai:parsed { request_id, items|edge_cases, raw, used_fallback }
//                 ai:error  { request_id, message, code }      (terminal)
//                 ai:done   { request_id }                     (always last)
//
// ``request_id`` lets us multiplex concurrent AI calls on a single socket —
// listeners filter on it so a new request can't accidentally receive tokens
// from a previous one still in flight.

export type AiStreamMeta = {
  provider: string | null;
  model: string | null;
  source: "db" | "env" | null;
  used_fallback: boolean;
};

export type AiStreamHandlers<TParsed> = {
  /** Fires once with provider/model so the UI can show "openai · gpt-4o-mini". */
  onMeta?: (meta: AiStreamMeta) => void;
  /** Fires for every token chunk. Append to your live preview buffer. */
  onToken?: (delta: string) => void;
  /** Fires once when the stream completes — `parsed` is the typed result. */
  onParsed?: (parsed: TParsed, raw: string | undefined, usedFallback: boolean) => void;
  /** Fires on transport / provider error. After this, no more events arrive. */
  onError?: (message: string) => void;
  /** Always fires last (success or failure). Use to flip a `streaming` flag. */
  onDone?: () => void;
};

type StreamEnvelope = {
  request_id?: string;
  provider?: string | null;
  model?: string | null;
  source?: "db" | "env" | null;
  used_fallback?: boolean;
  delta?: string;
  items?: GeneratedTestCase[];
  edge_cases?: string[];
  raw?: string;
  message?: string;
  code?: string;
};

/** Per-stream cancel handle — symmetry with the previous ``AbortController``. */
export type AiStreamHandle = { abort: () => void };

const AI_EVENTS = ["ai:meta", "ai:token", "ai:parsed", "ai:error", "ai:done"] as const;
type AiEvent = (typeof AI_EVENTS)[number];

let _seq = 0;
function nextRequestId(): string {
  _seq = (_seq + 1) % Number.MAX_SAFE_INTEGER;
  return `ai-${Date.now().toString(36)}-${_seq}`;
}

function startAiStream<TParsed>(
  emitEvent: string,
  emitPayload: Record<string, unknown>,
  handlers: AiStreamHandlers<TParsed>,
  parsedSelector: (data: StreamEnvelope) => TParsed,
): AiStreamHandle {
  connectSocket();
  const socket = getSocket();
  const requestId = nextRequestId();
  let aborted = false;

  // socket.io-client doesn't pass the event name into the handler, so we
  // generate one wrapper per event name and dispatch through a single
  // switch. This keeps cleanup (off()) symmetric without bookkeeping.
  const wrappers = {} as Record<AiEvent, (env: StreamEnvelope) => void>;

  const detach = () => {
    for (const ev of AI_EVENTS) socket.off(ev, wrappers[ev]);
  };

  const dispatch = (eventName: AiEvent, envelope: StreamEnvelope) => {
    if (aborted) return;
    // Multiplex guard: ignore tokens belonging to other concurrent calls.
    if (envelope?.request_id && envelope.request_id !== requestId) return;
    switch (eventName) {
      case "ai:meta":
        handlers.onMeta?.({
          provider: envelope.provider ?? null,
          model: envelope.model ?? null,
          source: envelope.source ?? null,
          used_fallback: envelope.used_fallback ?? false,
        });
        return;
      case "ai:token":
        if (typeof envelope.delta === "string") handlers.onToken?.(envelope.delta);
        return;
      case "ai:parsed":
        handlers.onParsed?.(
          parsedSelector(envelope),
          envelope.raw,
          envelope.used_fallback ?? false,
        );
        return;
      case "ai:error":
        handlers.onError?.(envelope.message ?? "AI stream failed");
        return;
      case "ai:done":
        detach();
        handlers.onDone?.();
        return;
    }
  };

  for (const ev of AI_EVENTS) {
    wrappers[ev] = (envelope: StreamEnvelope) => dispatch(ev, envelope);
    socket.on(ev, wrappers[ev]);
  }

  // Issue the request once connected. ``emit`` is queued by socket.io after
  // the first connect, but on a cold start we wait for ``connect`` so the
  // server can't drop the request before its session is set up.
  const send = () => {
    if (aborted) return;
    socket.emit(emitEvent, { request_id: requestId, ...emitPayload });
  };
  if (socket.connected) {
    send();
  } else {
    socket.once("connect", send);
  }

  return {
    abort: () => {
      if (aborted) return;
      aborted = true;
      detach();
    },
  };
}

/** Stream test cases token-by-token. Returns a handle with ``abort()``. */
export function streamGenerateTestCases(
  body: { requirement: string; count?: number; project_id?: string | null },
  handlers: AiStreamHandlers<{ items: GeneratedTestCase[] }>,
): AiStreamHandle {
  return startAiStream<{ items: GeneratedTestCase[] }>(
    "ai:generate-test-cases",
    {
      requirement: body.requirement,
      count: body.count ?? 5,
      project_id: body.project_id ?? null,
    },
    handlers,
    (data) => ({ items: data.items ?? [] }),
  );
}

/** Stream edge case suggestions token-by-token. */
export function streamSuggestEdgeCases(
  body: { requirement: string },
  handlers: AiStreamHandlers<{ edgeCases: string[] }>,
): AiStreamHandle {
  return startAiStream<{ edgeCases: string[] }>(
    "ai:suggest-edge-cases",
    { requirement: body.requirement },
    handlers,
    (data) => ({ edgeCases: data.edge_cases ?? [] }),
  );
}

export const aiApi = {
  status: () => client.status(),
  generateTestCases: (requirement: string, count = 5) => client.generateTestCases(requirement, count),
  generateFlow: (scenario: string) => client.generateFlow(scenario),
  generateSql: (mappingJson: Record<string, unknown>) => client.generateSql(mappingJson),
  analyzeFailure: (test_name: string, error_message: string, logs?: string) =>
    client.analyzeFailure(test_name, error_message, logs),
  edgeCases: (requirement: string) => client.edgeCases(requirement),
  streamGenerateTestCases,
  streamSuggestEdgeCases,
};
