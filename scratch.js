require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: 'meridian',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  ssl: process.env.SSL === 'true',
});

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log("Tables:", res.rows.map(r => r.table_name));
    
    for (const tableName of ['ward_master', 'room_type_master', 'room_master', 'bed_master', 'room_purpose_master']) {
      try {
        const rows = await client.query(`SELECT * FROM "${tableName}" LIMIT 5`);
        console.log(`\n--- ${tableName} --- (${rows.rows.length} rows)`);
        console.log(rows.rows);
      } catch (err) {
        console.log(`\n--- ${tableName} --- Error: ${err.message}`);
      }
    }
  } finally {
    client.release();
    pool.end();
  }
}

main().catch(console.error);
