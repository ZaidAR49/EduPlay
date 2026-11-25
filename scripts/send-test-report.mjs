import fs from "node:fs";
import path from "node:path";

const ANSI_REGEX = /\u001b\[[0-9;]*m/g;

function stripAnsi(text) {
  return String(text || "").replace(ANSI_REGEX, "");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function collectTestResults(suites, parentTitles = [], out = []) {
  for (const suite of suites || []) {
    const nextTitles = suite.title ? [...parentTitles, suite.title] : parentTitles;

    for (const spec of suite.specs || []) {
      const fullTitle = [...nextTitles, spec.title].filter(Boolean).join(" › ");
      for (const test of spec.tests || []) {
        const results = test.results || [];
        const latest = results[results.length - 1] || {};
        const status = test.status || latest.status || "unknown";
        const durationMs = results.reduce((sum, r) => sum + (r.duration || 0), 0);
        const errorMessage =
          latest.error?.message ||
          (latest.errors && latest.errors[0]?.message) ||
          "";

        out.push({
          title: fullTitle,
          file: spec.file || suite.file || "",
          projectName: test.projectName || "chromium",
          status,
          durationMs,
          errorMessage: stripAnsi(errorMessage).slice(0, 600),
        });
      }
    }

    if (suite.suites) {
      collectTestResults(suite.suites, nextTitles, out);
    }
  }
  return out;
}

function summarizeReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return {
      missing: true,
      total: 0,
      passed: 0,
      failed: 0,
      flaky: 0,
      skipped: 0,
      durationMs: 0,
      failures: [],
      allTests: [],
    };
  }

  const raw = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const allTests = collectTestResults(raw.suites || []);

  let passed = 0;
  let failed = 0;
  let flaky = 0;
  let skipped = 0;
  const failures = [];

  for (const t of allTests) {
    if (t.status === "expected" || t.status === "passed") {
      passed++;
    } else if (t.status === "flaky") {
      flaky++;
      passed++;
    } else if (t.status === "skipped") {
      skipped++;
    } else {
      failed++;
      failures.push(t);
    }
  }

  const durationMs =
    raw.stats?.duration ??
    allTests.reduce((sum, t) => sum + t.durationMs, 0);

  return {
    missing: false,
    total: allTests.length,
    passed,
    failed,
    flaky,
    skipped,
    durationMs,
    failures,
    allTests,
  };
}

function buildEmailContent(summary) {
  const repo = process.env.GITHUB_REPOSITORY || "decision-hero-game";
  const runId = process.env.GITHUB_RUN_ID || "";
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const branch = process.env.GITHUB_REF_NAME || "local";
  const sha = (process.env.GITHUB_SHA || "").slice(0, 7) || "local";
  const actor = process.env.GITHUB_ACTOR || "developer";
  const eventName = process.env.GITHUB_EVENT_NAME || "manual";
  const runUrl = runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : "";

  const workflowFailed =
    process.env.TEST_JOB_OUTCOME === "failure" ||
    summary.missing ||
    summary.failed > 0;

  const badgeText = workflowFailed ? "FAILED" : "PASSED";
  const badgeColor = workflowFailed ? "#dc2626" : "#059669";
  const badgeBg = workflowFailed ? "#fef2f2" : "#ecfdf5";

  const subject = `[${badgeText}] EduPlay Regression Tests (${summary.passed}/${summary.total}) — ${branch}@${sha}`;

  const failureRows = summary.failures
    .map(
      (f) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;font-weight:600;vertical-align:top;">
          ${escapeHtml(f.title)}
          <div style="font-size:11px;color:#6b7280;font-weight:400;margin-top:2px;">${escapeHtml(f.file)}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#991b1b;font-family:monospace;white-space:pre-wrap;vertical-align:top;">
          ${escapeHtml(f.errorMessage || "No error details captured")}
        </td>
      </tr>`
    )
    .join("");

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:24px;color:#111827;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="padding:24px 28px;border-bottom:1px solid #e2e8f0;background:${badgeBg};">
        <span style="display:inline-block;background:${badgeColor};color:#ffffff;font-weight:700;font-size:12px;padding:4px 10px;border-radius:999px;letter-spacing:0.5px;">
          ${badgeText}
        </span>
        <h1 style="margin:12px 0 4px;font-size:20px;color:#0f172a;">EduPlay Pre-Deployment Regression Report</h1>
        <p style="margin:0;font-size:13px;color:#475569;">
          Repo: <strong>${escapeHtml(repo)}</strong> &bull; Branch: <strong>${escapeHtml(branch)}</strong> &bull; Commit: <code>${escapeHtml(sha)}</code>
        </p>
      </div>

      <div style="padding:24px 28px;">
        ${
          summary.missing
            ? `<p style="padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#991b1b;font-size:14px;">
                 Playwright JSON report was not generated (the build or setup step failed before tests finished). Check the GitHub Actions log for details.
               </p>`
            : ""
        }

        <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 -8px 20px;">
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:#0f172a;">${summary.total}</div>
              <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Total</div>
            </td>
            <td style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:#059669;">${summary.passed}</div>
              <div style="font-size:11px;color:#047857;text-transform:uppercase;">Passed</div>
            </td>
            <td style="background:${summary.failed > 0 ? "#fef2f2" : "#f8fafc"};border:1px solid ${summary.failed > 0 ? "#fecaca" : "#e2e8f0"};border-radius:10px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:${summary.failed > 0 ? "#dc2626" : "#64748b"};">${summary.failed}</div>
              <div style="font-size:11px;color:${summary.failed > 0 ? "#b91c1c" : "#64748b"};text-transform:uppercase;">Failed</div>
            </td>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:#0f172a;">${formatDuration(summary.durationMs)}</div>
              <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Duration</div>
            </td>
          </tr>
        </table>

        <p style="font-size:13px;color:#475569;margin:0 0 18px;">
          Triggered by <strong>${escapeHtml(actor)}</strong> via <code>${escapeHtml(eventName)}</code>.
          ${summary.flaky > 0 ? `Flaky (passed on retry): <strong>${summary.flaky}</strong>.` : ""}
          ${summary.skipped > 0 ? `Skipped: <strong>${summary.skipped}</strong>.` : ""}
        </p>

        ${
          summary.failures.length > 0
            ? `
          <h2 style="font-size:15px;color:#991b1b;margin:16px 0 8px;">Failed Tests</h2>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;">
            <thead>
              <tr style="background:#f9fafb;text-align:left;">
                <th style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563;">Test</th>
                <th style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563;">Error</th>
              </tr>
            </thead>
            <tbody>${failureRows}</tbody>
          </table>`
            : ""
        }

        ${
          runUrl
            ? `
          <div style="margin-top:24px;text-align:center;">
            <a href="${escapeHtml(runUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">
              Open Full Report &amp; Traces in GitHub Actions
            </a>
            <p style="margin:8px 0 0;font-size:12px;color:#64748b;">
              Download the <code>playwright-report</code> artifact on the run page to inspect screenshots, videos, and step-by-step traces.
            </p>
          </div>`
            : ""
        }
      </div>
    </div>
  </div>`;

  const text = [
    `EduPlay Regression Report — ${badgeText}`,
    `Repo: ${repo} | Branch: ${branch} | Commit: ${sha} | Trigger: ${eventName} (${actor})`,
    `Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Skipped: ${summary.skipped} | Duration: ${formatDuration(summary.durationMs)}`,
    ...(summary.failures.length > 0
      ? [
          "",
          "Failures:",
          ...summary.failures.map((f) => `- ${f.title}: ${f.errorMessage}`),
        ]
      : []),
    ...(runUrl ? ["", `GitHub Actions Run (HTML Report & Traces): ${runUrl}`] : []),
  ].join("\n");

  return { subject, html, text };
}

async function sendEmail({ subject, html, text }) {
  const recipient = (process.env.REPORT_EMAIL_TO || process.env.EMAIL || "").trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const resendFromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  const gmailUser = process.env.EMAIL?.trim();
  const gmailPassword = process.env.PASSWORD?.trim();

  if (!recipient) {
    console.log("[send-test-report] Skipping email: neither REPORT_EMAIL_TO nor EMAIL is set.");
    return;
  }

  if (resendApiKey && resendFromEmail) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: [recipient],
          subject,
          text,
          html,
        }),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }
      console.log(`[send-test-report] Report emailed via Resend to ${recipient}.`);
      return;
    } catch (resendError) {
      console.error("[send-test-report] Resend failed, checking Gmail SMTP fallback:", resendError);
      if (!(gmailUser && gmailPassword)) {
        throw resendError;
      }
    }
  }

  if (gmailUser && gmailPassword) {
    const { default: nodemailer } = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPassword },
    });
    await transporter.sendMail({
      from: gmailUser,
      to: recipient,
      subject,
      text,
      html,
    });
    console.log(`[send-test-report] Report emailed via Gmail SMTP to ${recipient}.`);
    return;
  }

  console.log(
    "[send-test-report] Skipping email: configure RESEND_API_KEY + RESEND_FROM_EMAIL, or EMAIL + PASSWORD."
  );
}

async function main() {
  const reportPath = path.resolve(
    process.cwd(),
    process.env.PLAYWRIGHT_JSON_OUTPUT_FILE || "test-results/results.json"
  );
  const summary = summarizeReport(reportPath);
  const emailContent = buildEmailContent(summary);
  console.log(`[send-test-report] Summary: ${emailContent.subject}`);
  await sendEmail(emailContent);
}

main().catch((err) => {
  console.error("[send-test-report] Failed to send email report:", err);
  if (process.argv.includes("--strict")) {
    process.exit(1);
  }
});
