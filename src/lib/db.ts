/**
 * Database Client - Connection to Postgres
 * Uses the pg package for direct database connection
 */

import { Pool, PoolClient, QueryResult } from 'pg';

// Create connection pool using environment variables
const getConnectionString = (): string => {
    // Prefer DATABASE_URL, fallback to POSTGRES_URL
    return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
};

// Singleton pool instance
let pool: Pool | null = null;

function getPool(): Pool {
    if (!pool) {
        const connectionString = getConnectionString();

        if (!connectionString) {
            throw new Error('No database connection string found. Set DATABASE_URL or POSTGRES_URL.');
        }

        pool = new Pool({
            connectionString,
            ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });

        // Handle pool errors
        pool.on('error', (err) => {
            console.error('Unexpected database pool error:', err);
        });
    }
    return pool;
}

/**
 * Execute a SQL query
 */
export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const pool = getPool();
    const start = Date.now();
    try {
        const result = await pool.query<T>(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development') {
            console.log('Executed query', { text: text.slice(0, 50), duration, rows: result.rowCount });
        }
        return result;
    } catch (error: any) {
        console.error('Database query error:', error.message);
        throw error;
    }
}

/**
 * Execute a query and return rows
 */
export async function queryRows<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await query<T>(text, params);
    return result.rows;
}

/**
 * Execute a query and return first row
 */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const result = await query<T>(text, params);
    return result.rows[0] || null;
}

/**
 * Get a client for transaction management
 */
export async function getClient(): Promise<PoolClient> {
    const pool = getPool();
    return pool.connect();
}

/**
 * Check if database is connected
 */
export async function isConnected(): Promise<boolean> {
    try {
        await query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

/**
 * Close the pool (for cleanup)
 */
export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

// Export types
export type { Pool, PoolClient, QueryResult };
