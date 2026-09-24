import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DATABASE_HOST ?? "database",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 1
});

const uploadRoot = path.resolve(
  process.env.MEDIA_UPLOAD_ROOT ?? "/media/uploads"
);
const reportPath = path.resolve(
  process.env.ARCHIVE_REPORT_PATH ??
    "/backups/health/latest.json"
);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];

  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)));
    } else if (entry.isFile()) {
      files.push(path.resolve(full));
    }
  }

  return files;
}

async function main() {
  const references = await pool.query(
    `SELECT storage_path FROM media
     UNION
     SELECT derivative_path AS storage_path
       FROM media
      WHERE derivative_path IS NOT NULL
     UNION
     SELECT voice_storage_path AS storage_path
       FROM recollections
      WHERE voice_storage_path IS NOT NULL
     UNION
     SELECT storage_path FROM import_items`
  );

  const issues = await pool.query(
    `SELECT (
      (
        SELECT count(*)
        FROM memories m
        JOIN media md ON md.id = m.cover_media_id
        WHERE md.memory_id <> m.id
           OR md.archived = true
           OR md.trashed_at IS NOT NULL
      )
      +
      (
        SELECT count(*)
        FROM import_items
        WHERE
          (status = 'curated' AND curated_memory_id IS NULL)
          OR
          (status <> 'curated' AND curated_memory_id IS NOT NULL)
      )
    )::text AS issues`
  );

  const referenced = Array.from(
    new Set(
      references.rows
        .map((row) => row.storage_path)
        .filter(Boolean)
        .map((value) => path.resolve(value))
    )
  );

  const missing = [];
  for (let i = 0; i < referenced.length; i += 100) {
    const chunk = referenced.slice(i, i + 100);
    const checks = await Promise.all(
      chunk.map(async (file) => ({
        file,
        present: await exists(file)
      }))
    );

    missing.push(
      ...checks
        .filter((item) => !item.present)
        .map((item) => item.file)
    );
  }

  const diskFiles = await walkFiles(uploadRoot);
  const referencedSet = new Set(referenced);
  const orphans = diskFiles.filter(
    (file) => !referencedSet.has(path.resolve(file))
  );

  const report = {
    checkedAt: new Date().toISOString(),
    referencedFiles: referenced.length,
    missingFiles: missing.length,
    orphanedFiles: orphans.length,
    databaseIssues: Number(issues.rows[0]?.issues ?? 0),
    missingSamples: missing.slice(0, 50),
    orphanedSamples: orphans.slice(0, 50)
  };

  await fs.mkdir(path.dirname(reportPath), {
    recursive: true
  });

  const temporary = reportPath + ".tmp";
  await fs.writeFile(
    temporary,
    JSON.stringify(report, null, 2) + "\n",
    { mode: 0o644 }
  );
  await fs.rename(temporary, reportPath);

  console.log(JSON.stringify(report));

  if (
    report.missingFiles > 0 ||
    report.databaseIssues > 0
  ) {
    console.warn("Archive integrity findings require review.");
  }
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
