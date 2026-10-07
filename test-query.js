require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT * FROM \"Dinesh-2007.appointments\" ORDER BY created_at DESC LIMIT 5")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => pool.end());
