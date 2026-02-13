import { Redis } from 'ioredis';

// Redis client singleton
let redis: Redis | undefined;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redis.on('error', (err: Error) => {
      console.error('Redis connection error:', err);
    });

    redis.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  return redis;
}

// Helper function to gracefully disconnect
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
  }
}

// Common cache operations
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  },

  async del(key: string): Promise<void> {
    const client = getRedisClient();
    await client.del(key);
  },

  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  },

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const client = getRedisClient();
    await client.expire(key, ttlSeconds);
  },

  async increment(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.incr(key);
  },

  async decrement(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.decr(key);
  },
};
