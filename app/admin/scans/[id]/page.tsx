import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getScanBatch } from "@/lib/imports";
import { BulkScanUploader } from "@/components/BulkScanUploader";
import { ScanCurationBoard } from "@/components/ScanCurationBoard";

export const dynamic = "force-dynamic";

export default async function ScanBatchPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "curator"]);
  const { id } = await params;
  const batch = await getScanBatch(id);

  if (!batch) notFound();

  return (
    <section className="page-section">
      <div className="page-intro">
        <p className="eyebrow">SCAN BATCH</p>
        <h1>{batch.name}</h1>
        {batch.source && <p>Source: {batch.source}</p>}
        {batch.notes && <p>{batch.notes}</p>}
      </div>

      <BulkScanUploader batchId={batch.id} />
      <ScanCurationBoard batchId={batch.id} items={batch.items} />
    </section>
  );
}
