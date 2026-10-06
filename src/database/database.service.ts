import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import pgvector from 'pgvector/pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.get('DATABASE_HOST'),
      port: this.configService.get('DATABASE_PORT'),
      user: this.configService.get('DATABASE_USER'),
      password: this.configService.get('DATABASE_PASSWORD'),
      database: this.configService.get('DATABASE_NAME'),
    });
  }

  async onModuleInit() {
    // Register pgvector type for this pool
    this.pool.on('connect', async (client) => {
      await pgvector.registerType(client);
    });

    // Enable pgvector extension (idempotent)
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    // Create the documents table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id BIGSERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding VECTOR(1536)
      )
    `);

    // Create HNSW index for fast approximate nearest neighbor search
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS documents_embedding_idx 
      ON documents 
      USING hnsw (embedding vector_cosine_ops)
    `);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  getPool(): Pool {
    return this.pool;
  }
}