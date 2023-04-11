require('dotenv').config();
const pg = require("pg");

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  // Test database connection
  pool.query("SELECT * FROM users", (err, res) => {
    if (err) {
      console.error("Error executing query", err);
    } else {
      console.log("Database connection successful");
    }
  });

  module.exports = pool;