import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFile } from 'fs/promises';

import { AppModule } from '../app.module';
import { ImportBundleDto } from '../modules/admin/dto/import.dto';
import { ImportService } from '../modules/admin/import.service';

/**
 * Usage: node dist/cli/import-content.js <bundle.json> [--apply]
 * Without --apply it is a dry run that prints what would change.
 */
async function main(): Promise<void> {
  const [file, ...flags] = process.argv.slice(2);

  if (!file) {
    throw new Error('Usage: import-content <bundle.json> [--apply]');
  }

  const bundle = plainToInstance(ImportBundleDto, JSON.parse(await readFile(file, 'utf8')));
  const problems = await validate(bundle, { whitelist: true, forbidNonWhitelisted: true });

  if (problems.length) {
    console.error(JSON.stringify(problems.map((problem) => problem.toString()), null, 2));
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const report = await app
      .get(ImportService)
      .importBundle(bundle, { dryRun: !flags.includes('--apply'), actorId: null });

    for (const row of report.rows) {
      const detail = row.errors?.join('; ') ?? row.changes?.join(', ') ?? '';
      console.log(`${row.action.padEnd(9)} ${row.entity.padEnd(11)} ${row.key}${detail ? `  — ${detail}` : ''}`);
    }

    console.log(
      report.applied
        ? '\nApplied.'
        : report.dryRun
          ? '\nDry run only. Re-run with --apply to write these changes.'
          : '\nNothing was written because some rows have errors.'
    );
    process.exitCode = report.rows.some((row) => row.action === 'error') ? 1 : 0;
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  new Logger('import-content').error(error.message);
  process.exitCode = 1;
});
