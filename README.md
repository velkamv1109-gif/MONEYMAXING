# MONEYMAXING 1.0.4

Finanzas por perfil, movimientos, presupuestos/metas, inmuebles, clientes y cuentas pendientes. Incluye simulaciones de crédito y ahorro. El contenido de la bóveda se cifra con AES-256-GCM antes de guardarse en el servidor HTTP local.

## Instalar y usar

1. Ejecuta `MONEYMAXING-Setup-1.0.4.exe` para tu usuario. Alternativa: extrae **todo** `MONEYMAXING-1.0.4-Windows-x64.zip` y abre `MONEYMAXING.exe` dentro de la carpeta extraída. Conserva `resources`, `locales`, `icudtl.dat`, DLL y demás archivos juntos. Copiar solamente el EXE causa el error de ICU.
2. Crea una contraseña de al menos 10 caracteres, preferiblemente una frase larga y única. No hay recuperación de contraseña. Configura tu perfil y moneda.
3. Registra ingresos/gastos con **Movimiento**; edítalos en **Movimientos**. Se admiten dos decimales. Los perfiles son libros separados; cambiar la moneda no convierte importes.
4. En **Presupuestos y metas**, guarda límites y actualiza el ahorro de tus metas. En **Clientes**, registra/edita datos y genera propuestas con los importes que tú proporcionaste. No se consulta a aseguradoras ni se emiten pólizas.
5. Descarga periódicamente un `.mmxvault` desde **Seguridad y respaldos**. La exportación CSV contiene movimientos en texto legible.

El paquete no tiene firma Authenticode porque no se dispone de certificado. El editor en metadatos es la marca MONEYMAXING; no es una identidad acreditada por certificado. No hay actualización automática, compras ni servicios de pago integrados.

## Perfiles y especialidades

Pulsa el nombre del perfil en la barra lateral para cambiar directamente de espacio de trabajo. En **Preferencias** puedes crear un perfil o editar el nombre y la especialidad del actual; pulsa **Guardar Preferencias** para confirmar nombre, especialidad, moneda, membrete, sonido y bloqueo.

- **General:** todos los módulos y cuatro tipos de cotización.
- **Personal:** resumen, movimientos, presupuestos y metas; PDF de retiro.
- **Inmobiliario:** resumen, movimientos, inmuebles e hipotecas; PDF hipotecario y de servicios.
- **Seguros y retiro:** resumen, movimientos, seguros/retiro y clientes; PDF de seguro y retiro.
- **Contabilidad y negocio:** resumen, movimientos, contabilidad y presupuestos/metas; PDF de servicios.

Preferencias y Seguridad/respaldos permanecen disponibles en todos. Las categorías se adaptan; las categorías antiguas con registros o presupuestos conservan acceso a sus datos. Cambiar de especialidad oculta herramientas ajenas sin borrar registros. General permite volver a ver todos los módulos. La especialidad organiza el trabajo; no constituye un permiso de seguridad entre personas que comparten la contraseña de la bóveda.

Cada perfil conserva su tema, membrete, moneda, sonido, bloqueo y animación. También recupera su última pantalla, filtros y parámetros de los simuladores. Tema, navegación y simuladores se guardan automáticamente: espera **Guardado**. No se guardan formularios sin enviar ni borradores PDF. La moneda no se puede cambiar si el perfil ya tiene importes.

Al abrir una bóveda anterior, cada perfil recibe una copia independiente de las preferencias globales existentes. No se pueden reconstruir personalizaciones históricas que las versiones anteriores nunca guardaron. Los movimientos, saldos y demás registros se conservan; no cambia el cifrado ni la versión 2 del modelo de datos.

Temas: **Frutiger Aero** (cielo/agua/verde, superficies abiertas) y siete ejecutivos: Grafito, Marfil y bronce, Azul noche, Plata y tinta, Ciruela, Borgoña y Salvia. Cada tema define su acento coordinado. Se mantienen controles sin burbujas ni marcos decorativos.

Pruebas adicionales sobre un paquete compilado:

```powershell
node scripts/profiles-smoke.cjs
node scripts/profiles-migration-smoke.cjs
```

## Cotizaciones en PDF

Desde cualquier módulo, pulsa **Cotizar PDF** y elige uno de los tipos disponibles para la especialidad del perfil y completa cliente, emisor, folio, fechas y moneda. Revisa la vista previa y pulsa **Guardar PDF**. Elige una carpeta y un nombre terminado en `.pdf`; después puedes adjuntar el archivo por el medio que prefieras. La aplicación no envía mensajes.

Servicios admite conceptos, cantidades, precios, descuento e impuesto configurables. Seguro usa la cobertura y prima proporcionadas; Hipoteca y Retiro presentan simulaciones con sus supuestos y limitaciones. También puedes preparar el PDF desde los simuladores y las propuestas de clientes. No se consultan tarifas externas ni se emiten pólizas u ofertas bancarias.

Cancelar el guardado conserva la vista previa. Si falla, elige otra carpeta o cierra el PDF abierto y reintenta. Los borradores no se guardan en la bóveda y se eliminan al bloquear. El PDF exportado contiene datos legibles: compártelo solo con el destinatario previsto. La exportación está disponible en el escritorio Windows, no en la vista web móvil.

Verificación del paquete, con datos aislados:

```powershell
node scripts/packaged-smoke.cjs
node scripts/quotation-smoke.cjs
```

El segundo control genera PDFs reales y sustituye únicamente la selección nativa del destino durante la prueba automatizada. Consulta `VERIFICACION-1.0.4.md` para la comprobación manual y sus límites.

## Respaldo y recuperación

Datos: directorio `userData` de Electron, por defecto `%APPDATA%\MONEYMAXING` (confirmado en este equipo). Se conserva el nombre de paquete/identificador de 1.0.0. Antes de actualizar, descarga un respaldo.

Archivo principal: `vault.enc.json`. Cada sustitución guarda la revisión cifrada anterior como `vault.enc.json.previous`; esta copia rota y no sustituye respaldos externos. Las escrituras usan archivo temporal, sincronización a disco, renombrado y revisiones para rechazar conflictos entre dispositivos.

**Restaurar respaldo** también está disponible en la pantalla inicial. Selecciona `.mmxvault` o `vault.enc.json`, introduce la contraseña de ese archivo y confirma. Se comprueba el descifrado y el formato antes de reemplazar datos. Abre después con la contraseña del respaldo. Se conserva la revisión previa en disco.

Si el archivo principal está corrupto: cierra la app, copia toda la carpeta de datos a un lugar seguro y conserva el archivo dañado con otro nombre. Copia una revisión conocida válida a `vault.enc.json`; no borres el original. `.previous` tiene el mismo formato. Abre y comprueba el contenido antes de registrar más datos.

El formato antiguo 1 se migra en memoria al modelo de perfiles. Las versiones desconocidas o datos inválidos se rechazan sin reemplazarlos. Un conflicto exige bloquear y volver a abrir para cargar la revisión actual. Los cambios rechazados vuelven al último estado confirmado; reintenta desde el formulario. Espera **Guardado** antes de cerrar.

## Desarrollo y pruebas

Requisitos: Windows x64, Node.js 24 y npm. Versiones fijadas en `package-lock.json`.

```powershell
npm ci
node node_modules/electron/install.js
npm run check
npm test
$env:MONEYMAXING_DATA_DIR = Join-Path $PWD '.test-data\desktop'
$env:MONEYMAXING_PORT = '4776'
npm start
```

La instalación explícita de Electron cubre gestores que bloquean scripts de dependencias. Usa el descargador oficial con sus checksums; no DLL sueltas. `check` verifica sintaxis; no hay TypeScript ni linter configurado. Para desarrollo web aislado: `node scripts/dev-server.cjs`. Nunca uses datos reales para las pruebas.

Pruebas UI, en una carpeta **vacía y distinta para cada ejecución**:

```powershell
$env:MONEYMAXING_DATA_DIR = Join-Path $PWD '.test-data\ui-ejecucion-nueva'
$env:MONEYMAXING_PORT = '4776'
npx electron . --remote-debugging-port=9226
# En otra terminal, con la ventana abierta, ejecutar en orden:
node scripts/ui-smoke.cjs
node scripts/ui-regression.cjs
```

Usan datos y contraseña de prueba. No habilites depuración remota con datos reales; ciérrala al terminar.

## Compilar Windows

```powershell
npm ci
node node_modules/electron/install.js
npm run dist:win -- --config.electronDist=node_modules/electron/dist
```

Se verifican sintaxis y pruebas antes de empaquetar. Salidas en `release`: `MONEYMAXING-Setup-1.0.4.exe` y `MONEYMAXING-1.0.4-Windows-x64.zip`. No se publican. El paquete contiene HTML, JS, CSS y servidor en `resources/app.asar`, además del runtime completo. No necesita Node, npm ni servidor de desarrollo para ejecutarse. Icono en `assets/icon.svg`/`.ico`. macOS no se compiló ni verificó para esta entrega.

## Servicios externos opcionales

El escritorio funciona sin Internet y sin credenciales externas. Tailscale requiere instalación y cuenta propia en PC/teléfono, HTTPS y dispositivos autorizados. No se configuró ni publicó acceso externo durante esta entrega.

Para acceso móvil, configura Tailscale Serve a `127.0.0.1:4765` con `scripts/enable-mobile-access.ps1`. Define `MONEYMAXING_PUBLIC_ORIGIN` con el origen HTTPS exacto mostrado por Tailscale y reinicia la app desde ese entorno. Sin este origen explícito se rechazan nombres externos. Ejemplo en `.env.example`; `.env` no se carga automáticamente. Apaga Serve con `tailscale serve off`.

PC y app deben seguir encendidas. Tailscale es la barrera de acceso de red: autoriza solo dispositivos de confianza. La contraseña cifra el contenido; no autentica por separado las peticiones HTTP de miembros de esa red. Un proceso local con permisos sobre los datos puede sustituir archivos. Conserva respaldos fuera de la PC.

## Límites de esta entrega

- Simulaciones con supuestos editables y aportaciones a fin de mes; no son ofertas ni rendimientos garantizados. La inflación descuenta poder adquisitivo. El retiro mensual supone 0.5% del fondo; no garantiza su duración.
- Las etiquetas fiscales describen lo registrado; no calculan declaraciones ni determinan deducibilidad. Se retiró el cálculo fiscal fijo y la multiplicación ficticia de cobertura por 1.5.
- El resumen principal muestra saldo, ingresos y gastos; se retiró de la vista el indicador heurístico para evitar una calificación financiera ambigua.
- Eliminar una cuenta pendiente no registra cobro/pago. Registra estos por separado como movimientos cuando ocurran.
- Hay exportación CSV y restauración cifrada; no hay importación CSV bancaria ni nube. Inmuebles/cuentas pendientes se corrigen reemplazando el registro; no tienen edición completa.
- `index.html`, `MONEYMAXING-PWA.html`, `service-worker.js` y `manifest.json` son antecedentes conservados, no se distribuyen ni se presentan como versiones verificadas.
- Revisión de código y dependencias con alcance documentado; no auditoría externa completa. Consulta `VERIFICACION-1.0.4.md` y el registro anterior `VERIFICACION.md` y `CHANGELOG.md`.
