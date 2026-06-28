import pg from 'pg';

const { Client } = pg;

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // why: enforce TLS only when SSL=true (Neon/PG may warn: "connection is insecure (try using sslmode=require)")
  ssl: process.env.SSL === "true" ? { rejectUnauthorized: false } : false,
});
console.log("db.js loaded");
client.connect()
  .then(() => console.log('Database Connected'))
  .catch(err => console.log(err));

export default client;

