<#
  Replaces the placeholder JWT_SECRET in .env with a long random one, and sets AUDIT_SEAL_KEY (the key that seals the Change log).
  The secrets are made on THIS computer and are never printed, so nobody (including Claude) ever sees them.

  Run:  pnpm secrets:set        (stop the API first)
  Then: pnpm audit:rotate-key   (moves the sealed Change log to the new key, and checks it on the way)

  What it does:
    1. copies .env to .env.backup-<date> first (that copy is ignored by git, but keep it private, it holds the old secrets)
    2. writes new JWT_SECRET and AUDIT_SEAL_KEY (each 64 random bytes)
    3. remembers the old values in AUDIT_SEAL_KEY_OLD so the Change log can be carried over
  Everyone gets signed out once (their old sign-in no longer matches the new secret).
#>
param([switch]$Force)
$ErrorActionPreference = "Stop"

$envFile = Join-Path (Get-Location) ".env"
if (-not (Test-Path $envFile)) { Write-Error "No .env file found here. Run this from the project's main folder."; exit 1 }

$raw = [System.IO.File]::ReadAllText($envFile)
$eol = if ($raw -match "`r`n") { "`r`n" } else { "`n" }
$lines = [System.Collections.Generic.List[string]]::new()
foreach ($l in ($raw -split "\r?\n")) { $lines.Add($l) }
while ($lines.Count -gt 0 -and $lines[$lines.Count - 1] -eq "") { $lines.RemoveAt($lines.Count - 1) }

function Get-Val([string]$name) {
  foreach ($l in $lines) { if ($l -match "^\s*$name\s*=\s*(.*)$") { return $Matches[1].Trim().Trim('"').Trim("'") } }
  return ""
}
function Set-Val([string]$name, [string]$value) {
  for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "^\s*#?\s*$name\s*=") { $lines[$i] = "$name=$value"; return } }
  $lines.Add("$name=$value")
}
function New-Secret { $b = New-Object byte[] 64; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); return (($b | ForEach-Object { $_.ToString("x2") }) -join "") }

if ((Get-Val "AUDIT_SEAL_KEY_OLD") -ne "" -and -not $Force) {
  Write-Host "The secrets were already changed and the Change log has not been carried over yet."
  Write-Host "Next step:  pnpm audit:rotate-key"
  exit 0
}
$oldJwt = Get-Val "JWT_SECRET"; $oldSeal = Get-Val "AUDIT_SEAL_KEY"
$placeholder = ($oldJwt -eq "" -or $oldJwt -match "change-this|development-secret" -or $oldJwt.Length -lt 32)
if (-not $placeholder -and $oldSeal.Length -ge 32 -and -not $Force) {
  Write-Host "JWT_SECRET and AUDIT_SEAL_KEY already look strong. Nothing was changed. (Use -Force only if you really want new ones.)"
  exit 0
}

# 1. back up .env
$backup = "$envFile.backup-" + (Get-Date -Format "yyyyMMdd-HHmmss")
Copy-Item $envFile $backup

# 2/3. old values (every key the Change log could have been sealed with) and new ones
$old = @($oldSeal, $oldJwt, "development-secret", "change-this-development-secret") | Where-Object { $_ -ne "" } | Select-Object -Unique
Set-Val "AUDIT_SEAL_KEY_OLD" ($old -join ",")
Set-Val "JWT_SECRET" (New-Secret)
Set-Val "AUDIT_SEAL_KEY" (New-Secret)

[System.IO.File]::WriteAllText($envFile, (($lines -join $eol) + $eol), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Done. New JWT_SECRET and AUDIT_SEAL_KEY are saved in .env (not shown here on purpose)."
Write-Host "A copy of your old .env is at: $backup"
Write-Host "  - keep that copy private; delete it once everything works."
Write-Host ""
Write-Host "Next:  pnpm audit:rotate-key   (carries the Change log over to the new key, with the API still stopped)"
