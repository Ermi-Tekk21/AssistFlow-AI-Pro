import dotenv from "dotenv";

dotenv.config();

// If DATABASE_URL is not set, validate individual DB connection parameters
if (!process.env.DATABASE_URL) {
  const requiredVariables = [
    "DB_HOST",
    "DB_USERNAME",
    "DB_PASSWORD",
    "DB_DATABASE",
  ];

  for (const variable of requiredVariables) {
    if (!process.env[variable]) {
      throw new Error(`Missing required environment variable: ${variable}`);
    }
  }
}
