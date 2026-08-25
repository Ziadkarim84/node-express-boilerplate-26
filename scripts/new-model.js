#!/usr/bin/env node
// Scaffolds a model: migration pair + typed model class + registration in
// src/db/index.ts. Usage: npm run mg:newscaff modelName=OrderItem [tableName=x]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2).reduce((acc, s) => {
  const [key, val] = s.split('=');
  acc[key] = val;
  return acc;
}, {});

const helpText = `ℹ️  Scaffold a new model with:
  npm run mg:newscaff modelName=SomeModelName [tableName=some_table_name]`;

const { modelName } = args;

if (!modelName || !/^[A-Z][A-Za-z0-9]*$/.test(modelName)) {
  console.error(
    `⚠️  Error: modelName must be PascalCase (e.g. OrderItem)\n${helpText}`,
  );
  process.exit(1);
}

const snakeCase = (str) =>
  str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const kebabCase = (str) =>
  str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const tableName = args.tableName ?? `${snakeCase(modelName)}s`;
const modelFileName = `${kebabCase(modelName)}.model.ts`;
const modelFilePath = path.join('src', 'db', 'models', modelFileName);
const dbIndexPath = path.join('src', 'db', 'index.ts');

if (fs.existsSync(modelFilePath)) {
  console.error(`⚠️  Error: ${modelFilePath} already exists`);
  process.exit(1);
}

/* 1 ─ migration pair */
const version = Date.now();
const migrationsDir = path.resolve('schema-migrations');
const migrationTitle = `create-table-${tableName}`;

const doSql = `CREATE TABLE \`${tableName}\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- TODO: add columns here
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
`;

const undoSql = `DROP TABLE IF EXISTS \`${tableName}\`;\n`;

const doFile = path.join(migrationsDir, `${version}.do.${migrationTitle}.sql`);
const undoFile = path.join(
  migrationsDir,
  `${version}.undo.${migrationTitle}.sql`,
);
fs.writeFileSync(doFile, doSql);
fs.writeFileSync(undoFile, undoSql);
console.log(`📁 Migration: ${doFile}`);
console.log(`📁 Migration: ${undoFile}`);

/* 2 ─ model file */
const modelContent = `import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class ${modelName} extends Model<
  InferAttributes<${modelName}>,
  InferCreationAttributes<${modelName}>
> {
  declare id: CreationOptional<number>;
  // TODO: declare your columns here, e.g.:
  // declare name: string;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;
}

export function init${modelName}Model(sequelize: Sequelize): typeof ${modelName} {
  ${modelName}.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      // TODO: define your columns here, e.g.:
      // name: { type: DataTypes.STRING(100), allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: '${tableName}',
    },
  );

  return ${modelName};
}
`;

fs.writeFileSync(modelFilePath, modelContent);
console.log(`📁 Model:     ${modelFilePath}`);

/* 3 ─ register in src/db/index.ts via the marker comments */
let dbIndex = fs.readFileSync(dbIndexPath, 'utf8');

const insertions = [
  {
    marker: '// models:imports:end',
    line: `import { init${modelName}Model, ${modelName} } from './models/${kebabCase(modelName)}.model.js';`,
  },
  { marker: '// models:init:end', line: `init${modelName}Model(sequelize);` },
  { marker: '// models:exports:end', line: `export { ${modelName} };` },
];

for (const { marker, line } of insertions) {
  if (!dbIndex.includes(marker)) {
    console.error(
      `⚠️  Marker "${marker}" not found in ${dbIndexPath} — register the model manually.`,
    );
    process.exit(1);
  }
  dbIndex = dbIndex.replace(marker, `${line}\n${marker}`);
}

fs.writeFileSync(dbIndexPath, dbIndex);
console.log(`📁 Registered in ${dbIndexPath}`);

console.log(`
🎉 Done! Next steps:
  1. Add your columns to ${doFile}
  2. Mirror them in ${modelFilePath}
  3. npm run mg:latest`);
