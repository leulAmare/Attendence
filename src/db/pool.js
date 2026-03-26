const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Ensure UTF-8 encoding for proper Amharic character support
  client_encoding: 'UTF8'
});

// Set the connection to use UTF-8
pool.on('connect', (client) => {
  client.query('SET CLIENT_ENCODING TO UTF8');
});

module.exports = pool;
