import { Sequelize } from "sequelize";

export const sequelize = new Sequelize("daliaudit_db", "root", "", {
  host: "localhost",
  port: 3306,
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
