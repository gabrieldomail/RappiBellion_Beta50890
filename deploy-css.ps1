Clear-Host
Write-Host "🎨 Iniciando despliegue de ESTILOS vía Worker (Filtro UTF-8 Seguro)..." -ForegroundColor Magenta
Write-Host "----------------------------------------"

# Paso 1: Leer el CSS
Write-Host "⏳ [1/3] Leyendo style.css desde el disco..." -ForegroundColor Cyan
if (-not (Test-Path ".\style.css")) {
    Write-Host "❌ Error: No se encontró el archivo style.css en esta carpeta." -ForegroundColor Red
    break
}
$cssLocal = Get-Content -Path ".\style.css" -Raw
Write-Host "✅ Archivo CSS leído correctamente." -ForegroundColor Green

# Paso 2: Crear el JSON de forma nativa
Write-Host "⏳ [2/3] Serializando JSON..." -ForegroundColor Cyan

$bodyObj = @{
    path    = "style.css"
    message = "🤖 metagabriel: Sincronizando hojas de estilo HUD v5.6 (Columnas Fix)"
    content = $cssLocal
}
$bodyStr = ConvertTo-Json -InputObject $bodyObj -Compress

# 🔥 EL TRUCO MAESTRO: Forzar la conversión a un arreglo de bytes en UTF-8
# Esto evita que PowerShell 5.1 corrompa los acentos y emojis al enviar el string
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyStr)

Write-Host "✅ JSON convertido a bytes UTF-8 de forma segura." -ForegroundColor Green

# Paso 3: Envío de red al Worker
Write-Host "⏳ [3/3] Disparando CSS al Worker de Cloudflare..." -ForegroundColor Cyan
try {
    # Enviamos $bodyBytes directamente en vez del string de texto plano
    $response = Invoke-RestMethod -Uri 'https://metagabriel.gabrieldomail.workers.dev' -Method Post -Headers @{ 'Content-Type' = 'application/json; charset=utf-8' } -Body $bodyBytes -TimeoutSec 30
    
    Write-Host "✅ ¡Despliegue de CSS completado! Respuesta del servidor:" -ForegroundColor Green
    $response
} 
catch {
    Write-Host "❌ Error en la petición de red:" -ForegroundColor Red
    $_ | Format-List -Property * -Force
}

Write-Host "----------------------------------------"
Write-Host "🏁 Proceso finalizado." -ForegroundColor Magenta