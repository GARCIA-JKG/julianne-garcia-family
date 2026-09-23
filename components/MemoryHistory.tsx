export function MemoryHistory({
  items
}: {
  items: Array<{
    id: string;
    summary: string;
    changedBy: string;
    createdAt: string;
  }>;
}) {
  if (!items.length) {
    return (
      <p className="form-help">
        No curator edits have been recorded yet.
      </p>
    );
  }

  return (
    <div className="memory-history-list">
      {items.map((item) => (
        <div className="memory-history-row" key={item.id}>
          <div>
            <strong>{item.summary}</strong>
            <span>by {item.changedBy}</span>
          </div>
          <time dateTime={item.createdAt}>
            {new Date(item.createdAt).toLocaleString()}
          </time>
        </div>
      ))}
    </div>
  );
}
