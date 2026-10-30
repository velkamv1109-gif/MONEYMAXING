const path = require('node:path');
const { startServer } = require('../server.cjs');

const appDir = path.join(__dirname, '..');
const dataDir = process.env.MONEYMAXING_DATA_DIR || path.join(process.env.APPDATA, 'MONEYMAXING');

startServer({ appDir, dataDir, host: '127.0.0.1', port: 4765 }).then(service => {
  console.log(`MONEYMAXING test server: ${service.origin}`);
  const stop = () => service.close().finally(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}).catch(error => {
  console.error(error);
  process.exit(1);
});
