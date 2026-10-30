$ErrorActionPreference = 'Stop'

$command = Get-Command tailscale.exe -ErrorAction SilentlyContinue
if ($command) {
    $tailscale = $command.Source
} else {
    $candidate = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (Test-Path $candidate) {
        $tailscale = $candidate
    } else {
        throw 'Instala Tailscale en esta PC e inicia sesión antes de habilitar el acceso móvil.'
    }
}

Write-Host 'Verificando que MONEYMAXING esté abierto y escuchando en el puerto 4765...'
try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4765/api/health' -TimeoutSec 3
} catch {
    throw 'Abre MONEYMAXING en la PC y vuelve a ejecutar este script.'
}
if (-not $health.ok) {
    throw 'El servicio de MONEYMAXING no respondió correctamente.'
}

Write-Host 'Configurando HTTPS privado de Tailscale...'
& $tailscale serve --bg 4765
if ($LASTEXITCODE -ne 0) {
    throw 'Tailscale no pudo activar Serve. Revisa su sesión y habilita HTTPS en la consola de Tailscale.'
}

Write-Host ''
Write-Host 'Dirección privada para abrir en el navegador del celular:'
& $tailscale serve status
