import { Sequelize, type Options } from 'sequelize';
import { config } from '../config/index.js';
import { logger } from '../common/logger/index.js';

// The one Sequelize instance. Lives in its own module so model files can
// import it without a circular dependency on db/index.ts.
const { database } = config;

const options: Options = {
  dialect: 'mysql',
  host: database.host,
  port: database.port,
  pool: database.pool,
  // DECIMAL columns come back as strings on purpose: money never passes
  // through a JS float. Use common/utils/money.ts for arithmetic.
  dialectOptions: { decimalNumbers: false },
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    underscored: true,
    timestamps: true,
  },
  logging:
    config.env === 'development' ? (sql: string) => logger.debug(sql) : false,
};

export const sequelize = new Sequelize(
  database.name,
  database.username,
  database.password,
  options,
);
