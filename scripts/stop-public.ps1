[CmdletBinding()]
param(
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $root '.run\pids.json'
if (-not (Test-Path -LiteralPath $statePath)) {
    if (-not $Quiet) { Write-Host 'No managed public session was found.' }
    return
}

try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
} catch {
    throw "Cannot read the public-session state at $statePath. No processes were stopped."
}

foreach ($role in @('tunnel', 'server')) {
    $entry = $state.$role
    if (-not $entry) { continue }
    if (-not $entry.id -or -not $entry.name -or -not $entry.startedUtc) {
        throw "The $role process record is invalid. No unverified process will be stopped."
    }
    $process = Get-Process -Id ([int]$entry.id) -ErrorAction SilentlyContinue
    if (-not $process) { continue }
    if ($process.ProcessName -ne $entry.name -or
        $process.StartTime.ToUniversalTime().ToString('o') -ne $entry.startedUtc) {
        Write-Warning "PID $($entry.id) no longer matches the recorded $role process; it was not stopped."
        continue
    }
    Stop-Process -Id $process.Id -ErrorAction Stop
    if (-not $Quiet) { Write-Host "Stopped $role process $($process.Id)." }
}

Remove-Item -LiteralPath $statePath -ErrorAction Stop
if (-not $Quiet) { Write-Host 'Public hosting stopped.' }
