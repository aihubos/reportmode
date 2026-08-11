import assert from "node:assert/strict";
import test from "node:test";

import worker from "./index.js";

type Job = {
  id: string;
  action: string;
  status: string;
  requested_count: number;
  success_count: number;
  failure_count: number;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  result_json: string;
};

type JobItem = {
  job_id: string;
  report_id: string;
  status: string;
  private_report_id: string | null;
  error_message: string | null;
  updated_at: string;
};

class FakePrepared {
  args: unknown[] = [];
  constructor(private db: JobD1, private sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
  first<T>() { return this.db.first(this.sql, this.args) as Promise<T | null>; }
  all<T>() { return this.db.all(this.sql, this.args) as Promise<{ results: T[] }>; }
}

class JobD1 {
  jobs = new Map<string, Job>();
  items = new Map<string, JobItem>();
  hidden = new Set<string>();

  prepare(sql: string) { return new FakePrepared(this, sql); }

  seedJob(id: string, action: string, reportIds: string[]) {
    const now = new Date().toISOString();
    this.jobs.set(id, {
      id,
      action,
      status: "queued",
      requested_count: reportIds.length,
      success_count: 0,
      failure_count: 0,
      requested_at: now,
      started_at: null,
      completed_at: null,
      error_message: null,
      result_json: "{}",
    });
    for (const reportId of reportIds) {
      this.items.set(`${id}:${reportId}`, {
        job_id: id,
        report_id: reportId,
        status: "queued",
        private_report_id: null,
        error_message: null,
        updated_at: now,
      });
    }
  }

  async run(sql: string, args: unknown[]) {
    if (/INSERT INTO report_admin_jobs/i.test(sql)) {
      const [id, action, requestedCount, requestedAt] = args;
      this.jobs.set(String(id), {
        id: String(id), action: String(action), status: "queued",
        requested_count: Number(requestedCount), success_count: 0, failure_count: 0,
        requested_at: String(requestedAt), started_at: null, completed_at: null,
        error_message: null, result_json: "{}",
      });
      return { meta: { changes: 1 } };
    }
    if (/INSERT INTO report_admin_job_items/i.test(sql)) {
      const [jobId, reportId, updatedAt] = args;
      this.items.set(`${jobId}:${reportId}`, {
        job_id: String(jobId), report_id: String(reportId), status: "queued",
        private_report_id: null, error_message: null, updated_at: String(updatedAt),
      });
      return { meta: { changes: 1 } };
    }
    if (/INSERT INTO report_hidden/i.test(sql)) {
      this.hidden.add(String(args[0]));
      return { meta: { changes: 1 } };
    }
    if (/DELETE FROM report_hidden/i.test(sql)) {
      this.hidden.delete(String(args[0]));
      return { meta: { changes: 1 } };
    }
    if (/UPDATE report_admin_jobs SET status = 'failed'/i.test(sql)) {
      const [completedAt, errorMessage, id] = args;
      const job = this.jobs.get(String(id));
      if (job) {
        job.status = "failed";
        job.failure_count = job.requested_count;
        job.completed_at = String(completedAt);
        job.error_message = String(errorMessage);
      }
      return { meta: { changes: job ? 1 : 0 } };
    }
    if (/UPDATE report_admin_jobs SET status = 'running'/i.test(sql)) {
      const [startedAt, id] = args;
      const job = this.jobs.get(String(id));
      if (job) {
        job.status = "running";
        job.started_at ||= String(startedAt);
      }
      return { meta: { changes: job ? 1 : 0 } };
    }
    if (/UPDATE report_admin_job_items SET status = \?, private_report_id/i.test(sql)) {
      const [status, privateReportId, errorMessage, updatedAt, jobId, reportId] = args;
      const item = this.items.get(`${jobId}:${reportId}`);
      if (item) {
        item.status = String(status);
        item.private_report_id = privateReportId ? String(privateReportId) : null;
        item.error_message = errorMessage ? String(errorMessage) : null;
        item.updated_at = String(updatedAt);
      }
      return { meta: { changes: item ? 1 : 0 } };
    }
    if (/UPDATE report_admin_jobs SET success_count = \?, failure_count = \?/i.test(sql)) {
      const [successCount, failureCount, id] = args;
      const job = this.jobs.get(String(id));
      if (job) {
        job.success_count = Number(successCount);
        job.failure_count = Number(failureCount);
      }
      return { meta: { changes: job ? 1 : 0 } };
    }
    if (/UPDATE report_admin_jobs SET status = \?, completed_at = \?/i.test(sql)) {
      const [status, completedAt, errorMessage, id] = args;
      const job = this.jobs.get(String(id));
      if (job) {
        job.status = String(status);
        job.completed_at = String(completedAt);
        if (errorMessage) job.error_message = String(errorMessage);
      }
      return { meta: { changes: job ? 1 : 0 } };
    }
    throw new Error(`Unhandled job run SQL: ${sql}`);
  }

  async batch(statements: FakePrepared[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  async first(sql: string, args: unknown[]) {
    if (/SELECT id FROM report_admin_jobs WHERE id/i.test(sql)) {
      const job = this.jobs.get(String(args[0]));
      return job ? { id: job.id } : null;
    }
    if (/SELECT id, action, status/i.test(sql)) return this.jobs.get(String(args[0])) || null;
    if (/SELECT requested_count, success_count, failure_count/i.test(sql)) {
      const job = this.jobs.get(String(args[0]));
      return job ? {
        requested_count: job.requested_count,
        success_count: job.success_count,
        failure_count: job.failure_count,
      } : null;
    }
    if (/SUM\(CASE WHEN status = 'completed'/i.test(sql)) {
      const rows = Array.from(this.items.values()).filter((item) => item.job_id === String(args[0]));
      return {
        success_count: rows.filter((item) => item.status === "completed").length,
        failure_count: rows.filter((item) => item.status === "failed").length,
        requested_count: rows.length,
      };
    }
    throw new Error(`Unhandled job first SQL: ${sql}`);
  }

  async all(sql: string, args: unknown[]) {
    if (/FROM report_admin_job_items/i.test(sql)) {
      return { results: Array.from(this.items.values()).filter((item) => item.job_id === String(args[0])) };
    }
    if (/FROM report_admin_jobs/i.test(sql)) {
      const limit = Number(sql.match(/LIMIT (\d+)/i)?.[1] || 20);
      return { results: Array.from(this.jobs.values()).sort((left, right) => right.requested_at.localeCompare(left.requested_at)).slice(0, limit) };
    }
    throw new Error(`Unhandled job all SQL: ${sql}`);
  }
}

async function call(db: JobD1, path: string, body: unknown, secret = "") {
  const headers = new Headers({ "Content-Type": "application/json", Origin: "https://aireport.ai-hub-os.com" });
  if (secret) headers.set("X-Report-Lifecycle-Secret", secret);
  const response = await worker.fetch(new Request(`https://jobs.test${path}`, {
    method: path.startsWith("/internal/") && !body ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: db,
    ADMIN_PASSWORD: "admin-test-password",
    LIFECYCLE_WORKER_SECRET: "lifecycle-test-secret",
  } as any);
  return { response, json: await response.json() as any };
}

test("make-private fails closed and records a failed job when GitHub dispatch is not configured", async () => {
  const db = new JobD1();
  const result = await call(db, "/admin/report-actions", {
    action: "make_private",
    reportIds: ["report-one"],
    adminPassword: "admin-test-password",
  });
  assert.equal(result.response.status, 503);
  assert.equal(result.json.job.status, "failed");
  assert.equal(db.jobs.get(result.json.job.id)?.error_message, "github_lifecycle_not_configured");
});

test("lifecycle job endpoints require the secret and report partial item outcomes", async () => {
  const db = new JobD1();
  db.seedJob("job-123", "delete", ["report-one", "report-two"]);

  const unauthorized = await call(db, "/internal/report-jobs/job-123");
  assert.equal(unauthorized.response.status, 401);

  const started = await call(db, "/internal/report-jobs/job-123/start", {}, "lifecycle-test-secret");
  assert.equal(started.response.status, 200);
  assert.equal(started.json.job.status, "running");

  const completed = await call(db, "/internal/report-jobs/job-123/items/report-one", {
    status: "completed",
    privateReportId: "private-report-one",
  }, "lifecycle-test-secret");
  assert.equal(completed.response.status, 200);
  assert.equal(completed.json.job.success_count, 1);

  const failed = await call(db, "/internal/report-jobs/job-123/items/report-two", {
    status: "failed",
    errorMessage: "source_missing",
  }, "lifecycle-test-secret");
  assert.equal(failed.response.status, 200);
  assert.equal(failed.json.job.failure_count, 1);

  const finished = await call(db, "/internal/report-jobs/job-123/complete", {}, "lifecycle-test-secret");
  assert.equal(finished.response.status, 200);
  assert.equal(finished.json.job.status, "partial");
  assert.equal(finished.json.items.length, 2);
});
