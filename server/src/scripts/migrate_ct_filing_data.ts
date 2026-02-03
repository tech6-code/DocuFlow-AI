
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'docuflow_ai',
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log('Adding filing_data column to ct_filing_period...');
        await connection.query('ALTER TABLE ct_filing_period ADD COLUMN filing_data JSON AFTER status');
        console.log('Migration successful.');
    } catch (err: any) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column filing_data already exists.');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        await connection.end();
    }
}

migrate();
