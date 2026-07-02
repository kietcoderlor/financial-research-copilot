import { parseSseChunk } from "@/lib/sse";

export type RetrieveFilters = {
  companies: string[];
  years: number[];
  doc_types: string[];
};

export type QueryRequest = {
  question: string;
  filters: RetrieveFilters;
};

export type QueryCitation = {
  index: number;
  chunk_id: string;
  company: string;
  doc_type: string;
  year: number | null;
  section: string | null;
  source_url: string | null;
  excerpt: string;
};

export type QueryMetadata = {
  query_type: string;
  chunks_retrieved: number;
  chunks_used: number;
  retrieval_ms: number;
  llm_ms: number;
  input_tokens: number;
  output_tokens: number;
  llm_cost_usd: number;
  total_ms: number;
  cache_hit: boolean;
  semantic_cache_hit?: boolean;
  hallucination_flags?: string[];
};

export type QueryResponse = {
  answer: string;
  citations: QueryCitation[];
  metadata: QueryMetadata;
};

export type RetrieveChunk = {
  chunk_id: string;
  company: string;
  doc_type: string;
  year: number | null;
  section: string | null;
  text: string;
  score: number;
};

export type RetrieveResponse = {
  chunks: RetrieveChunk[];
  latency: {
    embed_ms: number;
    vector_ms: number;
    bm25_ms: number;
    rerank_ms: number;
    total_ms: number;
  };
};

export type StreamDonePayload = {
  total_ms: number;
  query_type: string;
  citations: QueryCitation[];
};

export type StreamCallbacks = {
  onPhase?: (phase: "retrieving" | "generating") => void;
  onToken: (text: string) => void;
  onDone: (payload: StreamDonePayload) => void;
};

export type ResearchNote = {
  id: string;
  user_id: string;
  title: string;
  question: string;
  answer: string;
  citations_json: string;
  created_at: string;
  updated_at: string;
};

export type HealthResponse = {
  status: string;
  version: string;
  degraded: boolean;
  dependencies: Record<string, string>;
};

function errorMessageFromBody(status: number, text: string): string {
  if (!text.trim()) {
    return `Request failed with status ${status}`;
  }
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; error?: unknown };
    const { detail, error: errField } = parsed;
    if (typeof detail === "string") {
      return detail;
    }
    if (typeof errField === "string") {
      return errField;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg);
          }
          return String(item);
        })
        .join("; ");
    }
  } catch {
    // not JSON
  }
  return text;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(errorMessageFromBody(response.status, text));
  }
  return (await response.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(errorMessageFromBody(response.status, text));
  }
  return (await response.json()) as T;
}

async function queryStream(payload: QueryRequest, callbacks: StreamCallbacks): Promise<void> {
  const response = await fetch("/api/query/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(errorMessageFromBody(response.status, text));
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming not supported in this browser.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let sawToken = false;

  callbacks.onPhase?.("retrieving");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { messages, rest } = parseSseChunk(buffer);
    buffer = rest;

    for (const msg of messages) {
      const data = JSON.parse(msg.data) as Record<string, unknown>;
      if (msg.event === "source") {
        callbacks.onPhase?.("retrieving");
      } else if (msg.event === "token") {
        if (!sawToken) {
          sawToken = true;
          callbacks.onPhase?.("generating");
        }
        callbacks.onToken(String(data.text ?? ""));
      } else if (msg.event === "done") {
        callbacks.onDone({
          total_ms: Number(data.total_ms ?? 0),
          query_type: String(data.query_type ?? "general"),
          citations: (data.citations as QueryCitation[]) ?? [],
        });
      }
    }
  }
}

export const apiClient = {
  query(payload: QueryRequest): Promise<QueryResponse> {
    return postJson<QueryResponse>("/api/query", payload);
  },
  queryStream,
  listNotes(limit = 20, offset = 0): Promise<ResearchNote[]> {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return getJson<ResearchNote[]>(`/api/notes?${q.toString()}`);
  },
  createNote(payload: { title: string; question: string; answer: string; citations_json: string }): Promise<ResearchNote> {
    return postJson<ResearchNote>("/api/notes", payload);
  },
  async deleteNote(id: string): Promise<void> {
    const response = await fetch(`/api/notes/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(errorMessageFromBody(response.status, text));
    }
  },
  retrieve(query: string, filters: RetrieveFilters): Promise<RetrieveResponse> {
    return postJson<RetrieveResponse>("/api/retrieve", { query, filters });
  },
  health(): Promise<HealthResponse> {
    return getJson<HealthResponse>("/api/health");
  },
};
