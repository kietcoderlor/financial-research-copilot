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

export const apiClient = {
  query(payload: QueryRequest): Promise<QueryResponse> {
    return postJson<QueryResponse>("/api/query", payload);
  },
  retrieve(query: string, filters: RetrieveFilters): Promise<RetrieveResponse> {
    return postJson<RetrieveResponse>("/api/retrieve", { query, filters });
  },
};
