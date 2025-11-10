# =========================================
# RAPPIBELLION DEPLOYMENT SCRIPT
# Automatización completa para publicar en la web
# =========================================

Write-Host "🚀 RAPPIBELLION DEPLOYMENT AUTOMATION" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Yellow

# Función para mostrar menú
function Show-Menu {
    Write-Host "`nSelecciona plataforma de deployment:" -ForegroundColor Green
    Write-Host "1. GitHub Pages (Gratis, automático)" -ForegroundColor White
    Write-Host "2. Cloudflare Pages (Recomendado, ultra-rápido)" -ForegroundColor White
    Write-Host "3. Netlify (Fácil, con dominio personalizado)" -ForegroundColor White
    Write-Host "4. Vercel (Moderno, con analytics)" -ForegroundColor White
    Write-Host "5. Firebase Hosting (Google, confiable)" -ForegroundColor White
    Write-Host "6. Ver estado actual del repositorio" -ForegroundColor White
    Write-Host "7. Salir" -ForegroundColor Red
}

# Función para verificar Git
function Check-Git {
    Write-Host "`n🔍 Verificando Git..." -ForegroundColor Yellow
    try {
        $gitStatus = git status --porcelain
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Repositorio Git OK" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Error en repositorio Git" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Git no encontrado. Instala Git primero." -ForegroundColor Red
        return $false
    }
}

# Función para verificar si hay cambios sin commit
function Check-Uncommitted {
    Write-Host "`n🔍 Verificando cambios sin commit..." -ForegroundColor Yellow
    $status = git status --porcelain
    if ($status) {
        Write-Host "⚠️  Hay cambios sin commit:" -ForegroundColor Yellow
        Write-Host $status -ForegroundColor White
        $commit = Read-Host "¿Quieres hacer commit de estos cambios? (y/n)"
        if ($commit -eq "y" -or $commit -eq "Y") {
            $message = Read-Host "Mensaje del commit"
            git add .
            git commit -m $message
            Write-Host "✅ Cambios commited" -ForegroundColor Green
        }
    } else {
        Write-Host "✅ No hay cambios sin commit" -ForegroundColor Green
    }
}

# Función para push a GitHub
function Push-To-GitHub {
    Write-Host "`n📤 Subiendo a GitHub..." -ForegroundColor Yellow
    try {
        git push origin main
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Push exitoso a GitHub" -ForegroundColor Green
            Write-Host "🌐 Repositorio: https://github.com/gabrieldomail/RappiBellion_Beta50890" -ForegroundColor Cyan
            return $true
        } else {
            Write-Host "❌ Error en push" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error al hacer push: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Función para configurar GitHub Pages
function Setup-GitHub-Pages {
    Write-Host "`n📖 INSTRUCCIONES PARA GITHUB PAGES:" -ForegroundColor Cyan
    Write-Host "===================================" -ForegroundColor Yellow
    Write-Host "1. Ve a: https://github.com/gabrieldomail/RappiBellion_Beta50890" -ForegroundColor White
    Write-Host "2. Haz clic en 'Settings' (engranaje)" -ForegroundColor White
    Write-Host "3. En menú lateral: 'Pages'" -ForegroundColor White
    Write-Host "4. Source: 'Deploy from a branch'" -ForegroundColor White
    Write-Host "5. Branch: main, Folder: /(root)" -ForegroundColor White
    Write-Host "6. Save" -ForegroundColor White
    Write-Host "" -ForegroundColor White
    Write-Host "⏱️  URL final: https://gabrieldomail.github.io/RappiBellion_Beta50890/" -ForegroundColor Green
    Write-Host "⏱️  Tiempo: 2-3 minutos para activarse" -ForegroundColor Yellow
}

# Función para configurar Cloudflare Pages
function Setup-Cloudflare-Pages {
    Write-Host "`n☁️  INSTRUCCIONES PARA CLOUDFLARE PAGES:" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Yellow
    Write-Host "1. Ve a: https://pages.cloudflare.com" -ForegroundColor White
    Write-Host "2. 'Create a project'" -ForegroundColor White
    Write-Host "3. 'Connect to Git' → GitHub" -ForegroundColor White
    Write-Host "4. Selecciona repo: RappiBellion_Beta50890" -ForegroundColor White
    Write-Host "5. Build settings:" -ForegroundColor White
    Write-Host "   - Branch: main" -ForegroundColor White
    Write-Host "   - Build command: (vacío)" -ForegroundColor White
    Write-Host "   - Build output: /" -ForegroundColor White
    Write-Host "6. 'Save and Deploy'" -ForegroundColor White
    Write-Host "" -ForegroundColor White
    Write-Host "⏱️  URL: https://rappibellion.pages.dev/" -ForegroundColor Green
    Write-Host "⏱️  Tiempo: 1-2 minutos" -ForegroundColor Yellow
    Write-Host "🚀 Ventajas: CDN global, SSL automático, ultra-rápido" -ForegroundColor Green
}

# Función para configurar Netlify
function Setup-Netlify {
    Write-Host "`n🌐 INSTRUCCIONES PARA NETLIFY:" -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Yellow
    Write-Host "1. Ve a: https://netlify.com" -ForegroundColor White
    Write-Host "2. Regístrate/inicia sesión" -ForegroundColor White
    Write-Host "3. 'Add new site' → 'Import from Git'" -ForegroundColor White
    Write-Host "4. Conecta GitHub y selecciona repo" -ForegroundColor White
    Write-Host "5. Build settings automáticas (no cambiar)" -ForegroundColor White
    Write-Host "6. 'Deploy site'" -ForegroundColor White
    Write-Host "" -ForegroundColor White
    Write-Host "⏱️  URL personalizada disponible" -ForegroundColor Green
    Write-Host "⏱️  Tiempo: 1-2 minutos" -ForegroundColor Yellow
}

# Función para configurar Vercel
function Setup-Vercel {
    Write-Host "`n▲ INSTRUCCIONES PARA VERCEL:" -ForegroundColor Cyan
    Write-Host "===========================" -ForegroundColor Yellow
    Write-Host "1. Ve a: https://vercel.com" -ForegroundColor White
    Write-Host "2. 'Import Project'" -ForegroundColor White
    Write-Host "3. Conecta GitHub" -ForegroundColor White
    Write-Host "4. Selecciona repo y configura:" -ForegroundColor White
    Write-Host "   - Framework: Other" -ForegroundColor White
    Write-Host "   - Root Directory: ./" -ForegroundColor White
    Write-Host "5. 'Deploy'" -ForegroundColor White
    Write-Host "" -ForegroundColor White
    Write-Host "⏱️  URL: *.vercel.app" -ForegroundColor Green
    Write-Host "⏱️  Tiempo: 30 segundos - 1 minuto" -ForegroundColor Yellow
}

# Función para configurar Firebase
function Setup-Firebase {
    Write-Host "`n🔥 INSTRUCCIONES PARA FIREBASE:" -ForegroundColor Cyan
    Write-Host "===============================" -ForegroundColor Yellow
    Write-Host "1. Instala Firebase CLI: npm install -g firebase-tools" -ForegroundColor White
    Write-Host "2. firebase login" -ForegroundColor White
    Write-Host "3. firebase init hosting" -ForegroundColor White
    Write-Host "4. Selecciona proyecto existente o crea nuevo" -ForegroundColor White
    Write-Host "5. Public directory: ." -ForegroundColor White
    Write-Host "6. firebase deploy" -ForegroundColor White
    Write-Host "" -ForegroundColor White
    Write-Host "⏱️  URL: https://tu-proyecto.firebaseapp.com" -ForegroundColor Green
}

# Función para mostrar estado del repo
function Show-Repo-Status {
    Write-Host "`n📊 ESTADO DEL REPOSITORIO:" -ForegroundColor Cyan
    Write-Host "==========================" -ForegroundColor Yellow

    try {
        Write-Host "Repositorio local:" -ForegroundColor White
        git remote -v | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

        Write-Host "`nÚltimo commit:" -ForegroundColor White
        git log --oneline -5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

        Write-Host "`nEstado de archivos:" -ForegroundColor White
        $status = git status --porcelain
        if ($status) {
            Write-Host "⚠️  Cambios sin commit:" -ForegroundColor Yellow
            $status | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        } else {
            Write-Host "✅ Todo commited" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Error al obtener estado del repo" -ForegroundColor Red
    }
}

# Función principal
function Main {
    if (-not (Check-Git)) {
        return
    }

    Check-Uncommitted

    $continue = $true
    while ($continue) {
        Show-Menu
        $choice = Read-Host "`nSelecciona opción (1-7)"

        switch ($choice) {
            "1" {
                Write-Host "`n🏠 GITHUB PAGES - CONFIGURACIÓN" -ForegroundColor Cyan
                if (Push-To-GitHub) {
                    Setup-GitHub-Pages
                }
            }
            "2" {
                Write-Host "`n☁️  CLOUDFLARE PAGES - CONFIGURACIÓN" -ForegroundColor Cyan
                if (Push-To-GitHub) {
                    Setup-Cloudflare-Pages
                }
            }
            "3" {
                Write-Host "`n🌐 NETLIFY - CONFIGURACIÓN" -ForegroundColor Cyan
                if (Push-To-GitHub) {
                    Setup-Netlify
                }
            }
            "4" {
                Write-Host "`n▲ VERCEL - CONFIGURACIÓN" -ForegroundColor Cyan
                if (Push-To-GitHub) {
                    Setup-Vercel
                }
            }
            "5" {
                Write-Host "`n🔥 FIREBASE - CONFIGURACIÓN" -ForegroundColor Cyan
                Setup-Firebase
            }
            "6" {
                Show-Repo-Status
            }
            "7" {
                Write-Host "`n👋 ¡Hasta luego! Rappibellion estará esperándote." -ForegroundColor Green
                $continue = $false
            }
            default {
                Write-Host "❌ Opción inválida. Intenta de nuevo." -ForegroundColor Red
            }
        }

        if ($choice -ne "7" -and $choice -ne "6") {
            Write-Host "`n" + "="*50 -ForegroundColor Yellow
            Write-Host "🎯 RECUERDA: Una vez configurado, tu sitio estará online en minutos!" -ForegroundColor Green
            Write-Host "🚀 Comparte la URL con el mundo: #Rappibellion #T2E #Cyberpunk" -ForegroundColor Cyan
            Write-Host "="*50 -ForegroundColor Yellow
        }
    }
}

# Ejecutar script principal
Main
