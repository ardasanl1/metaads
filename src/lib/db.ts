import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { del, list, put } from "@vercel/blob";
import { decryptToken, encryptToken } from "./token-crypto";

const BLOB_PATHNAME = "meta-connection.txt";

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

type StorageMode = "blob" | "file";

function getStorageMode(): StorageMode {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return "blob";
  }
  if (process.env.VERCEL === "1") {
    throw new Error(
      "Vercel ortaminda Blob Store gerekli. Storage → Blob olusturup BLOB_READ_WRITE_TOKEN ekleyin.",
    );
  }
  return "file";
}

function getLocalFilePath(): string {
  const dataDir = join(process.cwd(), ".data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, "meta-connection.txt");
}

async function readStored(): Promise<StoredConnection | null> {
  const mode = getStorageMode();

  if (mode === "blob") {
    try {
      const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 });
      if (blobs.length === 0) return null;
      const response = await fetch(blobs[0].url);
      if (!response.ok) return null;
      return (await response.json()) as StoredConnection;
    } catch {
      return null;
    }
  }

  const filePath = getLocalFilePath();
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as StoredConnection;
  } catch {
    return null;
  }
}

async function writeStored(data: StoredConnection): Promise<void> {
  const mode = getStorageMode();
  const content = JSON.stringify(data, null, 2);

  if (mode === "blob") {
    const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 10 });
    for (const blob of blobs) {
      await del(blob.url);
    }
    await put(BLOB_PATHNAME, content, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }

  writeFileSync(getLocalFilePath(), content, "utf8");
}

async function removeStored(): Promise<void> {
  const mode = getStorageMode();

  if (mode === "blob") {
    try {
      const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 });
      for (const blob of blobs) {
        await del(blob.url);
      }
    } catch {
      // dosya yoksa sorun degil
    }
    return;
  }

  const filePath = getLocalFilePath();
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
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
