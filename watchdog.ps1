# SH - Project Manager Watchdog — מחזיר שרתים שנפלו אוטומטית
Write-Host "SH - Project Manager Watchdog started" -ForegroundColor Cyan

$apiJob = $null
$webJob = $null

function Start-Api {
    Write-Host "$(Get-Date -f 'HH:mm:ss') Starting API..." -ForegroundColor Yellow
    return Start-Job { Set-Location C:\deanreport\apps\api; npx tsx src/index.ts 2>&1 }
}

function Start-Web {
    Write-Host "$(Get-Date -f 'HH:mm:ss') Starting Web..." -ForegroundColor Yellow
    return Start-Job { Set-Location C:\deanreport\apps\web; npx next dev -p 3003 -H 0.0.0.0 2>&1 }
}

$apiJob = Start-Api
Start-Sleep -Seconds 4
$webJob = Start-Web

while ($true) {
    Start-Sleep -Seconds 15

    # בדיקת API
    $apiOk = $false
    try { Invoke-RestMethod http://localhost:3002/health -TimeoutSec 3 | Out-Null; $apiOk = $true } catch {}
    if (-not $apiOk) {
        Write-Host "$(Get-Date -f 'HH:mm:ss') API down — restarting..." -ForegroundColor Red
        if ($apiJob) { Stop-Job $apiJob; Remove-Job $apiJob -Force }
        $apiJob = Start-Api
        Start-Sleep -Seconds 8
    }

    # בדיקת Web
    $webOk = $false
    try { Invoke-WebRequest http://localhost:3003 -UseBasicParsing -TimeoutSec 5 | Out-Null; $webOk = $true } catch {}
    if (-not $webOk) {
        Write-Host "$(Get-Date -f 'HH:mm:ss') Web down — restarting..." -ForegroundColor Red
        if ($webJob) { Stop-Job $webJob; Remove-Job $webJob -Force }
        $webJob = Start-Web
    }

    Write-Host "$(Get-Date -f 'HH:mm:ss') API:$(if($apiOk){'OK'}else{'RESTARTING'}) | Web:$(if($webOk){'OK'}else{'RESTARTING'})" -ForegroundColor $(if($apiOk -and $webOk){'Green'}else{'Yellow'})
}
