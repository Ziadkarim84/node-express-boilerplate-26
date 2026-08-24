#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';

const migrationsDir = path.resolve('schema-migrations');

if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir);
}

async function generateNewSchemaMigrationFiles() {
  const version = Date.now();

  const args = process.argv.slice(2).reduce((acc, s) => {
    const [key, val] = s.split('=');
    acc[key] = val;
    return acc;
  }, {});

  let inputTitle;
  if (args.newTable) {
    inputTitle = `create table ${args.newTable}`;
  } else {
    const input = await prompts([
      {
        type: 'text',
        name: 'title',
        message: 'What is the purpose of this schema migration:\n',
      },
    ]);
    inputTitle = input.title;
  }

  if (!inputTitle) {
    console.error('Aborted: no migration title given.');
    process.exit(1);
  }

  const title = inputTitle.replace(/[^\w\d-_]/g, '-');

  for (const type of ['do', 'undo']) {
    const filepath = path.join(
      migrationsDir,
      `${version}.${type}.${title}.sql`,
    );
    fs.writeFileSync(filepath, '');
    console.log(`${type.toUpperCase().padStart(4, ' ')}: ${filepath}`);
  }
}

generateNewSchemaMigrationFiles().catch((err) => {
  console.error(err);
  process.exit(1);
});
