import { access, readFile, readdir, stat, statfs } from "node:fs/promises";
import path from "node:path";
import { query } from "@/lib/db";

type ScheduledIntegrityReport = {
  checkedAt: string;
  missingFiles: number;
  orphanedFiles: number;
  databaseIssues: number;
  missingSamples?: string[];
  orphanedSamples?: string[];
};

export type ArchiveHealth = {
  checkedAt: string;
  counts: {
    memories: number;
    approvedMemories: number;
    photos: number;
    videos: number;
    audio: number;
    voiceRecollections: number;
    people: number;
    pendingScans: number;
    pendingMemories: number;
    pendingRecollections: number;
  };
  storage: {
    totalBytes: number;
    availableBytes: number;
    usedBytes: number;
    archiveBytes: number;
  };
  integrity: {
    referencedFiles: number;
    missingFiles: number;
    orphanedFiles: number;
    databaseIssues: number;
    missingSamples: string[];
    orphanedSamples: string[];
    lastScheduledScan: ScheduledIntegrityReport | null;
  };
  backups: {
    database: {
      configured: boolean;
      latestAt: string | null;
      latestBytes: number | null;
      latestFilename: string | null;
      ageHours: number | null;
    };
    media: {
      configured: false;
    };
  };
};

const uploadRoot = path.resolve(
  process.env.MEDIA_UPLOAD_ROOT ?? "/media/uploads"
);
const backupRoot = path.resolve(
  process.env.ARCHIVE_BACKUP_ROOT ?? "/backups"
);

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];

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

async function totalFileBytes(files: string[]) {
  let total = 0;

  for (let i = 0; i < files.length; i += 100) {
    const chunk = files.slice(i, i + 100);
    const stats = await Promise.all(
      chunk.map(async (file) => {
        try {
          return await stat(file);
        } catch {
          return null;
        }
      })
    );

    for (const fileStat of stats) {
      if (fileStat?.isFile()) total += fileStat.size;
    }
  }

  return total;
}

async function getLatestDatabaseBackup() {
  const directory = path.join(backupRoot, "database");

  let names: string[];
  try {
    names = (await readdir(directory)).filter((name) =>
      name.endsWith(".dump")
    );
  } catch {
    return {
      configured: false,
      latestAt: null,
      latestBytes: null,
      latestFilename: null,
      ageHours: null
    };
  }

  if (!names.length) {
    return {
      configured: true,
      latestAt: null,
      latestBytes: null,
      latestFilename: null,
      ageHours: null
    };
  }

  const candidates = await Promise.all(
    names.map(async (name) => {
      const fileStat = await stat(path.join(directory, name));
      return { name, fileStat };
    })
  );

  candidates.sort(
    (a, b) => b.fileStat.mtimeMs - a.fileStat.mtimeMs
  );

  const latest = candidates[0];
  const latestAt = latest.fileStat.mtime.toISOString();

  return {
    configured: true,
    latestAt,
    latestBytes: latest.fileStat.size,
    latestFilename: latest.name,
    ageHours:
      (Date.now() - latest.fileStat.mtimeMs) / (60 * 60 * 1000)
  };
}

async function getLastScheduledIntegrityReport() {
  const reportPath = path.join(backupRoot, "health", "latest.json");

  try {
    const raw = await readFile(reportPath, "utf8");
    return JSON.parse(raw) as ScheduledIntegrityReport;
  } catch {
    return null;
  }
}

export async function getArchiveHealth(): Promise<ArchiveHealth> {
  const [
    countsResult,
    referencesResult,
    databaseIssuesResult,
    disk,
    databaseBackup,
    lastScheduledScan
  ] = await Promise.all([
    query<{
      memories: string;
      approved_memories: string;
      photos: string;
      videos: string;
      audio: string;
      voice_recollections: string;
      people: string;
      pending_scans: string;
      pending_memories: string;
      pending_recollections: string;
    }>(
      `SELECT
        (SELECT count(*) FROM memories)::text AS memories,
        (SELECT count(*) FROM memories WHERE status = 'approved')::text AS approved_memories,
        (SELECT count(*) FROM media WHERE kind = 'photo' AND archived = false)::text AS photos,
        (SELECT count(*) FROM media WHERE kind = 'video' AND archived = false)::text AS videos,
        (SELECT count(*) FROM media WHERE kind = 'audio' AND archived = false)::text AS audio,
        (SELECT count(*) FROM recollections WHERE voice_storage_path IS NOT NULL)::text AS voice_recollections,
        (SELECT count(*) FROM people)::text AS people,
        (SELECT count(*) FROM import_items WHERE status = 'pending')::text AS pending_scans,
        (SELECT count(*) FROM memories WHERE status = 'pending')::text AS pending_memories,
        (SELECT count(*) FROM recollections WHERE status = 'pending')::text AS pending_recollections`
    ),
    query<{ storage_path: string }>(
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
    ),
    query<{ issues: string }>(
      `SELECT (
        (
          SELECT count(*)
          FROM memories m
          JOIN media md ON md.id = m.cover_media_id
          WHERE md.memory_id <> m.id
             OR md.archived = true
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
    ),
    statfs(uploadRoot),
    getLatestDatabaseBackup(),
    getLastScheduledIntegrityReport()
  ]);

  const countRow = countsResult.rows[0];
  const referenced = Array.from(
    new Set(
      referencesResult.rows
        .map((row) => row.storage_path)
        .filter(Boolean)
        .map((value) => path.resolve(value))
    )
  );

  const missing: string[] = [];
  for (let i = 0; i < referenced.length; i += 100) {
    const chunk = referenced.slice(i, i + 100);
    const results = await Promise.all(
      chunk.map(async (file) => ({
        file,
        present: await exists(file)
      }))
    );
    missing.push(
      ...results
        .filter((item) => !item.present)
        .map((item) => item.file)
    );
  }

  const diskFiles = await walkFiles(uploadRoot);
  const referencedSet = new Set(referenced);
  const orphans = diskFiles.filter(
    (file) => !referencedSet.has(path.resolve(file))
  );
  const archiveBytes = await totalFileBytes(diskFiles);

  const totalBytes = Number(disk.blocks) * Number(disk.bsize);
  const availableBytes =
    Number(disk.bavail) * Number(disk.bsize);

  return {
    checkedAt: new Date().toISOString(),
    counts: {
      memories: Number(countRow?.memories ?? 0),
      approvedMemories: Number(
        countRow?.approved_memories ?? 0
      ),
      photos: Number(countRow?.photos ?? 0),
      videos: Number(countRow?.videos ?? 0),
      audio: Number(countRow?.audio ?? 0),
      voiceRecollections: Number(
        countRow?.voice_recollections ?? 0
      ),
      people: Number(countRow?.people ?? 0),
      pendingScans: Number(countRow?.pending_scans ?? 0),
      pendingMemories: Number(
        countRow?.pending_memories ?? 0
      ),
      pendingRecollections: Number(
        countRow?.pending_recollections ?? 0
      )
    },
    storage: {
      totalBytes,
      availableBytes,
      usedBytes: totalBytes - availableBytes,
      archiveBytes
    },
    integrity: {
      referencedFiles: referenced.length,
      missingFiles: missing.length,
      orphanedFiles: orphans.length,
      databaseIssues: Number(
        databaseIssuesResult.rows[0]?.issues ?? 0
      ),
      missingSamples: missing.slice(0, 10),
      orphanedSamples: orphans.slice(0, 10),
      lastScheduledScan
    },
    backups: {
      database: databaseBackup,
      media: {
        configured: false
      }
    }
  };
}
