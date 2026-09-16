import { config } from '../config/index.js';
import { logger } from '../common/logger/index.js';
import { sequelize } from './sequelize.js';
// Each model initialises itself on import and declares its relations in a
// static associate(); associate() runs here once every class is loaded.
// models:imports (managed by `npm run mg:newscaff` — keep markers intact)
import { Example } from './models/example.model.js';
import { User } from './models/user.model.js';
// models:imports:end

// models:list (managed by `npm run mg:newscaff` — keep markers intact)
const models = [Example, User];
// models:list:end

for (const model of models) model.associate?.();

export { sequelize, Example, User };

// Verifies connectivity at boot — fails fast if the DB is unreachable.
export async function initializeDatabase(): Promise<void> {
  await sequelize.authenticate();
  const { database } = config;
  logger.info(
    `Database connected (${database.host}:${database.port}/${database.name})`,
  );
}

export async function closeDatabase(): Promise<void> {
  logger.info('Closing database connections...');
  await sequelize.close();
}
