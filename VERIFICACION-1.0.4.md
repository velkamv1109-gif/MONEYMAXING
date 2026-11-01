# Verificación 1.0.4 — 31 de octubre de 2026

Entorno: Windows x64 del usuario, Electron 45.0.0, Node 24.22.1. Todos los recorridos se ejecutan con bóvedas sintéticas aisladas; no se descifra la bóveda real.

## Alcance

Cinco especialidades determinan módulos, comandos, categorías y cotizaciones. Cada perfil guarda preferencias propias y estado de trabajo. Un tema Frutiger Aero y siete paletas ejecutivas con superficies sin marcos decorativos. Se conserva el formato financiero v2; se añaden `settings` y `workspace` a cada perfil.

## Matriz y evidencia

| Control | Resultado |
|---|---|
| Sintaxis de nueve módulos | Aprobado |
| Pruebas unitarias y servidor | 29/29 |
| Crear perfiles inmobiliario, seguros, negocio y personal | Aprobado |
| Módulos y comandos ajenos ocultos; navegación restringida | Aprobado |
| Cotizaciones acordes a especialidad; membrete y moneda del perfil | Aprobado |
| Cambio entre perfiles A/B con tema y simuladores diferentes | Aprobado |
| Recuperación tras cerrar/reabrir | Aprobado |
| Error de guardado | Recupera apariencia confirmada y muestra error |
| Migrar bóveda cifrada de formato anterior con dos perfiles | Aprobado; movimientos, saldos, moneda y presupuestos idénticos |
| Ocho paletas: texto principal/secundario, atenuado y acento | Contraste calculado >= 4.5:1 sobre fondo base |
| Preferencias a 1280, 900 y 720 px | Corregidos recortes; controles y acciones dentro de la ventana |
| Revisión visual | Ocho temas y Preferencias revisados mediante capturas |

Los scripts reproducibles son `profiles-smoke.cjs`, `profiles-migration-smoke.cjs`, `packaged-smoke.cjs` y `quotation-smoke.cjs` en `scripts`. El test de migración cifra una bóveda ficticia, la abre con la app y verifica el contenido guardado, sin usar información real.

Se encontró y corrigió el cierre prematuro del servidor local durante la salida: ahora permanece activo hasta que termine el guardado del renderer. Si un guardado falla, la aplicación conserva la ventana y comunica el fallo. Durante desarrollo hubo un intento de reconstrucción con una instancia de prueba abierta; se descartó aquel paquete y se reconstruyó antes de la validación final.

## Límites

Las personalizaciones antiguas que nunca se guardaron por perfil no son recuperables. La migración parte del último ajuste global disponible y después los separa. Tema y simuladores se guardan automáticamente; nombre, especialidad y membrete se confirman con Guardar Preferencias. Los formularios sin enviar y borradores PDF no se conservan.

La especialidad es una organización de interfaz, no control de acceso entre usuarios con la misma contraseña. Cambiarla no elimina registros. Los controles de contraste cubren la paleta de texto, no certifican toda la aplicación. Se verificaron ventanas en este Windows, no todos los escalados posibles ni una máquina virtual limpia. El instalador sigue sin firma Authenticode por falta de certificado.
