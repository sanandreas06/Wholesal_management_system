<#
  Saves a copy of the whole database (every table, including the sealed audit log) to ./backups.
  Run:  pnpm db:backup          (keeps the newest 30 copies; older ones are removed)
  Needs Docker Desktop running and the wms-postgres container up.

  To restore a copy into an EMPTY database (this replaces what is there; stop the API first):
    docker cp backups\wholesale_YYYY-MM-DD_HHMM.dump wms-postgres:/tmp/restore.dump
    docker exec wms-postgres pg_restore -U wholesale -d wholesale_management --clean --if-exists --no-owner /tmp/restore.dump
#>
param([string]$Out = "backups", [int]$Keep = 30, [string]$Container = "wms-postgres", [string]$User = "wholesale", [string]$Db = "wholesale_management")
$ErrorActionPreference = "Stop"

$running = docker ps --filter "name=^$Container$" --format "{{.Names}}"
if ($running -ne $Container) { Write-Error "The database container '$Container' is not running. Start Docker Desktop and the database first."; exit 1 }

New-Item -ItemType Directory -Force -Path $Out | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$file = Join-Path $Out "wholesale_$stamp.dump"

# dump inside the container, then copy the file out (avoids PowerShell re-encoding the data on the way)
docker exec $Container pg_dump -U $User -d $Db -Fc -f /tmp/wms-backup.dump
if ($LASTEXITCODE -ne 0) { Write-Error "The backup failed."; exit 1 }
docker cp "${Container}:/tmp/wms-backup.dump" $file
docker exec $Container rm -f /tmp/wms-backup.dump | Out-Null

if (-not (Test-Path $file) -or (Get-Item $file).Length -lt 1024) { Write-Error "The backup file looks empty. Do not rely on it."; exit 1 }
Get-ChildItem $Out -Filter "wholesale_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep | Remove-Item -Force
$mb = [math]::Round((Get-Item $file).Length / 1MB, 2)
Write-Host "Backed up to $file ($mb MB). Copy it somewhere off this computer too (a USB drive or cloud folder)."
