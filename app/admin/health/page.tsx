import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getArchiveHealth } from "@/lib/archive-health";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number | null) {
  if (bytes === null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const digits = unit >= 3 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString();
}

function statusLabel(
  missing: number,
  orphaned: number,
  databaseIssues: number
) {
  if (missing > 0 || databaseIssues > 0) {
    return "Needs attention";
  }
  if (orphaned > 0) return "Review recommended";
  return "Healthy";
}

export default async function ArchiveHealthPage() {
  await requireRole(["admin"]);
  const health = await getArchiveHealth();

  const state = statusLabel(
    health.integrity.missingFiles,
    health.integrity.orphanedFiles,
    health.integrity.databaseIssues
  );

  const backupFresh =
    health.backups.database.ageHours !== null &&
    health.backups.database.ageHours <= 36;

  return (
    <section className="page-section archive-health-page">
      <div className="page-intro">
        <p className="eyebrow">ARCHIVE HEALTH</p>
        <h1>Keep the family archive trustworthy.</h1>
        <p>
          This page checks the live database and media filesystem.
          It does not delete or repair anything automatically.
        </p>
        <div className={"archive-health-banner " + state.toLowerCase().replaceAll(" ", "-")}>
          <strong>{state}</strong>
          <span>
            Checked {new Date(health.checkedAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="health-grid">
        <article className="health-card">
          <p className="eyebrow">MEDIA</p>
          <h2>{health.counts.photos.toLocaleString()} photos</h2>
          <div className="health-stat-list">
            <span><strong>{health.counts.videos.toLocaleString()}</strong> videos</span>
            <span><strong>{health.counts.audio.toLocaleString()}</strong> audio files</span>
            <span><strong>{health.counts.voiceRecollections.toLocaleString()}</strong> voice recollections</span>
            <span><strong>{health.counts.trashedMedia.toLocaleString()}</strong> items in Trash</span>
            <span><strong>{health.counts.memories.toLocaleString()}</strong> Memories</span>
            <span><strong>{health.counts.people.toLocaleString()}</strong> people</span>
          </div>
        </article>

        <article className="health-card">
          <p className="eyebrow">CURATION</p>
          <h2>{health.counts.pendingScans.toLocaleString()} scans waiting</h2>
          <div className="health-stat-list">
            <span><strong>{health.counts.pendingMemories}</strong> Memories waiting</span>
            <span><strong>{health.counts.pendingRecollections}</strong> recollections waiting</span>
            <span><strong>{health.counts.approvedMemories}</strong> approved Memories</span>
          </div>
          <Link href="/admin" className="text-link">
            Open curation queue →
          </Link>
        </article>

        <article className="health-card">
          <p className="eyebrow">STORAGE</p>
          <h2>{formatBytes(health.storage.archiveBytes)} family media</h2>
          <div className="health-stat-list">
            <span><strong>{formatBytes(health.storage.availableBytes)}</strong> available</span>
            <span><strong>{formatBytes(health.storage.usedBytes)}</strong> disk used</span>
            <span><strong>{formatBytes(health.storage.totalBytes)}</strong> disk capacity</span>
          </div>
        </article>

        <article className="health-card">
          <p className="eyebrow">INTEGRITY</p>
          <h2>
            {health.integrity.missingFiles === 0 &&
            health.integrity.databaseIssues === 0
              ? "Core checks passed"
              : "Review required"}
          </h2>
          <div className="health-stat-list">
            <span><strong>{health.integrity.missingFiles}</strong> missing referenced files</span>
            <span><strong>{health.integrity.orphanedFiles}</strong> orphaned upload files</span>
            <span><strong>{health.integrity.databaseIssues}</strong> database consistency issues</span>
            <span><strong>{health.integrity.referencedFiles}</strong> referenced file paths checked</span>
          </div>
        </article>

        <article className="health-card health-card-wide">
          <p className="eyebrow">BACKUPS</p>
          <h2>
            Database backup:{" "}
            {backupFresh ? "Current" : "Needs setup or refresh"}
          </h2>
          <div className="backup-status-grid">
            <div>
              <span>Latest database backup</span>
              <strong>{formatDate(health.backups.database.latestAt)}</strong>
              <small>
                {health.backups.database.latestFilename ?? "No verified .dump file found"}
                {health.backups.database.latestBytes !== null
                  ? ` · ${formatBytes(health.backups.database.latestBytes)}`
                  : ""}
              </small>
            </div>
            <div>
              <span>Scheduled integrity scan</span>
              <strong>
                {formatDate(
                  health.integrity.lastScheduledScan?.checkedAt ?? null
                )}
              </strong>
              <small>
                {health.integrity.lastScheduledScan
                  ? `${health.integrity.lastScheduledScan.missingFiles} missing · ${health.integrity.lastScheduledScan.orphanedFiles} orphaned · ${health.integrity.lastScheduledScan.databaseIssues} DB issues`
                  : "No scheduled report has run yet"}
              </small>
            </div>
            <div>
              <span>Full media backup</span>
              <strong>Not configured</strong>
              <small>
                A second physical destination is still required.
              </small>
            </div>
          </div>
        </article>
      </div>

      {(health.integrity.missingSamples.length > 0 ||
        health.integrity.orphanedSamples.length > 0) && (
        <section className="health-details">
          <p className="eyebrow">DETAILS</p>
          <h2>Items to review</h2>

          {health.integrity.missingSamples.length > 0 && (
            <div>
              <h3>Missing referenced files</h3>
              <code>
                {health.integrity.missingSamples.join("\n")}
              </code>
            </div>
          )}

          {health.integrity.orphanedSamples.length > 0 && (
            <div>
              <h3>Orphaned upload files</h3>
              <p>
                These files exist under the managed upload folder
                but are not referenced by current archive metadata.
                Nothing is deleted automatically.
              </p>
              <code>
                {health.integrity.orphanedSamples.join("\n")}
              </code>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
