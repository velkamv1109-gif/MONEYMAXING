# Registro de entrega — MONEYMAXING 1.0.1

Fecha: 30 de octubre de 2026, America/Mexico_City. Entorno: Windows x64, versión 10.0.26300; Node 24.22.1, npm 12.2.1, Electron 45.0.0, Electron Builder 26.18.0, Playwright 1.64.1.

## Diagnóstico confirmado

El proyecto real se localizó en `C:\Users\KITANAI\finanzas-app`. No tenía Git. Se preservó esa carpeta y se creó una copia con historial local y rama `fix/windows-delivery` en el espacio de este chat. El código actualizado completo se entrega en el ZIP de fuente.

El EXE de Descargas mide 249,797,632 bytes y su SHA-256 coincide con el de `release/win-unpacked`: `F7D3CC8EE19EAF2FF52EDBDE51181F239BF7690BDAC0DCF7B81D783DB1A93612`.

Ejecutado aislado en una carpeta de prueba terminó con código `-2147483645` y `Invalid file descriptor to ICU data received.` El paquete original completo sí abrió en Windows. En el proyecto existían `icudtl.dat`, `locales`, `resources/app.asar` y un instalador 1.0.0. La causa del fallo de la copia examinada es su distribución incompleta; no demuestra vulnerabilidades internas.

## Resultado de controles

| Control | Resultado y evidencia |
|---|---|
| Dependencias limpias | `npm ci`, 285 paquetes, y descargador oficial `node node_modules/electron/install.js` completados; lockfile coherente. Se redirigieron cachés/temporales a la carpeta de trabajo por restricciones del entorno. |
| Sintaxis | `npm run check`, aprobado para main, servidor, renderer y núcleo financiero. |
| Pruebas automáticas | 16/16 aprobadas, 0 fallos. Incluyen centavos, calendario, CSV, crédito/ahorro, esquema/migración antigua, seguridad del shell, servidor, conflictos y recuperación. |
| Interfaz | 18 puntos de comprobación aprobados entre `ui-smoke.cjs` y `ui-regression.cjs`, con datos ficticios. |
| Ventanas y teclado | Nueve módulos sin desbordamiento horizontal de documento a 1280, 900 y 720 px; Tab queda en el diálogo, Escape cierra y devuelve foco al botón; movimiento reducido. Capturas principales revisadas. |
| Paquete final | Electron `app.isPackaged=true`, versión 1.0.1, creación/guardado, cierre/reapertura y nueve módulos aprobados mediante `packaged-smoke.cjs`. |
| Instalador | NSIS generado, instalación silenciosa en carpeta temporal con salida 0; ejecutable instalado pasó las mismas pruebas. Desinstalación de prueba salida 0. No se borró la bóveda real; el acceso directo original conservó su destino. |
| Integridad | `app.asar` incluye exactamente los archivos declarados; comparación de los seis archivos de aplicación con la fuente aprobada. Nombre/editor MONEYMAXING y versión 1.0.1.0 en el EXE. |
| Dependencias vulnerables | `npm audit`: 0 reportadas en todas las severidades al verificar. Esto no garantiza ausencia de vulnerabilidades desconocidas. |
| Firma | `NotSigned`. No existe un certificado disponible para esta entrega. |
| Tipos/lint | No aplican como controles configurados: el proyecto es JavaScript y no traía TypeScript ni linter. No se presentan como ejecutados. |

Los obstáculos iniciales del entorno (EPERM, cachés y ejecución de NSIS en el sandbox) se resolvieron para generar y probar la entrega final. El proceso de compilación no publicó código ni datos.

## Matriz funcional ejecutada

| Flujo | Resultado |
|---|---|
| Primer arranque, contraseña y perfil | Crea bóveda vacía y un perfil; contraseña incorrecta muestra error recuperable. |
| Ingresos, gastos y edición | $1,000.10 menos $0.10 = $1,000.00; al editar gasto a $0.20, saldo $999.90. Totales de libro usan centavos. |
| Datos inválidos | Fechas imposibles, montos no finitos/fuera de rango y formatos desconocidos rechazados. |
| Conexión fallida | Se abortó una escritura: muestra error, revierte el modelo y permite reintentar sin duplicado. |
| Doble clic | Dos activaciones rápidas crean un solo movimiento. |
| Presupuesto y meta | Límite guardado; meta creada y ahorro actualizado de $100 a $250. |
| Clientes | Alta, edición, propuesta y eliminación sobre el cliente filtrado correcto; otro cliente permanece. |
| Inmuebles y cuentas pendientes | Alta de inmueble con comisión 0%; cuenta por cobrar $123.45 conservada. |
| Exportación | Botones produjeron CSV y `.mmxvault`; CSV protege celdas que comenzarían fórmulas. |
| Restauración | Contraseña incorrecta no cambia revisión; respaldo válido se descifra y valida antes de sustituir; se puede reabrir. |
| Concurrencia y reinicio | Escritura obsoleta rechazada; dos escritores generan 200/409; estado persiste tras reiniciar servidor y aplicación. |
| Migración | Fixture v1 conserva saldo inicial, moneda USD, movimiento e importe; versión futura rechazada sin mutarla. No se descifró la bóveda real del usuario. |
| Simulaciones | Crédito $12,000 a tasa cero/12 meses = $1,000; crédito $100,000 a 12%/12 meses = $8,884.878867834; ahorro sin interés y aportaciones al cierre contrastados con casos conocidos. Precio <= costo informa que no hay equilibrio. |
| Seguridad HTTP | Host ajeno, Origin ajeno y `Sec-Fetch-Site: cross-site` reciben 403. Archivo corrupto no se reemplaza. CSP, no framing, aislamiento y popups comprobados. |

## Seguridad: alcance y pendientes

**Defectos confirmados y corregidos:** fallos de persistencia/reintento, acciones sobre índices equivocados de clientes, restauración sin descifrado previo, salida CSV susceptible de interpretar fórmulas, scripts inline permisivos y validación ausente de Host/Origin. Los dos últimos son configuraciones inseguras corregidas; no se realizó una explotación remota completa.

El shell mantiene `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`, `webSecurity=true`; no expone preload ni IPC a la página. Bloquea navegación, ventanas nuevas, webviews y permisos. No ejecuta comandos del usuario ni incluye actualizador. El paquete solo contiene archivos de aplicación explícitos; no incorpora `.env`, credenciales, datos de prueba ni registros personales. La búsqueda de patrones evidentes de claves privadas en la fuente no encontró coincidencias.

**Riesgos y comprobaciones pendientes:** el acceso móvil Tailscale no se configuró ni probó entre dispositivos; su red privada es el límite de autorización HTTP. Un dispositivo autorizado o proceso local con acceso suficiente podría sustituir el sobre cifrado: la contraseña protege contenido, no ofrece una segunda autenticación de API. Requiere dispositivos de confianza y respaldos externos. No se verificó resistencia física, análisis forense de memoria, antivirus comerciales, malware local, corte eléctrico real ni explotación avanzada. No se identificaron vulnerabilidades críticas/altas confirmadas pendientes en el alcance revisado; no equivale a una auditoría completa.

La revisión de configuración se contrastó con la [guía de seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security). El empaquetado usa los [targets Windows de Electron Builder 26](https://www.electron.build/v26/docs/win/) y su [instalador NSIS](https://www.electron.build/v26/docs/nsis/).

## Comprobaciones fuera del entorno disponible

No se disponía de una VM limpia ni un segundo PC. La instalación probada fue en este Windows con herramientas de desarrollo presentes; el ejecutable empaquetado sirvió sus recursos propios y no necesitó servidor de desarrollo. No se cambió el escalado global de Windows; los tamaños se comprobaron mediante emulación de viewport, no una matriz de DPI del sistema. Tampoco se probó una impresora física, impresión PDF, macOS o teléfono.

Prueba reproducible en un Windows limpio:

1. Copiar instalador y `SHA256SUMS.txt`; comprobar con `Get-FileHash -Algorithm SHA256`.
2. Instalar para el usuario, abrir sin Node/npm ni servidores de desarrollo, crear una bóveda de prueba.
3. Registrar ingreso $100.10 y gasto $0.10; saldo esperado $100.00. Editar y exportar.
4. Cerrar/reabrir, comprobar persistencia, descargar respaldo y restaurarlo con su contraseña.
5. Repetir con red desconectada (escritorio local); revisar ventana a 100%, 125% y 150% de escalado.
6. Desinstalar sin borrar datos, reinstalar y confirmar la misma bóveda. Verificar registros sin fallos críticos.

## Artefactos y hashes

- `MONEYMAXING-Setup-1.0.1.exe`: 121,348,555 bytes. SHA-256 `2E3090D64230D1F386FB27AEF541943BFD9AC92EFD6AA316216B55683A7A825A`.
- `MONEYMAXING-1.0.1-Windows-x64.zip`: 153,256,117 bytes. SHA-256 `D1C65545575E2145250E9D6C1CB3FCEF210A742AB69161B4874F2D6014F4D261`.
- Fuente completa, guía, registro, notas y capturas se entregan junto a estos artefactos. Los datos de las capturas son ficticios.
