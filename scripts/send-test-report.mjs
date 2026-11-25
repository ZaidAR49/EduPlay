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
  if (!ms || ms < 1000) {
    return `${Math.max(0, Math.round(ms || 0))}ms`;
  }
  const totalSec = (ms / 1000).toFixed(1);
  if (ms < 60_000) {
    return `${totalSec}s`;
  }
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function normalizeStatus(rawStatus) {
  if (rawStatus === "expected" || rawStatus === "passed") return "PASSED";
  if (rawStatus === "flaky") return "FLAKY";
  if (rawStatus === "skipped") return "SKIPPED";
  return "FAILED";
}

function getStatusBadgeStyle(statusLabel) {
  if (statusLabel === "PASSED") {
    return { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" };
  }
  if (statusLabel === "FLAKY") {
    return { bg: "#fffbeb", text: "#b45309", border: "#fde68a" };
  }
  if (statusLabel === "SKIPPED") {
    return { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
  }
  return { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };
}

function collectTestResults(suites, parentTitles = [], out = []) {
  for (const suite of suites || []) {
    const nextTitles = suite.title ? [...parentTitles, suite.title] : parentTitles;

    for (const spec of suite.specs || []) {
      const featureTitles = nextTitles.filter(
        (t) => !t.endsWith(".spec.ts") && !t.endsWith(".ts") && t !== "chromium"
      );
      const suiteName =
        featureTitles.join(" › ") || nextTitles[0] || spec.file || "General";
      const fullTitle = [suiteName, spec.title].filter(Boolean).join(" › ");

      for (const test of spec.tests || []) {
        const results = test.results || [];
        const latest = results[results.length - 1] || {};
        const rawStatus = test.status || latest.status || "unknown";
        const statusLabel = normalizeStatus(rawStatus);
        const durationMs = results.reduce((sum, r) => sum + (r.duration || 0), 0);
        const errorMessage =
          latest.error?.message ||
          (latest.errors && latest.errors[0]?.message) ||
          "";

        out.push({
          index: out.length + 1,
          suiteName,
          testName: spec.title || fullTitle,
          title: fullTitle,
          file: spec.file || suite.file || "",
          projectName: test.projectName || "chromium",
          status: rawStatus,
          statusLabel,
          durationMs,
          errorMessage: stripAnsi(errorMessage).slice(0, 800),
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
    if (t.statusLabel === "PASSED") {
      passed++;
    } else if (t.statusLabel === "FLAKY") {
      flaky++;
      passed++;
    } else if (t.statusLabel === "SKIPPED") {
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

function buildPlainTextReport(summary, meta) {
  const lines = [
    "================================================================================",
    `EDUPLAY PRE-DEPLOYMENT REGRESSION TEST REPORT — ${meta.badgeText}`,
    "================================================================================",
    `Repository : ${meta.repo}`,
    `Branch     : ${meta.branch}`,
    `Commit     : ${meta.sha}`,
    `Triggered  : ${meta.actor} via ${meta.eventName}`,
    `Timestamp  : ${new Date().toISOString()}`,
    `Summary    : Total=${summary.total} | Passed=${summary.passed} | Failed=${summary.failed} | Flaky=${summary.flaky} | Skipped=${summary.skipped} | Duration=${formatDuration(summary.durationMs)}`,
    meta.runUrl ? `Run URL    : ${meta.runUrl}` : null,
    "",
    "--------------------------------------------------------------------------------",
    "DATABASE ISOLATION & CLEANUP",
    "--------------------------------------------------------------------------------",
    "- Database Mode : Ephemeral isolated Supabase Docker containers (127.0.0.1)",
    "- Production DB : UNTOUCHED (no production DB/S3 credentials are given to CI)",
    "- Cleanup       : Test records deleted via afterAll() + containers destroyed on exit",
    "",
    "--------------------------------------------------------------------------------",
    "TEST CASES BREAKDOWN",
    "--------------------------------------------------------------------------------",
  ].filter((line) => line !== null);

  if (summary.missing) {
    lines.push(
      "Playwright JSON report was not generated (build or setup failed before tests ran)."
    );
  } else if (summary.allTests.length === 0) {
    lines.push("No test cases found in Playwright JSON output.");
  } else {
    const colIdx = "#".padEnd(3);
    const colStatus = "Result".padEnd(8);
    const colDur = "Time".padEnd(8);
    const colSuite = "Feature / Suite".padEnd(42);
    lines.push(`${colIdx} | ${colStatus} | ${colDur} | ${colSuite} | Test Case`);
    lines.push("-".repeat(120));

    for (const t of summary.allTests) {
      const idx = String(t.index).padEnd(3);
      const status = t.statusLabel.padEnd(8);
      const dur = formatDuration(t.durationMs).padEnd(8);
      const suite = t.suiteName.slice(0, 42).padEnd(42);
      lines.push(`${idx} | ${status} | ${dur} | ${suite} | ${t.testName}`);
    }
  }

  if (summary.failures.length > 0) {
    lines.push("");
    lines.push("--------------------------------------------------------------------------------");
    lines.push("FAILURE DETAILS");
    lines.push("--------------------------------------------------------------------------------");
    for (const f of summary.failures) {
      lines.push(`[${f.index}] ${f.title} (${f.file})`);
      lines.push(`    ${f.errorMessage || "No error message captured"}`);
      lines.push("");
    }
  }

  return lines.join("\n") + "\n";
}

function buildEmailContent(summary) {
  const repo = process.env.GITHUB_REPOSITORY || "ZaidAR49/EduPlay";
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

  const testCaseRows = summary.allTests
    .map((t, i) => {
      const pill = getStatusBadgeStyle(t.statusLabel);
      const rowBg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `
      <tr style="background:${rowBg};">
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;vertical-align:top;">
          ${t.index}
        </td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;font-weight:600;vertical-align:top;">
          ${escapeHtml(t.suiteName)}
        </td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;vertical-align:top;">
          ${escapeHtml(t.testName)}
        </td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:center;vertical-align:top;white-space:nowrap;">
          <span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;background:${pill.bg};color:${pill.text};border:1px solid ${pill.border};">
            ${t.statusLabel}
          </span>
        </td>
        <td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:right;vertical-align:top;white-space:nowrap;">
          ${formatDuration(t.durationMs)}
        </td>
      </tr>`;
    })
    .join("");

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
    <div style="max-width:820px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
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
          &nbsp;Full plain-text report is attached as <code>eduplay-regression-report.txt</code>.
        </p>

        ${
          summary.allTests.length > 0
            ? `
          <h2 style="font-size:15px;color:#0f172a;margin:18px 0 10px;">Test Case Results</h2>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#f1f5f9;text-align:left;">
                <th style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#475569;text-transform:uppercase;text-align:center;">#</th>
                <th style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#475569;text-transform:uppercase;">Feature / Suite</th>
                <th style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#475569;text-transform:uppercase;">Test Case</th>
                <th style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#475569;text-transform:uppercase;text-align:center;">Result</th>
                <th style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#475569;text-transform:uppercase;text-align:right;">Time</th>
              </tr>
            </thead>
            <tbody>${testCaseRows}</tbody>
          </table>`
            : ""
        }

        ${
          summary.failures.length > 0
            ? `
          <h2 style="font-size:15px;color:#991b1b;margin:22px 0 8px;">Failure Error Details</h2>
          <table style="width:100%;border-collapse:collapse;border:1px solid #fecaca;border-radius:8px;">
            <thead>
              <tr style="background:#fef2f2;text-align:left;">
                <th style="padding:8px 12px;border-bottom:1px solid #fecaca;font-size:12px;color:#991b1b;">Test</th>
                <th style="padding:8px 12px;border-bottom:1px solid #fecaca;font-size:12px;color:#991b1b;">Error</th>
              </tr>
            </thead>
            <tbody>${failureRows}</tbody>
          </table>`
            : ""
        }

        <div style="margin-top:20px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:12px;color:#475569;line-height:1.5;">
          <strong style="color:#0f172a;">Database Isolation &amp; Cleanup:</strong> Tests executed against an ephemeral local Supabase Docker stack (<code>127.0.0.1</code>) inside the CI runner. Production database and S3 storage were untouched, test records were cleaned up via <code>afterAll()</code>, and all containers are destroyed when the job exits.
        </div>

        ${
          runUrl
            ? `
          <div style="margin-top:22px;text-align:center;">
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

  const text = buildPlainTextReport(summary, {
    repo,
    branch,
    sha,
    actor,
    eventName,
    runUrl,
    badgeText,
  });

  return { subject, html, text };
}

async function sendEmail({ subject, html, text }) {
  const recipient = (process.env.REPORT_EMAIL_TO || process.env.EMAIL || "").trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const resendFromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  const gmailUser = process.env.EMAIL?.trim();
  const gmailPassword = process.env.PASSWORD?.trim();
  const attachmentFilename = "eduplay-regression-report.txt";

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
          attachments: [
            {
              filename: attachmentFilename,
              content: Buffer.from(text, "utf8").toString("base64"),
            },
          ],
        }),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }
      console.log(`[send-test-report] Report emailed via Resend to ${recipient} (with ${attachmentFilename}).`);
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
      attachments: [
        {
          filename: attachmentFilename,
          content: text,
          contentType: "text/plain; charset=utf-8",
        },
      ],
    });
    console.log(`[send-test-report] Report emailed via Gmail SMTP to ${recipient} (with ${attachmentFilename}).`);
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

  const txtOutputPath = path.resolve(process.cwd(), "test-results/regression-report.txt");
  fs.mkdirSync(path.dirname(txtOutputPath), { recursive: true });
  fs.writeFileSync(txtOutputPath, emailContent.text, "utf8");
  console.log(`[send-test-report] Wrote ${txtOutputPath}.`);

  console.log(`[send-test-report] Summary: ${emailContent.subject}`);
  await sendEmail(emailContent);
}

main().catch((err) => {
  console.error("[send-test-report] Failed to send email report:", err);
  if (process.argv.includes("--strict")) {
    process.exit(1);
  }
});
