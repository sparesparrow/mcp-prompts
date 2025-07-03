import { startHttpServer } from './http-server.js';

startHttpServer().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
