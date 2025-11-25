import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis client singleton
let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
export async function initRedis() {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis: Max reconnection attempts reached');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('🔄 Redis: Connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis: Connected and ready');
      isConnected = true;
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis: Reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Redis: Failed to initialize:', error.message);
    redisClient = null;
    return null;
  }
}

/**
 * Get Redis client (returns null if not connected)
 */
export function getRedisClient() {
  return isConnected ? redisClient : null;
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected() {
  return isConnected && redisClient !== null;
}

/**
 * Cache helper: Get cached value
 */
export async function getCached(key) {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`❌ Redis GET error for key ${key}:`, error.message);
    return null;
  }
}

/**
 * Cache helper: Set cached value with TTL
 */
export async function setCached(key, value, ttlSeconds = 30) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`❌ Redis SET error for key ${key}:`, error.message);
    return false;
  }
}

/**
 * Cache helper: Delete cached value
 */
export async function deleteCached(key) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error(`❌ Redis DEL error for key ${key}:`, error.message);
    return false;
  }
}

/**
 * Cache helper: Add to time-series (sorted set)
 */
export async function addToTimeSeries(key, timestamp, value, maxItems = 1000) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    // Add new value
    await redisClient.zAdd(key, { score: timestamp, value: JSON.stringify(value) });

    // Keep only last N items (trim old data)
    const count = await redisClient.zCard(key);
    if (count > maxItems) {
      const removeCount = count - maxItems;
      await redisClient.zPopMin(key, removeCount);
    }

    return true;
  } catch (error) {
    console.error(`❌ Redis ZADD error for key ${key}:`, error.message);
    return false;
  }
}

/**
 * Cache helper: Get time-series range
 */
export async function getTimeSeriesRange(key, startTime, endTime) {
  if (!isRedisConnected()) {
    return [];
  }

  try {
    const results = await redisClient.zRangeByScore(key, startTime, endTime);
    return results.map(item => JSON.parse(item));
  } catch (error) {
    console.error(`❌ Redis ZRANGEBYSCORE error for key ${key}:`, error.message);
    return [];
  }
}

/**
 * Cache helper: Get latest N time-series items
 */
export async function getLatestTimeSeries(key, count = 100) {
  if (!isRedisConnected()) {
    return [];
  }

  try {
    const results = await redisClient.zRange(key, -count, -1);
    return results.map(item => JSON.parse(item));
  } catch (error) {
    console.error(`❌ Redis ZRANGE error for key ${key}:`, error.message);
    return [];
  }
}

/**
 * Graceful shutdown
 */
export async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis: Connection closed');
    } catch (error) {
      console.error('❌ Redis: Error closing connection:', error.message);
    }
    redisClient = null;
    isConnected = false;
  }
}

// Handle process termination
process.on('SIGINT', closeRedis);
process.on('SIGTERM', closeRedis);
