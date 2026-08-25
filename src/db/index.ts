import { Sequelize, type Options } from 'sequelize';
import { config } from '../config/index.js';
import { logger } from '../common/logger/index.js';
// models:imports (managed by `npm run mg:newscaff` — keep markers intact)
import { initExampleModel, Example } from './models/example.model.js';
// models:imports:end

const { database } = config;

const options: Options = {
  dialect: 'mysql',
  host: database.host,
  port: database.port,
  pool: database.pool,
  dialectOptions: { decimalNumbers: true },
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

/* Initialize all models, then wire associations. */
// models:init (managed by `npm run mg:newscaff` — keep markers intact)
initExampleModel(sequelize);
// models:init:end

// models:exports (managed by `npm run mg:newscaff` — keep markers intact)
export { Example };
// models:exports:end

// Wire associations here, e.g. User.hasMany(Post); Post.belongsTo(User);

// Verifies connectivity at boot — fails fast if the DB is unreachable.
export async function initializeDatabase(): Promise<void> {
  await sequelize.authenticate();
  logger.info(
    `Database connected (${database.host}:${database.port}/${database.name})`,
  );
}

export async function closeDatabase(): Promise<void> {
  logger.info('Closing database connections...');
  await sequelize.close();
}
