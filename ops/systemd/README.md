# Julianne's Garcia Family — Archive Maintenance

This maintenance job performs two operations:

1. Creates a PostgreSQL custom-format database backup and verifies it with `pg_restore --list`.
2. Runs a read-only archive integrity scan and writes the latest report to the health backup directory.

It does not delete or repair media automatically.

## Host directories

Expected host paths:

```text
/srv/julianne-garcia-family/backups/database
/srv/julianne-garcia-family/backups/health
```

The project `.env` may define:

```text
ARCHIVE_BACKUP_ROOT=/srv/julianne-garcia-family/backups
```

Do not source the project `.env` in Bash. Pass it to Docker Compose with `--env-file`.

## Install the systemd units

```bash
sudo cp /srv/julianne-garcia-family/source/ops/systemd/julianne-family-maintenance.service /etc/systemd/system/
sudo cp /srv/julianne-garcia-family/source/ops/systemd/julianne-family-maintenance.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now julianne-family-maintenance.timer
```

## Verify the schedule

```bash
systemctl list-timers julianne-family-maintenance.timer
```

The default schedule is 02:15 Pacific/Honolulu each night and the timer is persistent.

## Run once manually

```bash
sudo systemctl start julianne-family-maintenance.service
sudo systemctl status julianne-family-maintenance.service --no-pager
```

## View recent maintenance logs

```bash
journalctl -u julianne-family-maintenance.service -n 100 --no-pager
```

## Verify database backups

```bash
ls -lh /srv/julianne-garcia-family/backups/database
```

Each completed backup is already verified inside the maintenance container before the temporary file is renamed to its final `.dump` name.

## View the latest integrity report

```bash
cat /srv/julianne-garcia-family/backups/health/latest.json
```

Integrity findings are reported in the JSON and Archive Health dashboard. They do not cause the maintenance service to fail unless the maintenance command itself cannot execute.

## Full media backup

A second physical destination is intentionally not configured yet. The current backup folder is on the NUC's NVMe storage while family media is on the HDD, but a true archival media backup should use another physical disk or another independently managed destination.
