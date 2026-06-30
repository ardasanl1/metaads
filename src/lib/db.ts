import { createClient, type Client } from "@libsql/client";
import { decryptToken, encryptToken } from "./token-crypto";

const CONNECTION_ID = "default";
const META_SETTINGS_ID = "default";

let client: Client | null = null;
let initialized = false;

function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error("Turso yapilandirmasi eksik");
    }
    client = createClient({ url, authToken });
  }

  return client;
}

export async function ensureDb(): Promise<void> {
  if (initialized) return;

  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meta_connections (
      id TEXT PRIMARY KEY,
      access_token_encrypted TEXT NOT NULL,
      token_expires_at TEXT,
      meta_user_id TEXT,
      selected_ad_account_id TEXT,
      selected_ad_account_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meta_settings (
      id TEXT PRIMARY KEY,
      app_id TEXT NOT NULL,
      app_secret_encrypted TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      api_version TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  initialized = true;
}

export type MetaConnection = {
  id: string;
  accessToken: string;
  tokenExpiresAt: string | null;
  metaUserId: string | null;
  selectedAdAccountId: string | null;
  selectedAdAccountName: string | null;
  createdAt: string;
  updatedAt: string;
};

type MetaConnectionRow = {
  id: string;
  access_token_encrypted: string;
  token_expires_at: string | null;
  meta_user_id: string | null;
  selected_ad_account_id: string | null;
  selected_ad_account_name: string | null;
  created_at: string;
  updated_at: string;
};

export type MetaSettingsRecord = {
  id: string;
  appId: string;
  appSecretEncrypted: string;
  redirectUri: string;
  apiVersion: string;
  updatedAt: string;
};

type MetaSettingsRow = {
  id: string;
  app_id: string;
  app_secret_encrypted: string;
  redirect_uri: string;
  api_version: string;
  updated_at: string;
};

function mapConnectionRow(row: MetaConnectionRow): MetaConnection {
  return {
    id: row.id,
    accessToken: decryptToken(row.access_token_encrypted),
    tokenExpiresAt: row.token_expires_at,
    metaUserId: row.meta_user_id,
    selectedAdAccountId: row.selected_ad_account_id,
    selectedAdAccountName: row.selected_ad_account_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMetaSettingsRow(row: MetaSettingsRow): MetaSettingsRecord {
  return {
    id: row.id,
    appId: row.app_id,
    appSecretEncrypted: row.app_secret_encrypted,
    redirectUri: row.redirect_uri,
    apiVersion: row.api_version,
    updatedAt: row.updated_at,
  };
}

export async function getMetaConnection(): Promise<MetaConnection | null> {
  await ensureDb();
  const result = await getClient().execute({
    sql: "SELECT * FROM meta_connections WHERE id = ? LIMIT 1",
    args: [CONNECTION_ID],
  });

  if (result.rows.length === 0) return null;
  return mapConnectionRow(result.rows[0] as unknown as MetaConnectionRow);
}

export async function saveMetaConnection(input: {
  accessToken: string;
  tokenExpiresAt?: string | null;
  metaUserId: string;
}): Promise<void> {
  await ensureDb();
  const now = new Date().toISOString();
  const encrypted = encryptToken(input.accessToken);

  await getClient().execute({
    sql: `
      INSERT INTO meta_connections (
        id, access_token_encrypted, token_expires_at, meta_user_id,
        selected_ad_account_id, selected_ad_account_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        access_token_encrypted = excluded.access_token_encrypted,
        token_expires_at = excluded.token_expires_at,
        meta_user_id = excluded.meta_user_id,
        selected_ad_account_id = NULL,
        selected_ad_account_name = NULL,
        updated_at = excluded.updated_at
    `,
    args: [
      CONNECTION_ID,
      encrypted,
      input.tokenExpiresAt ?? null,
      input.metaUserId,
      now,
      now,
    ],
  });
}

export async function updateSelectedAdAccount(
  accountId: string,
  accountName: string,
): Promise<void> {
  await ensureDb();
  const now = new Date().toISOString();

  await getClient().execute({
    sql: `
      UPDATE meta_connections
      SET selected_ad_account_id = ?, selected_ad_account_name = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [accountId, accountName, now, CONNECTION_ID],
  });
}

export async function deleteMetaConnection(): Promise<void> {
  await ensureDb();
  await getClient().execute({
    sql: "DELETE FROM meta_connections WHERE id = ?",
    args: [CONNECTION_ID],
  });
}

export async function getMetaSettingsRecord(): Promise<MetaSettingsRecord | null> {
  await ensureDb();
  const result = await getClient().execute({
    sql: "SELECT * FROM meta_settings WHERE id = ? LIMIT 1",
    args: [META_SETTINGS_ID],
  });

  if (result.rows.length === 0) return null;
  return mapMetaSettingsRow(result.rows[0] as unknown as MetaSettingsRow);
}

export async function saveMetaSettingsRecord(input: {
  appId: string;
  appSecretEncrypted: string;
  redirectUri: string;
  apiVersion: string;
}): Promise<void> {
  await ensureDb();
  const now = new Date().toISOString();

  await getClient().execute({
    sql: `
      INSERT INTO meta_settings (
        id, app_id, app_secret_encrypted, redirect_uri, api_version, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        app_id = excluded.app_id,
        app_secret_encrypted = excluded.app_secret_encrypted,
        redirect_uri = excluded.redirect_uri,
        api_version = excluded.api_version,
        updated_at = excluded.updated_at
    `,
    args: [
      META_SETTINGS_ID,
      input.appId,
      input.appSecretEncrypted,
      input.redirectUri,
      input.apiVersion,
      now,
    ],
  });
}
