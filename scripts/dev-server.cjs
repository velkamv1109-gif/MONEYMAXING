const path = require('node:path');
const { startServer } = require('../server.cjs');

const appDir = path.join(__dirname, '..');
const dataDir = process.env.MONEYMAXING_DATA_DIR || path.join(appDir, '.test-data', 'development');

startServer({ appDir, dataDir, host: '127.0.0.1', port: Number(process.env.MONEYMAXING_PORT || 4765), publicOrigin: process.env.MONEYMAXING_PUBLIC_ORIGIN || '' }).then(service => {
  console.log(`MONEYMAXING test server: ${service.origin}`);
  const stop = () => service.close().finally(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}).catch(error => {
  console.error(error);
  process.exit(1);
});
