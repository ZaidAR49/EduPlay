import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function parseEnvLines(raw) {
  const result = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function getSupabaseStatus() {
  const merged = {};
  try {
    const jsonRaw = execSync("supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    Object.assign(merged, JSON.parse(jsonRaw));
  } catch {
    // Ignore and rely on -o env below
  }

  try {
    const envRaw = execSync("supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsedEnv = parseEnvLines(envRaw);
    for (const [key, value] of Object.entries(parsedEnv)) {
      if (merged[key] === undefined || merged[key] === "") {
        merged[key] = value;
      }
    }
  } catch (err) {
    if (Object.keys(merged).length === 0) {
      throw err;
    }
  }

  return merged;
}

async function ensurePublicBucket(apiUrl, serviceRoleKey, bucketName) {
  const base = apiUrl.replace(/\/+$/, "");
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  const getRes = await fetch(`${base}/storage/v1/bucket/${bucketName}`, { headers });
  if (getRes.ok) {
    console.log(`[ci-bootstrap] Storage bucket "${bucketName}" already exists.`);
    return;
  }

  const createRes = await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: bucketName,
      name: bucketName,
      public: true,
    }),
  });

  if (!createRes.ok && createRes.status !== 409) {
    const body = await createRes.text();
    throw new Error(`Failed to create storage bucket "${bucketName}": ${createRes.status} ${body}`);
  }

  console.log(`[ci-bootstrap] Created public storage bucket "${bucketName}".`);
}

async function applySchema(databaseUrl, schemaPath) {
  const sqlText = fs.readFileSync(schemaPath, "utf8");
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(sqlText);
    console.log(`[ci-bootstrap] Applied schema from ${schemaPath}.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function writeEnvOutputs(envMap) {
  const envFilePath = path.resolve(process.cwd(), ".env.test");
  const lines = Object.entries(envMap).map(
    ([k, v]) => `${k}=${JSON.stringify(String(v))}`
  );
  fs.writeFileSync(envFilePath, lines.join("\n") + "\n", "utf8");
  console.log(`[ci-bootstrap] Wrote ${envFilePath}.`);

  const githubEnv = process.env.GITHUB_ENV;
  if (githubEnv) {
    const ghLines = Object.entries(envMap).map(([k, v]) => {
      const val = String(v).replace(/\r?\n/g, " ");
      return `${k}=${val}`;
    });
    fs.appendFileSync(githubEnv, ghLines.join("\n") + "\n", "utf8");
    console.log(`[ci-bootstrap] Exported ${ghLines.length} env vars to GITHUB_ENV.`);
  }
}

async function main() {
  const status = getSupabaseStatus();
  const apiUrl = status.API_URL || status.api_url || "http://127.0.0.1:54321";
  const dbUrl =
    status.DB_URL ||
    status.db_url ||
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  const anonKey =
    status.ANON_KEY ||
    status.anon_key ||
    status.PUBLISHABLE_KEY ||
    status.publishable_key;
  const serviceRoleKey =
    status.SERVICE_ROLE_KEY ||
    status.service_role_key ||
    status.SECRET_KEY ||
    status.secret_key;
  const s3Endpoint =
    status.STORAGE_S3_URL ||
    status.storage_s3_url ||
    `${apiUrl.replace(/\/+$/, "")}/storage/v1/s3`;
  const s3AccessKeyId =
    status.S3_PROTOCOL_ACCESS_KEY_ID ||
    status.s3_protocol_access_key_id ||
    status.S3_ACCESS_KEY_ID ||
    status.s3_access_key_id;
  const s3SecretKey =
    status.S3_PROTOCOL_ACCESS_KEY_SECRET ||
    status.s3_protocol_access_key_secret ||
    status.S3_SECRET_ACCESS_KEY ||
    status.s3_secret_access_key;

  if (!anonKey || !serviceRoleKey) {
    throw new Error(
      `Missing ANON_KEY or SERVICE_ROLE_KEY from 'supabase status': ${JSON.stringify(Object.keys(status))}`
    );
  }
  if (!s3AccessKeyId || !s3SecretKey) {
    throw new Error(
      `Missing S3_PROTOCOL_ACCESS_KEY_ID or S3_PROTOCOL_ACCESS_KEY_SECRET from 'supabase status': ${JSON.stringify(Object.keys(status))}`
    );
  }

  const bucketName = process.env.SUPABASE_S3_BUCKET || "logos";
  const schemaPath = path.resolve(process.cwd(), "tests/e2e/setup/ci-schema.sql");

  await applySchema(dbUrl, schemaPath);
  await ensurePublicBucket(apiUrl, serviceRoleKey, bucketName);

  const authSecret =
    process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");

  writeEnvOutputs({
    DATABASE_URL: dbUrl,
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_S3_ENDPOINT: s3Endpoint,
    SUPABASE_S3_REGION: "local",
    SUPABASE_S3_BUCKET: bucketName,
    SUPABASE_S3_ACCESS_KEY_ID: s3AccessKeyId,
    SUPABASE_S3_SECRET_ACCESS_KEY: s3SecretKey,
    AUTH_SECRET: authSecret,
    AUTH_URL: "http://localhost:3000",
    AUTH_TRUST_HOST: "true",
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || "ci-dummy-google-id",
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || "ci-dummy-google-secret",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_ENV: "dev",
  });
}

main().catch((err) => {
  console.error("[ci-bootstrap] Failed:", err);
  process.exit(1);
});
