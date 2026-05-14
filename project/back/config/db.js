import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

export async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("MariaDB 연결 성공");
    connection.release();
  } catch (error) {
    console.error("MariaDB 연결 실패:", error.message);
  }
}