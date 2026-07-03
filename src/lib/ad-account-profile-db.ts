import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { normalizeAdAccountId } from "@/utils/ad-account";
import type { AdAccountProfileRecord } from "@/types/ad-account-profile";

type ProfileRow = {
  id: string;
  connection_id: string;
  ad_account_id: string;
  business_id: string | null;
  default_page_id: string | null;
  default_page_name: string | null;
  default_instagram_id: string | null;
  default_instagram_username: string | null;
  default_pixel_id: string | null;
  default_pixel_name: string | null;
  default_pixel_event_type: string | null;
  default_website_url: string | null;
  default_domain: string | null;
  page_source: string | null;
  pixel_source: string | null;
  website_source: string | null;
  instagram_source: string | null;
  page_confidence: number | null;
  pixel_confidence: number | null;
  website_confidence: number | null;
  instagram_confidence: number | null;
  last_discovered_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type LocalProfileStore = { profiles: ProfileRow[] };

let profileTableReady = false;

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

async function ensureProfileTable(): Promise<void> {
  if (!hasPostgres() || profileTableReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS meta_ad_account_profiles (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      ad_account_id TEXT NOT NULL,
      business_id TEXT,
      default_page_id TEXT,
      default_page_name TEXT,
      default_instagram_id TEXT,
      default_instagram_username TEXT,
      default_pixel_id TEXT,
      default_pixel_name TEXT,
      default_pixel_event_type TEXT,
      default_website_url TEXT,
      default_domain TEXT,
      page_source TEXT,
      pixel_source TEXT,
      website_source TEXT,
      instagram_source TEXT,
      page_confidence INTEGER,
      pixel_confidence INTEGER,
      website_confidence INTEGER,
      instagram_confidence INTEGER,
      last_discovered_at TEXT,
      last_verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (connection_id, ad_account_id)
    )
  `;
  profileTableReady = true;
}

function getLocalFilePath(): string {
  const dataDir = join(process.cwd(), ".data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  return join(dataDir, "meta-ad-account-profiles.json");
}

function readLocalStore(): LocalProfileStore {
  const path = getLocalFilePath();
  if (!existsSync(path)) return { profiles: [] };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LocalProfileStore;
  } catch {
    return { profiles: [] };
  }
}

function writeLocalStore(store: LocalProfileStore): void {
  writeFileSync(getLocalFilePath(), JSON.stringify(store, null, 2), "utf8");
}

function rowToRecord(row: ProfileRow): AdAccountProfileRecord {
  return {
    id: row.id,
    connectionId: row.connection_id,
    adAccountId: row.ad_account_id,
    businessId: row.business_id ?? undefined,
    defaultPageId: row.default_page_id ?? undefined,
    defaultPageName: row.default_page_name ?? undefined,
    defaultInstagramId: row.default_instagram_id ?? undefined,
    defaultInstagramUsername: row.default_instagram_username ?? undefined,
    defaultPixelId: row.default_pixel_id ?? undefined,
    defaultPixelName: row.default_pixel_name ?? undefined,
    defaultPixelEventType: row.default_pixel_event_type ?? undefined,
    defaultWebsiteUrl: row.default_website_url ?? undefined,
    defaultDomain: row.default_domain ?? undefined,
    pageSource: (row.page_source as AdAccountProfileRecord["pageSource"]) ?? undefined,
    pixelSource: (row.pixel_source as AdAccountProfileRecord["pixelSource"]) ?? undefined,
    websiteSource: (row.website_source as AdAccountProfileRecord["websiteSource"]) ?? undefined,
    instagramSource: row.instagram_source ?? undefined,
    pageConfidence: (row.page_confidence as AdAccountProfileRecord["pageConfidence"]) ?? undefined,
    pixelConfidence: (row.pixel_confidence as AdAccountProfileRecord["pixelConfidence"]) ?? undefined,
    websiteConfidence: (row.website_confidence as AdAccountProfileRecord["websiteConfidence"]) ?? undefined,
    instagramConfidence: (row.instagram_confidence as AdAccountProfileRecord["instagramConfidence"]) ?? undefined,
    lastDiscoveredAt: row.last_discovered_at ?? undefined,
    lastVerifiedAt: row.last_verified_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToRow(record: AdAccountProfileRecord): ProfileRow {
  return {
    id: record.id,
    connection_id: record.connectionId,
    ad_account_id: normalizeAdAccountId(record.adAccountId),
    business_id: record.businessId ?? null,
    default_page_id: record.defaultPageId ?? null,
    default_page_name: record.defaultPageName ?? null,
    default_instagram_id: record.defaultInstagramId ?? null,
    default_instagram_username: record.defaultInstagramUsername ?? null,
    default_pixel_id: record.defaultPixelId ?? null,
    default_pixel_name: record.defaultPixelName ?? null,
    default_pixel_event_type: record.defaultPixelEventType ?? null,
    default_website_url: record.defaultWebsiteUrl ?? null,
    default_domain: record.defaultDomain ?? null,
    page_source: record.pageSource ?? null,
    pixel_source: record.pixelSource ?? null,
    website_source: record.websiteSource ?? null,
    instagram_source: record.instagramSource ?? null,
    page_confidence: record.pageConfidence ?? null,
    pixel_confidence: record.pixelConfidence ?? null,
    website_confidence: record.websiteConfidence ?? null,
    instagram_confidence: record.instagramConfidence ?? null,
    last_discovered_at: record.lastDiscoveredAt ?? null,
    last_verified_at: record.lastVerifiedAt ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export async function getAdAccountProfile(
  connectionId: string,
  adAccountId: string,
): Promise<AdAccountProfileRecord | null> {
  const normalized = normalizeAdAccountId(adAccountId);
  if (hasPostgres()) {
    await ensureProfileTable();
    const sql = getSql();
    const rows = (await sql`
      SELECT * FROM meta_ad_account_profiles
      WHERE connection_id = ${connectionId} AND ad_account_id = ${normalized}
      LIMIT 1
    `) as ProfileRow[];
    return rows[0] ? rowToRecord(rows[0]) : null;
  }
  const store = readLocalStore();
  const row = store.profiles.find(
    (p) => p.connection_id === connectionId && p.ad_account_id === normalized,
  );
  return row ? rowToRecord(row) : null;
}

export async function upsertAdAccountProfile(
  record: Partial<AdAccountProfileRecord> & {
    connectionId: string;
    adAccountId: string;
  },
): Promise<AdAccountProfileRecord> {
  const now = new Date().toISOString();
  const existing = await getAdAccountProfile(record.connectionId, record.adAccountId);
  const full: AdAccountProfileRecord = {
    id: record.id ?? existing?.id ?? randomUUID(),
    connectionId: record.connectionId,
    adAccountId: normalizeAdAccountId(record.adAccountId),
    businessId: record.businessId ?? existing?.businessId,
    defaultPageId: record.defaultPageId ?? existing?.defaultPageId,
    defaultPageName: record.defaultPageName ?? existing?.defaultPageName,
    defaultInstagramId: record.defaultInstagramId ?? existing?.defaultInstagramId,
    defaultInstagramUsername: record.defaultInstagramUsername ?? existing?.defaultInstagramUsername,
    defaultPixelId: record.defaultPixelId ?? existing?.defaultPixelId,
    defaultPixelName: record.defaultPixelName ?? existing?.defaultPixelName,
    defaultPixelEventType: record.defaultPixelEventType ?? existing?.defaultPixelEventType,
    defaultWebsiteUrl: record.defaultWebsiteUrl ?? existing?.defaultWebsiteUrl,
    defaultDomain: record.defaultDomain ?? existing?.defaultDomain,
    pageSource: record.pageSource ?? existing?.pageSource,
    pixelSource: record.pixelSource ?? existing?.pixelSource,
    websiteSource: record.websiteSource ?? existing?.websiteSource,
    instagramSource: record.instagramSource ?? existing?.instagramSource,
    pageConfidence: record.pageConfidence ?? existing?.pageConfidence,
    pixelConfidence: record.pixelConfidence ?? existing?.pixelConfidence,
    websiteConfidence: record.websiteConfidence ?? existing?.websiteConfidence,
    instagramConfidence: record.instagramConfidence ?? existing?.instagramConfidence,
    lastDiscoveredAt: record.lastDiscoveredAt ?? existing?.lastDiscoveredAt,
    lastVerifiedAt: record.lastVerifiedAt ?? now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const row = recordToRow(full);
  if (hasPostgres()) {
    await ensureProfileTable();
    const sql = getSql();
    await sql`
      INSERT INTO meta_ad_account_profiles (
        id, connection_id, ad_account_id, business_id,
        default_page_id, default_page_name, default_instagram_id, default_instagram_username,
        default_pixel_id, default_pixel_name, default_pixel_event_type,
        default_website_url, default_domain,
        page_source, pixel_source, website_source, instagram_source,
        page_confidence, pixel_confidence, website_confidence, instagram_confidence,
        last_discovered_at, last_verified_at, created_at, updated_at
      ) VALUES (
        ${row.id}, ${row.connection_id}, ${row.ad_account_id}, ${row.business_id},
        ${row.default_page_id}, ${row.default_page_name}, ${row.default_instagram_id}, ${row.default_instagram_username},
        ${row.default_pixel_id}, ${row.default_pixel_name}, ${row.default_pixel_event_type},
        ${row.default_website_url}, ${row.default_domain},
        ${row.page_source}, ${row.pixel_source}, ${row.website_source}, ${row.instagram_source},
        ${row.page_confidence}, ${row.pixel_confidence}, ${row.website_confidence}, ${row.instagram_confidence},
        ${row.last_discovered_at}, ${row.last_verified_at}, ${row.created_at}, ${row.updated_at}
      )
      ON CONFLICT (connection_id, ad_account_id) DO UPDATE SET
        business_id = EXCLUDED.business_id,
        default_page_id = EXCLUDED.default_page_id,
        default_page_name = EXCLUDED.default_page_name,
        default_instagram_id = EXCLUDED.default_instagram_id,
        default_instagram_username = EXCLUDED.default_instagram_username,
        default_pixel_id = EXCLUDED.default_pixel_id,
        default_pixel_name = EXCLUDED.default_pixel_name,
        default_pixel_event_type = EXCLUDED.default_pixel_event_type,
        default_website_url = EXCLUDED.default_website_url,
        default_domain = EXCLUDED.default_domain,
        page_source = EXCLUDED.page_source,
        pixel_source = EXCLUDED.pixel_source,
        website_source = EXCLUDED.website_source,
        instagram_source = EXCLUDED.instagram_source,
        page_confidence = EXCLUDED.page_confidence,
        pixel_confidence = EXCLUDED.pixel_confidence,
        website_confidence = EXCLUDED.website_confidence,
        instagram_confidence = EXCLUDED.instagram_confidence,
        last_discovered_at = EXCLUDED.last_discovered_at,
        last_verified_at = EXCLUDED.last_verified_at,
        updated_at = EXCLUDED.updated_at
    `;
    return full;
  }

  const store = readLocalStore();
  const idx = store.profiles.findIndex(
    (p) => p.connection_id === row.connection_id && p.ad_account_id === row.ad_account_id,
  );
  if (idx >= 0) store.profiles[idx] = row;
  else store.profiles.push(row);
  writeLocalStore(store);
  return full;
}

export const PROFILE_TTL_MS = {
  page: 24 * 60 * 60 * 1000,
  pixel: 6 * 60 * 60 * 1000,
  website: 24 * 60 * 60 * 1000,
  fullDiscovery: 7 * 24 * 60 * 60 * 1000,
};

export function profileNeedsFullDiscovery(
  profile: AdAccountProfileRecord | null,
  forceRefresh?: boolean,
): boolean {
  if (forceRefresh) return true;
  if (!profile) return true;
  if (!profile.lastDiscoveredAt) return true;
  const age = Date.now() - new Date(profile.lastDiscoveredAt).getTime();
  if (age > PROFILE_TTL_MS.fullDiscovery) return true;
  return false;
}
