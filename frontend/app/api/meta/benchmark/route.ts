import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  try {
    const path = join(process.cwd(), "..", "eval", "baseline.json");
    const raw = await readFile(path, "utf-8");
    return new NextResponse(raw, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      {
        question_count: 0,
        mean_precision_at_5: 0,
        citation_accuracy: 0,
        adversarial_refusal_rate: 0,
        query_latency_p50_ms: 0,
        query_latency_p95_ms: 0,
      },
      { status: 200 },
    );
  }
}
