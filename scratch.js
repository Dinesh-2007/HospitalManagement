require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res1 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'doctor_consultation_entry';
    `);
    console.log("doctor_consultation_entry columns:");
    console.log(res1.rows);

    const res2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'appointments';
    `);
    console.log("\nappointments columns:");
    console.log(res2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
