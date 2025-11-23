import { monitoringService } from './monitoring-service.js';

console.log('🚀 Starting standalone monitoring service...');

// Start monitoring service
monitoringService.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📛 SIGTERM received, stopping monitoring service...');
  monitoringService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT received, stopping monitoring service...');
  monitoringService.stop();
  process.exit(0);
});

// Keep process running
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception in monitoring service:', error);
  monitoringService.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection in monitoring service:', reason);
});

console.log('✅ Monitoring service process started');
