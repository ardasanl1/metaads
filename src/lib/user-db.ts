import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { hashPassword, verifyPasswordHash } from "./password";

export type PanelUser = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type StoredUser = PanelUser & {
  passwordHash: string;
};

type PanelUserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

type LocalUserStore = {
  users: StoredUser[];
};

let usersTableReady = false;

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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getLocalUsersFilePath(): string {
  const dataDir = join(process.cwd(), ".data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, "panel-users.json");
}

function rowToStored(row: PanelUserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPanelUser(stored: StoredUser): PanelUser {
  return {
    id: stored.id,
    email: stored.email,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

async function ensureUsersTable(): Promise<void> {
  if (!hasPostgres() || usersTableReady) return;

  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS panel_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  usersTableReady = true;
}

async function readAllUsersFromPostgres(): Promise<StoredUser[]> {
  await ensureUsersTable();
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, password_hash, created_at, updated_at
    FROM panel_users
    ORDER BY created_at ASC
  `;
  return (rows as PanelUserRow[]).map(rowToStored);
}

function readAllUsersFromFile(): StoredUser[] {
  const filePath = getLocalUsersFilePath();
  if (!existsSync(filePath)) return [];

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as LocalUserStore;
    return parsed.users ?? [];
  } catch {
    return [];
  }
}

function writeAllUsersToFile(users: StoredUser[]): void {
  const payload: LocalUserStore = { users };
  writeFileSync(getLocalUsersFilePath(), JSON.stringify(payload, null, 2), "utf8");
}

async function readAllUsers(): Promise<StoredUser[]> {
  if (hasPostgres()) {
    return readAllUsersFromPostgres();
  }
  if (process.env.VERCEL === "1") {
    throw new Error("POSTGRES_URL veya DATABASE_URL tanimli degil");
  }
  return readAllUsersFromFile();
}

async function insertUser(user: StoredUser): Promise<void> {
  if (hasPostgres()) {
    await ensureUsersTable();
    const sql = getSql();
    await sql`
      INSERT INTO panel_users (id, email, password_hash, created_at, updated_at)
      VALUES (
        ${user.id},
        ${user.email},
        ${user.passwordHash},
        ${user.createdAt},
        ${user.updatedAt}
      )
    `;
    return;
  }

  const users = readAllUsersFromFile();
  writeAllUsersToFile([...users, user]);
}

export async function ensureDefaultPanelUser(): Promise<void> {
  const users = await readAllUsers();
  if (users.length > 0) return;

  const email = process.env.APP_EMAIL?.trim();
  const password = process.env.APP_PASSWORD;
  if (!email || !password) return;

  const now = new Date().toISOString();
  await insertUser({
    id: randomUUID(),
    email: normalizeEmail(email),
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });
}

export async function authenticatePanelUser(
  email: string,
  password: string,
): Promise<PanelUser | null> {
  await ensureDefaultPanelUser();

  const normalizedEmail = normalizeEmail(email);
  const users = await readAllUsers();
  const user = users.find((item) => item.email === normalizedEmail);
  if (!user) return null;
  if (!verifyPasswordHash(password, user.passwordHash)) return null;

  return toPanelUser(user);
}
