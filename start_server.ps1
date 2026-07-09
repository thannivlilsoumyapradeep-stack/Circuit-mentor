# PowerShell static file web server for Circuit Mentor PWA
# Runs on http://localhost:8000

$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "========================================="
    Write-Host "  Circuit Mentor local server is running!"
    Write-Host "  Open your browser to: http://localhost:$port/"
    Write-Host "  Press Ctrl+C in this terminal to stop."
    Write-Host "========================================="
} catch {
    Write-Error "Failed to start HTTP listener: $_"
    Exit
}

$workspacePath = Get-Item .
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Resolve request path
        $url = $request.Url.LocalPath
        if ($url -eq "/") { $url = "/index.html" }
        
        # Clean url query/hash signs and combine path
        $cleanUrl = $url.Split("?")[0].Split("#")[0]
        $filePath = [System.IO.Path]::Combine($workspacePath.FullName, $cleanUrl.TrimStart('/'))
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Resolve Content-Type header
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "text/plain"
            if ($ext -eq ".html") { $contentType = "text/html; charset=utf-8" }
            elseif ($ext -eq ".css") { $contentType = "text/css; charset=utf-8" }
            elseif ($ext -eq ".js") { $contentType = "application/javascript; charset=utf-8" }
            elseif ($ext -eq ".svg") { $contentType = "image/svg+xml" }
            elseif ($ext -eq ".json") { $contentType = "application/json; charset=utf-8" }
            elseif ($ext -eq ".png") { $contentType = "image/png" }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            # File not found
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found: $cleanUrl")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    } catch {
        # Silent fail on socket closures
    }
}
$listener.Stop()
