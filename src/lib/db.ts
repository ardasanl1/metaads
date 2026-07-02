import { neon } from "@neondatabase/serverless";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { decryptToken, encryptToken } from "./token-crypto";
import { normalizeAdAccountId } from "@/utils/ad-account";
import type { LinkedAdAccount } from "@/types/meta";

const LEGACY_CONNECTION_ID = "default";

type StoredConnection = {
  id: string;
  accessTokenEncrypted: string;
  metaUserId: string | null;
  metaUserName: string | null;
  metaBusinessId: string | null;
  selectedAdAccountId: string;
  selectedAdAccountName: string;
  linkedAdAccountsJson: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MetaConnection = {
  id: string;
  accessToken: string;
  metaUserId: string | null;
  metaUserName: string | null;
  metaBusinessId: string | null;
  selectedAdAccountId: string;
  selectedAdAccountName: string;
  linkedAdAccounts: LinkedAdAccount[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MetaConnectionSummary = Omit<MetaConnection, "accessToken">;

type MetaConnectionRow = {
  id: string;
  access_token_encrypted: string;
  meta_user_id: string | null;
  meta_user_name: string | null;
  meta_business_id: string | null;
  selected_ad_account_id: string;
  selected_ad_account_name: string;
  linked_ad_accounts: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function parseLinkedAdAccountsJson(raw: string | null | undefined): LinkedAdAccount[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as LinkedAdAccount[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.id)
      .map((item) => ({
        id: normalizeAdAccountId(item.id),
        accountId: item.accountId || normalizeAdAccountId(item.id).replace(/^act_/, ""),
        name: item.name || "",
        addedAt: item.addedAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function serializeLinkedAdAccounts(accounts: LinkedAdAccount[]): string {
  return JSON.stringify(accounts);
}

function ensureLinkedAdAccounts(stored: StoredConnection): LinkedAdAccount[] {
  let linked = parseLinkedAdAccountsJson(stored.linkedAdAccountsJson);
  if (linked.length === 0 && stored.selectedAdAccountId) {
    const id = normalizeAdAccountId(stored.selectedAdAccountId);
    linked = [
      {
        id,
        accountId: id.replace(/^act_/, ""),
        name: stored.selectedAdAccountName,
        addedAt: stored.createdAt,
      },
    ];
  }
  return linked;
}

type LocalStore = {
  connections: StoredConnection[];
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
      meta_user_name TEXT,
      selected_ad_account_id TEXT NOT NULL DEFAULT '',
      selected_ad_account_name TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await sql`
    ALTER TABLE meta_connections
    ADD COLUMN IF NOT EXISTS meta_user_name TEXT
  `;
  await sql`
    ALTER TABLE meta_connections
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false
  `;
  await sql`
    ALTER TABLE meta_connections
    ADD COLUMN IF NOT EXISTS linked_ad_accounts TEXT NOT NULL DEFAULT '[]'
  `;
  await sql`
    ALTER TABLE meta_connections
    ADD COLUMN IF NOT EXISTS meta_business_id TEXT
  `;

  tableReady = true;
}

function getLocalFilePath(): string {
  const dataDir = join(process.cwd(), ".data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, "meta-connections.json");
}

function getLegacyFilePath(): string {
  return join(process.cwd(), ".data", "meta-connection.txt");
}

function rowToStored(row: MetaConnectionRow): StoredConnection {
  return {
    id: row.id,
    accessTokenEncrypted: row.access_token_encrypted,
    metaUserId: row.meta_user_id,
    metaUserName: row.meta_user_name,
    metaBusinessId: row.meta_business_id,
    selectedAdAccountId: row.selected_ad_account_id,
    selectedAdAccountName: row.selected_ad_account_name,
    linkedAdAccountsJson: row.linked_ad_accounts ?? "[]",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMetaConnection(stored: StoredConnection): MetaConnection {
  const linkedAdAccounts = ensureLinkedAdAccounts(stored);
  return {
    id: stored.id,
    accessToken: decryptToken(stored.accessTokenEncrypted),
    metaUserId: stored.metaUserId,
    metaUserName: stored.metaUserName,
    metaBusinessId: stored.metaBusinessId,
    selectedAdAccountId: stored.selectedAdAccountId
      ? normalizeAdAccountId(stored.selectedAdAccountId)
      : "",
    selectedAdAccountName: stored.selectedAdAccountName,
    linkedAdAccounts,
    isActive: stored.isActive,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

function toSummary(connection: MetaConnection): MetaConnectionSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { accessToken, ...summary } = connection;
  return summary;
}

function migrateLegacyStored(legacy: {
  accessTokenEncrypted: string;
  selectedAdAccountId: string;
  selectedAdAccountName: string;
  metaUserId: string | null;
  createdAt: string;
  updatedAt: string;
}): StoredConnection {
  const id = legacy.metaUserId ?? LEGACY_CONNECTION_ID;
  return {
    id,
    accessTokenEncrypted: legacy.accessTokenEncrypted,
    metaUserId: legacy.metaUserId,
    metaUserName: null,
    metaBusinessId: null,
    selectedAdAccountId: legacy.selectedAdAccountId,
    selectedAdAccountName: legacy.selectedAdAccountName,
    linkedAdAccountsJson: legacy.selectedAdAccountId
      ? serializeLinkedAdAccounts([
          {
            id: normalizeAdAccountId(legacy.selectedAdAccountId),
            accountId: normalizeAdAccountId(legacy.selectedAdAccountId).replace(/^act_/, ""),
            name: legacy.selectedAdAccountName,
            addedAt: legacy.createdAt,
          },
        ])
      : "[]",
    isActive: true,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
}

async function readAllFromPostgres(): Promise<StoredConnection[]> {
  await ensureTable();
  const sql = getSql();
  const rows = await sql`
    SELECT id, access_token_encrypted, meta_user_id, meta_user_name, meta_business_id,
           selected_ad_account_id, selected_ad_account_name, linked_ad_accounts,
           is_active, created_at, updated_at
    FROM meta_connections
    ORDER BY created_at ASC
  `;

  const connections = (rows as MetaConnectionRow[]).map(rowToStored);

  const legacy = connections.find((item) => item.id === LEGACY_CONNECTION_ID);
  if (legacy?.metaUserId && legacy.id === LEGACY_CONNECTION_ID) {
    const migrated = { ...legacy, id: legacy.metaUserId, isActive: true };
    await writeAllToPostgres(
      connections
        .filter((item) => item.id !== LEGACY_CONNECTION_ID)
        .concat(migrated),
    );
    return readAllFromPostgres();
  }

  return connections;
}

async function writeAllToPostgres(connections: StoredConnection[]): Promise<void> {
  await ensureTable();
  const sql = getSql();

  await sql`DELETE FROM meta_connections`;

  for (const connection of connections) {
    await sql`
      INSERT INTO meta_connections (
        id, access_token_encrypted, meta_user_id, meta_user_name, meta_business_id,
        selected_ad_account_id, selected_ad_account_name, linked_ad_accounts,
        is_active, created_at, updated_at
      ) VALUES (
        ${connection.id},
        ${connection.accessTokenEncrypted},
        ${connection.metaUserId},
        ${connection.metaUserName},
        ${connection.metaBusinessId},
        ${connection.selectedAdAccountId},
        ${connection.selectedAdAccountName},
        ${connection.linkedAdAccountsJson},
        ${connection.isActive},
        ${connection.createdAt},
        ${connection.updatedAt}
      )
    `;
  }
}

function readAllFromFile(): StoredConnection[] {
  const filePath = getLocalFilePath();
  if (existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as LocalStore;
      return (parsed.connections ?? []).map((item) => ({
        ...item,
        metaBusinessId: item.metaBusinessId ?? null,
        linkedAdAccountsJson: item.linkedAdAccountsJson ?? "[]",
      }));
    } catch {
      return [];
    }
  }

  const legacyPath = getLegacyFilePath();
  if (!existsSync(legacyPath)) return [];

  try {
    const legacy = JSON.parse(readFileSync(legacyPath, "utf8")) as {
      accessTokenEncrypted: string;
      selectedAdAccountId: string;
      selectedAdAccountName: string;
      metaUserId: string | null;
      createdAt: string;
      updatedAt: string;
    };
    const migrated = migrateLegacyStored(legacy);
    writeAllToFile([migrated]);
    unlinkSync(legacyPath);
    return [migrated];
  } catch {
    return [];
  }
}

function writeAllToFile(connections: StoredConnection[]): void {
  const payload: LocalStore = { connections };
  writeFileSync(getLocalFilePath(), JSON.stringify(payload, null, 2), "utf8");
}

async function readAllStored(): Promise<StoredConnection[]> {
  if (hasPostgres()) {
    return readAllFromPostgres();
  }
  if (process.env.VERCEL === "1") {
    throw new Error("POSTGRES_URL veya DATABASE_URL tanimli degil");
  }
  return readAllFromFile();
}

async function writeAllStored(connections: StoredConnection[]): Promise<void> {
  if (hasPostgres()) {
    await writeAllToPostgres(connections);
    return;
  }
  if (process.env.VERCEL === "1") {
    throw new Error("POSTGRES_URL veya DATABASE_URL tanimli degil");
  }
  writeAllToFile(connections);
}

function ensureSingleActive(connections: StoredConnection[]): StoredConnection[] {
  const active = connections.filter((item) => item.isActive);
  if (active.length === 1) return connections;
  if (active.length === 0 && connections.length > 0) {
    return connections.map((item, index) => ({ ...item, isActive: index === 0 }));
  }
  let foundActive = false;
  return connections.map((item) => {
    if (item.isActive && !foundActive) {
      foundActive = true;
      return item;
    }
    return { ...item, isActive: false };
  });
}

export async function listMetaConnections(): Promise<MetaConnectionSummary[]> {
  const stored = await readAllStored();
  return ensureSingleActive(stored).map((item) => toSummary(toMetaConnection(item)));
}

export async function getActiveMetaConnection(): Promise<MetaConnection | null> {
  const stored = ensureSingleActive(await readAllStored());
  const active = stored.find((item) => item.isActive) ?? stored[0];
  if (!active) return null;
  return toMetaConnection(active);
}

export async function getMetaConnectionById(connectionId: string): Promise<MetaConnection | null> {
  const stored = await readAllStored();
  const match = stored.find((item) => item.id === connectionId);
  if (!match) return null;
  return toMetaConnection(match);
}

export async function getMetaConnection(): Promise<MetaConnection | null> {
  return getActiveMetaConnection();
}

export async function saveMetaConnection(input: {
  accessToken: string;
  metaUserId: string;
  metaUserName?: string | null;
  metaBusinessId?: string | null;
  adAccountId?: string;
  adAccountName?: string;
}): Promise<MetaConnectionSummary> {
  const now = new Date().toISOString();
  const connections = await readAllStored();
  const connectionId = input.metaUserId;
  const existing = connections.find((item) => item.id === connectionId);

  const nextConnection: StoredConnection = {
    id: connectionId,
    accessTokenEncrypted: encryptToken(input.accessToken),
    metaUserId: input.metaUserId,
    metaUserName: input.metaUserName ?? existing?.metaUserName ?? null,
    metaBusinessId: input.metaBusinessId ?? existing?.metaBusinessId ?? null,
    selectedAdAccountId: input.adAccountId
      ? normalizeAdAccountId(input.adAccountId)
      : existing?.selectedAdAccountId ?? "",
    selectedAdAccountName: input.adAccountName ?? existing?.selectedAdAccountName ?? "",
    linkedAdAccountsJson: existing?.linkedAdAccountsJson ?? "[]",
    isActive: existing?.isActive ?? connections.length === 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (input.adAccountId) {
    const id = normalizeAdAccountId(input.adAccountId);
    const linked = parseLinkedAdAccountsJson(nextConnection.linkedAdAccountsJson);
    if (!linked.some((item) => item.id === id)) {
      linked.push({
        id,
        accountId: id.replace(/^act_/, ""),
        name: input.adAccountName ?? "",
        addedAt: now,
      });
      nextConnection.linkedAdAccountsJson = serializeLinkedAdAccounts(linked);
    }
  }

  const withoutCurrent = connections.filter((item) => item.id !== connectionId);
  const next = ensureSingleActive([...withoutCurrent, nextConnection]);
  await writeAllStored(next);

  return toSummary(toMetaConnection(nextConnection));
}

export async function updateMetaUserName(
  connectionId: string,
  metaUserName: string,
): Promise<void> {
  const connections = await readAllStored();
  const now = new Date().toISOString();
  const next = connections.map((item) =>
    item.id === connectionId
      ? { ...item, metaUserName: metaUserName.trim(), updatedAt: now }
      : item,
  );
  await writeAllStored(next);
}

export async function updateMetaBusinessId(
  connectionId: string,
  metaBusinessId: string,
): Promise<void> {
  const connections = await readAllStored();
  const now = new Date().toISOString();
  const next = connections.map((item) =>
    item.id === connectionId
      ? { ...item, metaBusinessId: metaBusinessId.trim(), updatedAt: now }
      : item,
  );
  await writeAllStored(next);
}

export async function setActiveConnection(connectionId: string): Promise<MetaConnectionSummary | null> {
  const connections = await readAllStored();
  if (!connections.some((item) => item.id === connectionId)) {
    return null;
  }

  const next = connections.map((item) => ({
    ...item,
    isActive: item.id === connectionId,
    updatedAt: item.id === connectionId ? new Date().toISOString() : item.updatedAt,
  }));

  await writeAllStored(next);
  const active = next.find((item) => item.id === connectionId);
  return active ? toSummary(toMetaConnection(active)) : null;
}

export async function deleteMetaConnection(connectionId?: string): Promise<void> {
  const connections = await readAllStored();
  if (connections.length === 0) return;

  const targetId = connectionId ?? connections.find((item) => item.isActive)?.id;
  if (!targetId) return;

  const remaining = connections.filter((item) => item.id !== targetId);
  if (remaining.length === 0) {
    await writeAllStored([]);
    return;
  }

  if (!remaining.some((item) => item.isActive)) {
    remaining[0] = { ...remaining[0], isActive: true };
  }

  await writeAllStored(remaining);
}

export async function updateSelectedAdAccount(input: {
  connectionId?: string;
  adAccountId: string;
  adAccountName: string;
}): Promise<void> {
  const connections = await readAllStored();
  const targetId =
    input.connectionId ?? connections.find((item) => item.isActive)?.id ?? null;

  if (!targetId) {
    throw new Error("Meta baglantisi bulunamadi");
  }

  const now = new Date().toISOString();
  const next = connections.map((item) =>
    item.id === targetId
      ? {
          ...item,
          selectedAdAccountId: normalizeAdAccountId(input.adAccountId),
          selectedAdAccountName: input.adAccountName,
          updatedAt: now,
        }
      : item,
  );

  await writeAllStored(next);
}

export async function addLinkedAdAccount(input: {
  connectionId: string;
  adAccountId: string;
  adAccountName: string;
  select?: boolean;
}): Promise<{ linkedAdAccounts: LinkedAdAccount[]; selectedAdAccountId: string; selectedAdAccountName: string }> {
  const connections = await readAllStored();
  const target = connections.find((item) => item.id === input.connectionId);
  if (!target) {
    throw new Error("Meta baglantisi bulunamadi");
  }

  const now = new Date().toISOString();
  const id = normalizeAdAccountId(input.adAccountId);
  let linked = ensureLinkedAdAccounts(target);
  const existing = linked.find((item) => item.id === id);

  if (existing) {
    existing.name = input.adAccountName || existing.name;
  } else {
    linked = [
      ...linked,
      {
        id,
        accountId: id.replace(/^act_/, ""),
        name: input.adAccountName,
        addedAt: now,
      },
    ];
  }

  const shouldSelect = input.select ?? true;
  const next = connections.map((item) =>
    item.id === input.connectionId
      ? {
          ...item,
          linkedAdAccountsJson: serializeLinkedAdAccounts(linked),
          selectedAdAccountId: shouldSelect ? id : item.selectedAdAccountId,
          selectedAdAccountName: shouldSelect
            ? input.adAccountName || existing?.name || item.selectedAdAccountName
            : item.selectedAdAccountName,
          updatedAt: now,
        }
      : item,
  );

  await writeAllStored(next);

  const updated = next.find((item) => item.id === input.connectionId);
  const connection = toMetaConnection(updated!);
  return {
    linkedAdAccounts: connection.linkedAdAccounts,
    selectedAdAccountId: connection.selectedAdAccountId,
    selectedAdAccountName: connection.selectedAdAccountName,
  };
}

export async function listLinkedAdAccounts(connectionId: string): Promise<LinkedAdAccount[]> {
  const connection = await getMetaConnectionById(connectionId);
  return connection?.linkedAdAccounts ?? [];
}
