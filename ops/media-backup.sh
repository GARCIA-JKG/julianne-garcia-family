#!/usr/bin/env bash
set -euo pipefail

SOURCE="/hdd/downloads/julianne-family-media"
DB_BACKUPS="/srv/julianne-garcia-family/backups/database"
HEALTH_DIR="/srv/julianne-garcia-family/backups/health"
CONFIG="/srv/julianne-garcia-family/media-backup-destination"
STATUS="$HEALTH_DIR/media-backup.json"
LAST_SUCCESS="$HEALTH_DIR/media-backup-last-success.txt"
LOCK="/tmp/julianne-family-media-backup.lock"

mkdir -p "$HEALTH_DIR"

last_success() {
  if [[ -f "$LAST_SUCCESS" ]]; then
    cat "$LAST_SUCCESS"
  fi
}

write_status() {
  local configured="$1"
  local result="$2"
  local checked latest
  checked="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  latest="$(last_success)"
  cat > "${STATUS}.tmp" <<EOF
{"configured":${configured},"checkedAt":"${checked}","latestAt":"${latest}","result":"${result}"}
EOF
  mv "${STATUS}.tmp" "$STATUS"
}

if [[ ! -s "$CONFIG" ]]; then
  write_status false "not_configured"
  echo "Media backup skipped: no second-drive destination configured."
  exit 0
fi

DESTINATION="$(head -n 1 "$CONFIG" | tr -d '\r\n')"

if [[ -z "$DESTINATION" || "$DESTINATION" != /* ]]; then
  write_status true "invalid_destination"
  echo "Media backup failed: destination must be an absolute path." >&2
  exit 1
fi

if [[ ! -d "$DESTINATION" ]]; then
  write_status true "destination_unavailable"
  echo "Media backup failed: configured destination is unavailable." >&2
  exit 1
fi

if [[ ! -f "$DESTINATION/.julianne-family-backup-destination" ]]; then
  write_status true "marker_missing"
  echo "Media backup failed: destination marker is missing." >&2
  exit 1
fi

if [[ ! -d "$SOURCE" ]]; then
  write_status true "source_unavailable"
  echo "Media backup failed: family media source is unavailable." >&2
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  write_status true "rsync_missing"
  echo "Media backup failed: rsync is not installed." >&2
  exit 1
fi

source_fs="$(findmnt -T "$SOURCE" -n -o SOURCE || true)"
destination_fs="$(findmnt -T "$DESTINATION" -n -o SOURCE || true)"
destination_mount="$(findmnt -T "$DESTINATION" -n -o TARGET || true)"

if [[ -z "$source_fs" || -z "$destination_fs" || -z "$destination_mount" ]]; then
  write_status true "mount_check_failed"
  echo "Media backup failed: could not verify source/destination mounts." >&2
  exit 1
fi

if [[ "$destination_mount" == "/" ]]; then
  write_status true "destination_not_separate_mount"
  echo "Media backup failed: destination resolves to the system root filesystem." >&2
  exit 1
fi

source_parent="$(lsblk -no PKNAME "$source_fs" 2>/dev/null | head -n 1 || true)"
destination_parent="$(lsblk -no PKNAME "$destination_fs" 2>/dev/null | head -n 1 || true)"

if [[ "$source_fs" == "$destination_fs" ]]; then
  write_status true "same_filesystem"
  echo "Media backup failed: destination is on the same filesystem as family media." >&2
  exit 1
fi

if [[ -n "$source_parent" && -n "$destination_parent" && "$source_parent" == "$destination_parent" ]]; then
  write_status true "same_physical_disk"
  echo "Media backup failed: destination is on the same physical disk as family media." >&2
  exit 1
fi

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Media backup skipped: another backup is already running."
  exit 0
fi

DEST_ROOT="$DESTINATION/julianne-garcia-family"
mkdir -p "$DEST_ROOT/media" "$DEST_ROOT/database"

echo "Backing up family media to second physical destination..."
if ! rsync -a --partial --human-readable "$SOURCE/" "$DEST_ROOT/media/"; then
  write_status true "media_copy_failed"
  exit 1
fi

echo "Backing up verified database dumps to second physical destination..."
if ! rsync -a --partial --human-readable "$DB_BACKUPS/" "$DEST_ROOT/database/"; then
  write_status true "database_copy_failed"
  exit 1
fi

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '%s' "$now" > "$LAST_SUCCESS"
write_status true "success"

echo "Media backup completed successfully."
