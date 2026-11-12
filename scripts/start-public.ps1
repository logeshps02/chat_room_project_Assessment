[CmdletBinding()]
param(
    [int]$Port = 0
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root '.run'
$statePath = Join-Path $runDir 'pids.json'
$serverOut = Join-Path $runDir 'server.stdout.log'
$serverErr = Join-Path $runDir 'server.stderr.log'
$tunnelOut = Join-Path $runDir 'tunnel.stdout.log'
$tunnelErr = Join-Path $runDir 'tunnel.stderr.log'

if ($Port -eq 0) {
    if ($env:PORT) {
        if (-not [int]::TryParse($env:PORT, [ref]$Port)) {
            throw 'PORT must be a number between 1 and 65535.'
        }
    } else {
        $Port = 3000
    }
}
if ($Port -lt 1 -or $Port -gt 65535) {
    throw 'Port must be between 1 and 65535.'
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) {
    throw 'Node.js was not found. Install Node.js 20 or newer.'
}

$tunnelCommand = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
$tunnelPath = if ($tunnelCommand) { $tunnelCommand.Source } else { $null }
if (-not $tunnelPath) {
    $programFilesX86 = [Environment]::GetFolderPath('ProgramFilesX86')
    if ($programFilesX86) {
        $candidate = Join-Path $programFilesX86 'cloudflared\cloudflared.exe'
        if (Test-Path -LiteralPath $candidate) { $tunnelPath = $candidate }
    }
}
if (-not $tunnelPath) {
    throw 'cloudflared was not found. Install it with: winget install -e --id Cloudflare.cloudflared'
}

if (Test-Path -LiteralPath $statePath) {
    throw 'A public session is already recorded. Run npm run stop:public first.'
}

$listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
if (@($listeners | Where-Object { $_.Port -eq $Port }).Count -gt 0) {
    throw "Cannot use port $Port. Stop the existing server or choose another PORT."
}
$probe = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, $Port)
$probe.ExclusiveAddressUse = $true
try {
    $probe.Start()
} catch {
    throw "Cannot use port $Port. Stop the existing server or choose another PORT. $($_.Exception.Message)"
} finally {
    $probe.Stop()
}

Set-Location -LiteralPath $root
if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules'))) {
    $npmPath = Join-Path (Split-Path -Parent $nodePath) 'npm.cmd'
    if (-not (Test-Path -LiteralPath $npmPath)) { throw 'npm.cmd was not found beside Node.js.' }
    & $npmPath ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
}

New-Item -ItemType Directory -Path $runDir -Force | Out-Null
$state = [ordered]@{ port = $Port; url = $null; server = $null; tunnel = $null }

function Save-State {
    $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding UTF8
}

function Get-ProcessRecord($process) {
    return @{
        id = $process.Id
        name = $process.ProcessName
        startedUtc = $process.StartTime.ToUniversalTime().ToString('o')
    }
}

$server = $null
$tunnel = $null
try {
    $env:PORT = [string]$Port
    $env:HOST = '127.0.0.1'
    $server = Start-Process -FilePath $nodePath -ArgumentList 'src\server.js' -WorkingDirectory $root `
        -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -WindowStyle Hidden -PassThru
    $state.server = Get-ProcessRecord $server
    Save-State

    $healthUrl = "http://127.0.0.1:$Port/health"
    $deadline = (Get-Date).AddSeconds(30)
    $ready = $false
    $lastError = 'No health response.'
    while ((Get-Date) -lt $deadline) {
        $server.Refresh()
        if ($server.HasExited) { throw "The app server exited. See $serverErr." }
        try {
            $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2 -ErrorAction Stop
            if ($health.status -eq 'ok') {
                $ownedListener = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
                    Where-Object { $_.OwningProcess -eq $server.Id })
                if ($ownedListener.Count -gt 0) { $ready = $true; break }
                $lastError = 'The responding port is not owned by the new app process.'
            } else {
                $lastError = 'The health endpoint did not return status ok.'
            }
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Milliseconds 300
    }
    if (-not $ready) { throw "The app did not become ready: $lastError See $serverErr." }

    $tunnel = Start-Process -FilePath $tunnelPath `
        -ArgumentList @('tunnel', '--url', "http://127.0.0.1:$Port", '--no-autoupdate', '--protocol', 'http2') `
        -WorkingDirectory $root -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr `
        -WindowStyle Hidden -PassThru
    $state.tunnel = Get-ProcessRecord $tunnel
    Save-State

    $deadline = (Get-Date).AddSeconds(60)
    $publicUrl = $null
    while ((Get-Date) -lt $deadline) {
        $tunnel.Refresh()
        if ($tunnel.HasExited) {
            $details = if (Test-Path -LiteralPath $tunnelErr) {
                (Get-Content -LiteralPath $tunnelErr -Tail 5) -join ' '
            } else { 'No tunnel log is available.' }
            throw "Cloudflare Tunnel exited: $details See $tunnelErr."
        }
        $logs = ''
        foreach ($log in @($tunnelOut, $tunnelErr)) {
            if (Test-Path -LiteralPath $log) { $logs += (Get-Content -LiteralPath $log -Raw) }
        }
        if ($logs -match 'https://[a-z0-9][a-z0-9-]*\.trycloudflare\.com') {
            $publicUrl = $Matches[0]
            break
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $publicUrl) { throw "No public URL was received. See $tunnelErr." }
    $state.url = $publicUrl
    Save-State

    Write-Host "`nPublic chat URL: $publicUrl"
    Write-Host "Keep this window open. Press Ctrl+C or run npm run stop:public to stop it.`n"
    try {
        Set-Clipboard -Value $publicUrl -ErrorAction Stop
        Write-Host 'The URL was copied to the clipboard.'
    } catch {
        Write-Warning "Could not copy the URL to the clipboard: $($_.Exception.Message)"
    }

    $deadline = (Get-Date).AddSeconds(20)
    $publicReady = $false
    $lastError = 'No public health response.'
    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-RestMethod -Uri "$publicUrl/health" -TimeoutSec 4 -ErrorAction Stop
            if ($health.status -eq 'ok') { $publicReady = $true; break }
            $lastError = 'The public health endpoint did not return status ok.'
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 1
    }
    if ($publicReady) {
        Write-Host 'The public health check succeeded.'
    } else {
        Write-Warning "Could not verify the public URL from this laptop: $lastError"
    }

    $tunnelReported = $false
    while ($true) {
        $server.Refresh()
        if ($server.HasExited) {
            $stopDeadline = (Get-Date).AddSeconds(3)
            while ((Test-Path -LiteralPath $statePath) -and (Get-Date) -lt $stopDeadline) {
                Start-Sleep -Milliseconds 100
            }
            if (Test-Path -LiteralPath $statePath) { throw "The app server stopped. See $serverErr." }
            break
        }
        $tunnel.Refresh()
        if ($tunnel.HasExited -and -not $tunnelReported) {
            Write-Warning 'The tunnel stopped. The local app remains available until this session is stopped.'
            $tunnelReported = $true
        }
        Start-Sleep -Seconds 1
    }
} finally {
    try {
        if (Test-Path -LiteralPath $statePath) {
            & (Join-Path $PSScriptRoot 'stop-public.ps1') -Quiet
        }
    } finally {
        foreach ($process in @($tunnel, $server)) {
            if ($process -and -not $process.HasExited) {
                Stop-Process -Id $process.Id -ErrorAction Stop
            }
        }
    }
}
