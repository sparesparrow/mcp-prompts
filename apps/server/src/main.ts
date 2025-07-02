import { startHttpServer } from './http-server';

startHttpServer().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
