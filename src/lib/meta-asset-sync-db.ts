import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import type {
  MetaAssetUsability,
  SyncedAdAccount,
  SyncedBusiness,
  SyncedInstagramAccount,
  SyncedPage,
  SyncedPixel,
} from "@/types/meta-asset-sync";

type LocalAssetStore = {
  businesses: SyncedBusiness[];
  adAccounts: SyncedAdAccount[];
  pages: SyncedPage[];
  instagramAccounts: SyncedInstagramAccount[];
  pixels: SyncedPixel[];
};

let tablesReady = false;

function getDatabaseUrl(): string | null {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? null;
}

function hasPostgres(): boolean {
  return Boolean(getDatabaseUrl());
}

function getSql() {
  const url = getDatabaseUrl();
  if (!url) throw new Error("POSTGRES_URL veya DATABASE_URL tanimli degil");
  return neon(url);
}

function localPath(): string {
  const dir = join(process.cwd(), ".data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "meta-asset-snapshots.json");
}

function readLocal(): LocalAssetStore {
  const path = localPath();
  if (!existsSync(path)) {
    return { businesses: [], adAccounts: [], pages: [], instagramAccounts: [], pixels: [] };
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LocalAssetStore;
  } catch {
    return { businesses: [], adAccounts: [], pages: [], instagramAccounts: [], pixels: [] };
  }
}

function writeLocal(store: LocalAssetStore): void {
  writeFileSync(localPath(), JSON.stringify(store, null, 2), "utf8");
}

async function ensureTables(): Promise<void> {
  if (!hasPostgres() || tablesReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS meta_businesses (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      meta_business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      usability TEXT NOT NULL,
      discovery_source TEXT NOT NULL,
      last_synced_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS meta_ad_accounts (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      meta_ad_account_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      business_id TEXT,
      usability TEXT NOT NULL,
      discovery_source TEXT NOT NULL,
      last_synced_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS meta_pages (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      meta_page_id TEXT NOT NULL,
      name TEXT NOT NULL,
      business_id TEXT,
      usability TEXT NOT NULL,
      discovery_source TEXT NOT NULL,
      instagram_business_account_id TEXT,
      last_synced_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS meta_instagram_accounts (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      meta_instagram_id TEXT NOT NULL,
      username TEXT,
      page_id TEXT,
      ad_account_id TEXT,
      usability TEXT NOT NULL,
      discovery_source TEXT NOT NULL,
      last_synced_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS meta_pixels (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      meta_pixel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      ad_account_id TEXT,
      business_id TEXT,
      usability TEXT NOT NULL,
      discovery_source TEXT NOT NULL,
      last_fired_time TEXT,
      last_synced_at TEXT NOT NULL
    )
  `;
  tablesReady = true;
}

export async function replaceConnectionAssetSnapshot(
  connectionId: string,
  snapshot: {
    businesses: Omit<SyncedBusiness, "id" | "connectionId">[];
    adAccounts: Omit<SyncedAdAccount, "id" | "connectionId">[];
    pages: Omit<SyncedPage, "id" | "connectionId">[];
    instagramAccounts: Omit<SyncedInstagramAccount, "id" | "connectionId">[];
    pixels: Omit<SyncedPixel, "id" | "connectionId">[];
  },
): Promise<void> {
  const now = new Date().toISOString();
  const businesses: SyncedBusiness[] = snapshot.businesses.map((b) => ({
    id: randomUUID(),
    connectionId,
    ...b,
    lastSyncedAt: b.lastSyncedAt || now,
  }));
  const adAccounts: SyncedAdAccount[] = snapshot.adAccounts.map((a) => ({
    id: randomUUID(),
    connectionId,
    ...a,
    lastSyncedAt: a.lastSyncedAt || now,
  }));
  const pages: SyncedPage[] = snapshot.pages.map((p) => ({
    id: randomUUID(),
    connectionId,
    ...p,
    lastSyncedAt: p.lastSyncedAt || now,
  }));
  const instagramAccounts: SyncedInstagramAccount[] = snapshot.instagramAccounts.map((i) => ({
    id: randomUUID(),
    connectionId,
    ...i,
    lastSyncedAt: i.lastSyncedAt || now,
  }));
  const pixels: SyncedPixel[] = snapshot.pixels.map((p) => ({
    id: randomUUID(),
    connectionId,
    ...p,
    lastSyncedAt: p.lastSyncedAt || now,
  }));

  if (hasPostgres()) {
    await ensureTables();
    const sql = getSql();
    await sql`DELETE FROM meta_businesses WHERE connection_id = ${connectionId}`;
    await sql`DELETE FROM meta_ad_accounts WHERE connection_id = ${connectionId}`;
    await sql`DELETE FROM meta_pages WHERE connection_id = ${connectionId}`;
    await sql`DELETE FROM meta_instagram_accounts WHERE connection_id = ${connectionId}`;
    await sql`DELETE FROM meta_pixels WHERE connection_id = ${connectionId}`;

    for (const row of businesses) {
      await sql`
        INSERT INTO meta_businesses (id, connection_id, meta_business_id, name, usability, discovery_source, last_synced_at)
        VALUES (${row.id}, ${row.connectionId}, ${row.metaBusinessId}, ${row.name}, ${row.usability}, ${row.discoverySource}, ${row.lastSyncedAt})
      `;
    }
    for (const row of adAccounts) {
      await sql`
        INSERT INTO meta_ad_accounts (id, connection_id, meta_ad_account_id, account_id, name, business_id, usability, discovery_source, last_synced_at)
        VALUES (${row.id}, ${row.connectionId}, ${row.metaAdAccountId}, ${row.accountId}, ${row.name}, ${row.businessId ?? null}, ${row.usability}, ${row.discoverySource}, ${row.lastSyncedAt})
      `;
    }
    for (const row of pages) {
      await sql`
        INSERT INTO meta_pages (id, connection_id, meta_page_id, name, business_id, usability, discovery_source, instagram_business_account_id, last_synced_at)
        VALUES (${row.id}, ${row.connectionId}, ${row.metaPageId}, ${row.name}, ${row.businessId ?? null}, ${row.usability}, ${row.discoverySource}, ${row.instagramBusinessAccountId ?? null}, ${row.lastSyncedAt})
      `;
    }
    for (const row of instagramAccounts) {
      await sql`
        INSERT INTO meta_instagram_accounts (id, connection_id, meta_instagram_id, username, page_id, ad_account_id, usability, discovery_source, last_synced_at)
        VALUES (${row.id}, ${row.connectionId}, ${row.metaInstagramId}, ${row.username ?? null}, ${row.pageId ?? null}, ${row.adAccountId ?? null}, ${row.usability}, ${row.discoverySource}, ${row.lastSyncedAt})
      `;
    }
    for (const row of pixels) {
      await sql`
        INSERT INTO meta_pixels (id, connection_id, meta_pixel_id, name, ad_account_id, business_id, usability, discovery_source, last_fired_time, last_synced_at)
        VALUES (${row.id}, ${row.connectionId}, ${row.metaPixelId}, ${row.name}, ${row.adAccountId ?? null}, ${row.businessId ?? null}, ${row.usability}, ${row.discoverySource}, ${row.lastFiredTime ?? null}, ${row.lastSyncedAt})
      `;
    }
    return;
  }

  const store = readLocal();
  const filter = <T extends { connectionId: string }>(rows: T[]) =>
    rows.filter((r) => r.connectionId !== connectionId);
  writeLocal({
    businesses: [...filter(store.businesses), ...businesses],
    adAccounts: [...filter(store.adAccounts), ...adAccounts],
    pages: [...filter(store.pages), ...pages],
    instagramAccounts: [...filter(store.instagramAccounts), ...instagramAccounts],
    pixels: [...filter(store.pixels), ...pixels],
  });
}

export async function listSyncedBusinesses(connectionId: string): Promise<SyncedBusiness[]> {
  if (hasPostgres()) {
    await ensureTables();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, connection_id, meta_business_id, name, usability, discovery_source, last_synced_at
      FROM meta_businesses WHERE connection_id = ${connectionId}
    `) as Array<Record<string, string>>;
    return rows.map((r) => ({
      id: r.id,
      connectionId: r.connection_id,
      metaBusinessId: r.meta_business_id,
      name: r.name,
      usability: r.usability as MetaAssetUsability,
      discoverySource: r.discovery_source,
      lastSyncedAt: r.last_synced_at,
    }));
  }
  return readLocal().businesses.filter((b) => b.connectionId === connectionId);
}

export async function listSyncedAdAccounts(connectionId: string): Promise<SyncedAdAccount[]> {
  if (hasPostgres()) {
    await ensureTables();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, connection_id, meta_ad_account_id, account_id, name, business_id, usability, discovery_source, last_synced_at
      FROM meta_ad_accounts WHERE connection_id = ${connectionId}
    `) as Array<Record<string, string | null>>;
    return rows.map((r) => ({
      id: String(r.id),
      connectionId: String(r.connection_id),
      metaAdAccountId: String(r.meta_ad_account_id),
      accountId: String(r.account_id),
      name: String(r.name),
      businessId: r.business_id ?? undefined,
      usability: r.usability as MetaAssetUsability,
      discoverySource: String(r.discovery_source),
      lastSyncedAt: String(r.last_synced_at),
    }));
  }
  return readLocal().adAccounts.filter((a) => a.connectionId === connectionId);
}

export async function listSyncedPages(connectionId: string): Promise<SyncedPage[]> {
  if (hasPostgres()) {
    await ensureTables();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, connection_id, meta_page_id, name, business_id, usability, discovery_source, instagram_business_account_id, last_synced_at
      FROM meta_pages WHERE connection_id = ${connectionId}
    `) as Array<Record<string, string | null>>;
    return rows.map((r) => ({
      id: String(r.id),
      connectionId: String(r.connection_id),
      metaPageId: String(r.meta_page_id),
      name: String(r.name),
      businessId: r.business_id ?? undefined,
      usability: r.usability as MetaAssetUsability,
      discoverySource: String(r.discovery_source),
      instagramBusinessAccountId: r.instagram_business_account_id ?? undefined,
      lastSyncedAt: String(r.last_synced_at),
    }));
  }
  return readLocal().pages.filter((p) => p.connectionId === connectionId);
}

export async function listSyncedInstagramAccounts(connectionId: string): Promise<SyncedInstagramAccount[]> {
  if (hasPostgres()) {
    await ensureTables();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, connection_id, meta_instagram_id, username, page_id, ad_account_id, usability, discovery_source, last_synced_at
      FROM meta_instagram_accounts WHERE connection_id = ${connectionId}
    `) as Array<Record<string, string | null>>;
    return rows.map((r) => ({
      id: String(r.id),
      connectionId: String(r.connection_id),
      metaInstagramId: String(r.meta_instagram_id),
      username: r.username ?? undefined,
      pageId: r.page_id ?? undefined,
      adAccountId: r.ad_account_id ?? undefined,
      usability: r.usability as MetaAssetUsability,
      discoverySource: String(r.discovery_source),
      lastSyncedAt: String(r.last_synced_at),
    }));
  }
  return readLocal().instagramAccounts.filter((i) => i.connectionId === connectionId);
}

export async function listSyncedPixels(connectionId: string): Promise<SyncedPixel[]> {
  if (hasPostgres()) {
    await ensureTables();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, connection_id, meta_pixel_id, name, ad_account_id, business_id, usability, discovery_source, last_fired_time, last_synced_at
      FROM meta_pixels WHERE connection_id = ${connectionId}
    `) as Array<Record<string, string | null>>;
    return rows.map((r) => ({
      id: String(r.id),
      connectionId: String(r.connection_id),
      metaPixelId: String(r.meta_pixel_id),
      name: String(r.name),
      adAccountId: r.ad_account_id ?? undefined,
      businessId: r.business_id ?? undefined,
      usability: r.usability as MetaAssetUsability,
      discoverySource: String(r.discovery_source),
      lastFiredTime: r.last_fired_time ?? undefined,
      lastSyncedAt: String(r.last_synced_at),
    }));
  }
  return readLocal().pixels.filter((p) => p.connectionId === connectionId);
}

export function filterUsable<T extends { usability: MetaAssetUsability }>(rows: T[]): T[] {
  return rows.filter((r) => r.usability === "DISCOVERED_AND_USABLE");
}
