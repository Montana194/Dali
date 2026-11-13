import dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";

const dialect = process.env.DB_DIALECT || "mysql";
const dbName = process.env.DB_NAME || "daliaudit_db";
const dbUser = process.env.DB_USER || "root";
const dbPass = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "";
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = parseInt(process.env.DB_PORT, 10) || 3306;

export const sequelize = dialect === "sqlite"
  ? new Sequelize({
      dialect: "sqlite",
      storage: process.env.DB_STORAGE || "./daliaudit_test.sqlite",
      logging: false
    })
  : new Sequelize(dbName, dbUser, dbPass, {
      host: dbHost,
      port: dbPort,
      dialect: "mysql",
      logging: false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });

export default sequelize;
