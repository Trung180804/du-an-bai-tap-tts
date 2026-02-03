import Redis from "ioredis";
import { Injectable, OnModuleInit } from "@nestjs/common";

@Injectable()
export class RedisService implements OnModuleInit{
  private redisClient: Redis;
  onModuleInit() {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: 6379,
    });
  }
  async setCache(key: string, value: any, ttl: number = 3600) {
    await this.redisClient.set(key, JSON.stringify(value), 'EX', ttl);
  }
  async getCache(key: string) {
    const data = await this.redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delCache(key: string){
    await this.redisClient.del(key);
  }
}
