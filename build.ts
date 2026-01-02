import { exec } from 'child_process';
import fs from 'fs-extra';
import { promisify } from 'util';
import { logger } from './src/utils';

const execAsync = promisify(exec);

async function remove(path: string): Promise<void> {
  try {
    logger.info(`Removing "${path}"`);
    await fs.remove(path);
  } catch (err) {
    logger.error('Error removing files');
    throw err;
  }
}

async function copy(src: string, dest: string): Promise<void> {
  try {
    logger.info(`Copying "${src}" to "${dest}"`);
    await fs.copy(src, dest);
  } catch (err) {
    logger.error('Error copying files');
    throw err;
  }
}

async function executeCommand(command: string, path: string) {
  try {
    logger.info(`Executing "${command}" on working directory "${path}"`);
    const { stdout, stderr } = await execAsync(command, { cwd: path });
    if (stdout) {
      logger.info(stdout);
    }
    if (stderr) {
      logger.warn(stderr);
    }
  } catch (err) {
    logger.error(`Error executing command`);
    throw err;
  }
}

(async () => {
  try {
    // Remove current build
    await remove('./dist/');

    // Compile project first (creates dist folder structure)
    await executeCommand('tsc --project ./', './');
    logger.info('✔️ TypeScript compiled successfully!');

    // Copy config files after compilation
    await copy('./src/config/errors/error.yml', './dist/src/config/errors/error.yml');
    await copy('./src/static/password-recovery-email.html', './dist/src/static/password-recovery-email.html');
    await copy('./src/static/clase', './dist/src/static/clase');
    await copy('./package.json', './dist/package.json');

    logger.info('✔️ Build completed successfully!');
  } catch (err) {
    logger.error('Build failed:', err);
    process.exit(1);
  }
})();
