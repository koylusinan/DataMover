import { startCleanupService } from './pipeline-cleanup-service.js';

console.log('🚀 Starting standalone pipeline cleanup service...');

// Start cleanup service
startCleanupService();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📛 SIGTERM received, stopping cleanup service...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT received, stopping cleanup service...');
  process.exit(0);
});

// Keep process running
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception in cleanup service:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection in cleanup service:', reason);
});

console.log('✅ Pipeline cleanup service process started');
