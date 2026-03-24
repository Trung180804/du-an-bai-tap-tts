import Redis from "ioredis";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class RedisService implements OnModuleInit{
  private redisClient: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
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
