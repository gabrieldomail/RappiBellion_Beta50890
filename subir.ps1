Clear-Host
Write-Host "🚀 Iniciando proceso de despliegue OPTIMIZADO..." -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Paso 1: Leer el archivo
Write-Host "⏳ [1/3] Leyendo indexpreeliminar.html..." -ForegroundColor Cyan
$htmlLocal = Get-Content -Path ".\indexpreeliminar.html" -Raw
Write-Host "✅ Archivo leído correctamente." -ForegroundColor Green

# Paso 2: Escapar caracteres a velocidad luz (Bypasseando ConvertTo-Json)
Write-Host "⏳ [2/3] Preparando JSON en alta velocidad..." -ForegroundColor Cyan

# Escapamos barras, comillas y saltos de línea usando reemplazo nativo de .NET (instantáneo)
$escapedHtml = $htmlLocal.Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n')

# Armamos el string del JSON a mano sin romper nada
$jsonMsg = "🤖 metagabriel: Desplegando HUD v5.6 - Modulo de Quema Unificado (RPPI-C) y Live Sync"
$bodyStr = '{"path":"indexpreeliminar.html","message":"' + $jsonMsg + '","content":"' + $escapedHtml + '"}'

Write-Host "✅ JSON estructurado en microsegundos." -ForegroundColor Green

# Paso 3: Envío de red
Write-Host "⏳ [3/3] Disparando petición al Worker (Esperando a Cloudflare)..." -ForegroundColor Cyan
try {
    # Enviamos directamente el string crudo ($bodyStr) en vez de un objeto
    $response = Invoke-RestMethod -Uri 'https://metagabriel.gabrieldomail.workers.dev' -Method Post -Headers @{ 'Content-Type' = 'application/json' } -Body $bodyStr -TimeoutSec 30
    
    Write-Host "✅ ¡Despliegue completado! Respuesta del servidor:" -ForegroundColor Green
    $response
} 
catch {
    Write-Host "❌ Error en la petición de red:" -ForegroundColor Red
    $_ | Format-List -Property * -Force
}

Write-Host "----------------------------------------"
Write-Host "🏁 Proceso finalizado." -ForegroundColor Yellow