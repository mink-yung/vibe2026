import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.join(__dirname, "..", "app.log");

function formatLine(level, message, meta) {
  const ts = new Date().toISOString();
  const extra =
    meta && Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  return `[${ts}] [${level}] ${message}${extra}\n`;
}

export function appLog(message, meta = {}) {
  const line = formatLine("INFO", message, meta);
  console.log(message, meta && Object.keys(meta).length ? meta : "");
  try {
    fs.appendFileSync(LOG_PATH, line, "utf8");
  } catch (err) {
    console.error("app.log write failed:", err.message);
  }
}

export function appLogError(message, meta = {}) {
  const line = formatLine("ERROR", message, meta);
  console.error(message, meta && Object.keys(meta).length ? meta : "");
  try {
    fs.appendFileSync(LOG_PATH, line, "utf8");
  } catch (err) {
    console.error("app.log write failed:", err.message);
  }
}
