# MONEYMAXING

Aplicación de escritorio para Windows/macOS y acceso web privado desde el celular. La PC principal hospeda la bóveda cifrada; el celular se conecta mediante Tailscale Serve con HTTPS.

## Windows

1. Instala `MONEYMAXING-Setup-1.0.0.exe` y abre MONEYMAXING.
2. Instala Tailscale en la PC y el celular, e inicia sesión con la misma cuenta.
3. Con MONEYMAXING abierto, ejecuta `scripts/enable-mobile-access.ps1` en PowerShell. Si Tailscale pide habilitar HTTPS para tu red, sigue su enlace de autorización.
4. Copia la URL `https://...ts.net` que muestra `tailscale serve status` y ábrela en el navegador del celular.
5. Crea la bóveda una sola vez y utiliza la misma contraseña en ambos dispositivos.

La PC y MONEYMAXING deben permanecer encendidos para acceder desde el teléfono. Cierra el acceso con `tailscale serve off`.

## Crear instalador

- Windows: `npm install` y `npm run dist:win`
- macOS: `npm install` y `npm run dist:mac` (ejecutar en macOS)

## Datos y seguridad

El navegador cifra el contenido con AES-GCM antes de enviarlo. La PC solo guarda el sobre cifrado en el directorio de datos de MONEYMAXING. Tailscale limita el acceso a los dispositivos autorizados de la red privada y entrega HTTPS. Mantén una contraseña larga y protege la cuenta de Tailscale. Si se olvida la contraseña, la bóveda no se puede recuperar. Haz respaldos del archivo cifrado.

Las escrituras usan revisiones para rechazar cambios obsoletos entre dispositivos y evitar sobrescribir silenciosamente una versión más reciente.
