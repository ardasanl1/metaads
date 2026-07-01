import { neon } from "@neondatabase/serverless";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { decryptToken, encryptToken } from "./token-crypto";

const CONNECTION_ID = "default";

type StoredConnection = {
  accessTokenEncrypted: string;
  selectedAdAccountId: string;
  selectedAdAccountName: string;
  metaUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MetaConnection = {
  accessToken: string;
  selectedAdAccountId: string;
  selectedAdAccountName: string;
  metaUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type MetaConnectionRow = {
  id: string;
  access_token_encrypted: string;
  meta_user_id: string | null;
  selected_ad_account_id: string;
  selected_ad_account_name: string;
  created_at: string;
  updated_at: string;
};

let tableReady = false;

function getDatabaseUrl(): string | null {
  return (
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    null
  );
}

function hasPostgres(): boolean {
  return Boolean(getDatabaseUrl());
}

function getSql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("POSTGRES_URL veya DATABASE_URL tanimli degil");
  }
  return neon(url);
}

async function ensureTable(): Promise<void> {
  if (!hasPostgres() || tableReady) return;

  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS meta_connections (
      id TEXT PRIMARY KEY,
      access_token_encrypted TEXT NOT NULL,
      meta_user_id TEXT,
      selected_ad_account_id TEXT NOT NULL,
      selected_ad_account_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  tableReady = true;
}

function getLocalFilePath(): string {
  const dataDir = join(process.cwd(), ".data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, "meta-connection.txt");
}

async function readFromFile(): Promise<StoredConnection | null> {
  const filePath = getLocalFilePath();
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as StoredConnection;
  } catch {
    return null;
  }
}

function writeToFile(data: StoredConnection): void {
  writeFileSync(getLocalFilePath(), JSON.stringify(data, null, 2), "utf8");
}

function removeFile(): void {
  const filePath = getLocalFilePath();
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

async function readFromPostgres(): Promise<StoredConnection | null> {
  await ensureTable();
  const sql = getSql();
  const rows = await sql`
    SELECT id, access_token_encrypted, meta_user_id,
           selected_ad_account_id, selected_ad_account_name,
           created_at, updated_at
    FROM meta_connections
    WHERE id = ${CONNECTION_ID}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0] as MetaConnectionRow;
  return {
    accessTokenEncrypted: row.access_token_encrypted,
    selectedAdAccountId: row.selected_ad_account_id,
    selectedAdAccountName: row.selected_ad_account_name,
    metaUserId: row.meta_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function writeToPostgres(data: StoredConnection): Promise<void> {
  await ensureTable();
  const sql = getSql();
  await sql`
    INSERT INTO meta_connections (
      id, access_token_encrypted, meta_user_id,
      selected_ad_account_id, selected_ad_account_name,
      created_at, updated_at
    ) VALUES (
      ${CONNECTION_ID},
      ${data.accessTokenEncrypted},
      ${data.metaUserId},
      ${data.selectedAdAccountId},
      ${data.selectedAdAccountName},
      ${data.createdAt},
      ${data.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      meta_user_id = EXCLUDED.meta_user_id,
      selected_ad_account_id = EXCLUDED.selected_ad_account_id,
      selected_ad_account_name = EXCLUDED.selected_ad_account_name,
      updated_at = EXCLUDED.updated_at
  `;
}

async function removeFromPostgres(): Promise<void> {
  if (!hasPostgres()) return;
  await ensureTable();
  const sql = getSql();
  await sql`DELETE FROM meta_connections WHERE id = ${CONNECTION_ID}`;
}

async function readStored(): Promise<StoredConnection | null> {
  if (hasPostgres()) {
    return readFromPostgres();
  }
  if (process.env.VERCEL === "1") {
    throw new Error("POSTGRES_URL veya DATABASE_URL tanimli degil");
  }
  return readFromFile();
}

async function writeStored(data: StoredConnection): Promise<void> {
  if (hasPostgres()) {
    await writeToPostgres(data);
    return;
  }
  if (process.env.VERCEL === "1") {
    throw new Error("POSTGRES_URL veya DATABASE_URL tanimli degil");
  }
  writeToFile(data);
}

async function removeStored(): Promise<void> {
  if (hasPostgres()) {
    await removeFromPostgres();
    return;
  }
  if (process.env.VERCEL === "1") {
    throw new Error("POSTGRES_URL veya DATABASE_URL tanimli degil");
  }
  removeFile();
}

export async function getMetaConnection(): Promise<MetaConnection | null> {
  const stored = await readStored();
  if (!stored) return null;

  return {
    accessToken: decryptToken(stored.accessTokenEncrypted),
    selectedAdAccountId: stored.selectedAdAccountId,
    selectedAdAccountName: stored.selectedAdAccountName,
    metaUserId: stored.metaUserId,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

export async function saveMetaConnection(input: {
  accessToken: string;
  adAccountId: string;
  adAccountName: string;
  metaUserId?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const existing = await readStored();

  await writeStored({
    accessTokenEncrypted: encryptToken(input.accessToken),
    selectedAdAccountId: input.adAccountId,
    selectedAdAccountName: input.adAccountName,
    metaUserId: input.metaUserId ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function deleteMetaConnection(): Promise<void> {
  await removeStored();
}
