import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { decryptToken, encryptToken } from "./token-crypto";

const DATA_DIR = join(process.cwd(), ".data");
const CONNECTION_FILE = join(DATA_DIR, "meta-connection.txt");

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

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStored(): StoredConnection | null {
  if (!existsSync(CONNECTION_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONNECTION_FILE, "utf8")) as StoredConnection;
  } catch {
    return null;
  }
}

function writeStored(data: StoredConnection): void {
  ensureDataDir();
  writeFileSync(CONNECTION_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function getMetaConnection(): Promise<MetaConnection | null> {
  const stored = readStored();
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
  const existing = readStored();

  writeStored({
    accessTokenEncrypted: encryptToken(input.accessToken),
    selectedAdAccountId: input.adAccountId,
    selectedAdAccountName: input.adAccountName,
    metaUserId: input.metaUserId ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function deleteMetaConnection(): Promise<void> {
  if (existsSync(CONNECTION_FILE)) {
    unlinkSync(CONNECTION_FILE);
  }
}
