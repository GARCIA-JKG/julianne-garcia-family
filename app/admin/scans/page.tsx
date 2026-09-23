import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listScanBatches } from "@/lib/imports";
import { CreateScanBatch } from "@/components/CreateScanBatch";

export const dynamic = "force-dynamic";

export default async function ScanInboxPage() {
  await requireRole(["admin", "curator"]);
  const batches = await listScanBatches();

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">SCAN INBOX</p>
        <h1>Turn boxes of prints into family history.</h1>
        <p>
          Upload scans first. Curate them later. Nothing from this inbox joins
          the family archive until you group it into a Memory and approve it.
        </p>
      </div>

      <CreateScanBatch />

      <div className="scan-batch-list">
        {batches.map((batch) => (
          <Link
            className="scan-batch-card"
            href={"/admin/scans/" + batch.id}
            key={batch.id}
          >
            <div>
              <p className="eyebrow">
                {new Date(batch.createdAt).toLocaleDateString()}
              </p>
              <h2>{batch.name}</h2>
              {batch.source && <p>{batch.source}</p>}
            </div>
            <div className="scan-batch-stats">
              <span><strong>{batch.total}</strong> scans</span>
              <span><strong>{batch.pending}</strong> to curate</span>
              <span><strong>{batch.curated}</strong> curated</span>
            </div>
          </Link>
        ))}

        {!batches.length && (
          <div className="empty-keepsake">
            <span>READY FOR THE FIRST BOX</span>
            <h2>Create a batch when you begin a scan session.</h2>
          </div>
        )}
      </div>
    </section>
  );
}
