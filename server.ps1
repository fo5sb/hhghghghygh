# ==============================================================================
# Al-Madkhoorah Dates Receipt System - Local Web Server (PowerShell)
# Safe, 100% ANSI/UTF-8 compatible - No non-ASCII characters to avoid parsing errors
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Port = 8080
$BaseDir = $PSScriptRoot

# Get all active local IPv4 addresses
$localIPs = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
    $_.InterfaceAlias -notmatch 'Loopback' -and 
    $_.IPAddress -notmatch '^169\.254' -and 
    $_.IPAddress -notmatch '^127\.' 
} | Select-Object -ExpandProperty IPAddress)

Write-Host "================================================================" -ForegroundColor Green
Write-Host " Al-Madkhoorah Dates Web Server - Local Network (WiFi)" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host " PC (Localhost):   http://localhost:$Port/" -ForegroundColor Cyan
Write-Host ""
Write-Host " Mobile & Tablets on same WiFi:" -ForegroundColor White
if ($localIPs.Count -gt 0) {
    foreach ($ip in $localIPs) {
        Write-Host "   -> http://$($ip):$Port/" -ForegroundColor Yellow
    }
} else {
    Write-Host "   -> Connect this PC to WiFi to access from mobile" -ForegroundColor Gray
}
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host " Opening browser automatically..." -ForegroundColor Gray
Write-Host " Press Ctrl + C to stop the server at any time." -ForegroundColor DarkGray
Write-Host ""

Start-Process "http://localhost:$Port/"

$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".txt"  = "text/plain; charset=utf-8"
    ".webmanifest" = "application/manifest+json"
}

$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
try {
    $Listener.Start()
} catch {
    $Port = 8085
    $Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
    $Listener.Start()
    Write-Host " Port 8080 in use. Switched to alternate port: $Port" -ForegroundColor Yellow
}

while ($true) {
    try {
        $Client = $Listener.AcceptTcpClient()
        $Client.ReceiveTimeout = 4000
        $Client.SendTimeout = 4000

        $Stream = $Client.GetStream()
        $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::UTF8)

        $RequestLine = $Reader.ReadLine()
        if (-not [string]::IsNullOrWhiteSpace($RequestLine)) {
            $Parts = $RequestLine.Split(' ')
            if ($Parts.Length -ge 2) {
                $Method = $Parts[0]
                $RawPath = $Parts[1].Split('?')[0]
                $DecodedPath = [System.Uri]::UnescapeDataString($RawPath)
                if ($DecodedPath -eq "/" -or [string]::IsNullOrWhiteSpace($DecodedPath)) {
                    $DecodedPath = "/index.html"
                }

                $RelPath = $DecodedPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
                $FilePath = [System.IO.Path]::Combine($BaseDir, $RelPath)

                if ($DecodedPath -eq "/api/server-info") {
                    $ipsJson = if ($localIPs.Count -gt 0) { ($localIPs | ForEach-Object { "`"$_`"" }) -join "," } else { "" }
                    $jsonContent = '{"port":' + "$Port" + ',"ips":[' + $ipsJson + ']}'
                    $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonContent)
                    $header = "HTTP/1.1 200 OK`r`nAccess-Control-Allow-Origin: *`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($jsonBytes.Length)`r`nConnection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                    $Stream.Write($headerBytes, 0, $headerBytes.Length)
                    $Stream.Write($jsonBytes, 0, $jsonBytes.Length)
                }
                elseif ([System.IO.File]::Exists($FilePath)) {
                    $Ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
                    $ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }
                    $FileBytes = [System.IO.File]::ReadAllBytes($FilePath)

                    $Header = "HTTP/1.1 200 OK`r`nAccess-Control-Allow-Origin: *`r`nContent-Type: $ContentType`r`nContent-Length: $($FileBytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
                    $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)

                    $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
                    $Stream.Write($FileBytes, 0, $FileBytes.Length)
                }
                else {
                    $NotFoundMsg = "<html><head><meta charset='utf-8'></head><body style='text-align:center;padding:50px;'><h2>404 Not Found</h2><p><a href='/'>Back to Home</a></p></body></html>"
                    $NotFoundBytes = [System.Text.Encoding]::UTF8.GetBytes($NotFoundMsg)
                    $Header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/html; charset=utf-8`r`nContent-Length: $($NotFoundBytes.Length)`r`nConnection: close`r`n`r`n"
                    $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)

                    $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
                    $Stream.Write($NotFoundBytes, 0, $NotFoundBytes.Length)
                }
            }
        }

        $Stream.Flush()
        $Stream.Close()
        $Client.Close()
    }
    catch {
        # Catch and continue on client disconnects
    }
}
