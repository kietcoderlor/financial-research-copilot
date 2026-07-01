import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.API_URL || "http://localhost:8000";

export const options = {
  scenarios: {
    light: { executor: "constant-vus", vus: 10, duration: "30s", exec: "retrieveOnly" },
    medium: { executor: "constant-vus", vus: 25, duration: "30s", exec: "retrieveOnly", startTime: "35s" },
  },
};

const queries = [
  "Apple risk factors 2024",
  "Microsoft cloud growth",
  "Tesla margin guidance",
  "Goldman Sachs risk factors",
];

export function retrieveOnly() {
  const query = queries[Math.floor(Math.random() * queries.length)];
  const res = http.post(
    `${BASE}/retrieve`,
    JSON.stringify({ query, filters: {} }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1);
}
