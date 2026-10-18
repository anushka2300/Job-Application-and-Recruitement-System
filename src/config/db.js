const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const sslCaPath = process.env.DB_SSL_CA;
const ssl = sslCaPath
  ? {
      ca: fs.readFileSync(path.resolve(sslCaPath), "utf8"),
    }
  : undefined;// Create a connection pool to the MySQL database
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),
    ssl: ssl,
});

module.exports = pool;