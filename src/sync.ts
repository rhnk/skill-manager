import ora from 'ora';
import chalk from 'chalk';
import { Config, FetchResult, SkillConfig } from './types';
import { validateSkillConfig } from './config';
import { FetcherFactory } from './fetcher-factory';
import { isSkillManagerError } from './errors';
import { sanitizeSkillName } from './validation';
import { shouldSkipSync } from './skip-checker';
import { promptForOverwrite } from './interaction';

/**
 * Sync all skills from configuration
 * Uses factory pattern for fetcher selection (Open/Closed Principle)
 * @param config Application configuration
 * @param dryRun If true, show what would be synced without making changes
 * @param forceSkills Optional array of skill names to force sync (overrides skip check)
 * @returns Array of fetch results
 */
export async function syncSkills(
  config: Config,
  dryRun: boolean = false,
  forceSkills?: string[]
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  console.log(chalk.bold('\nSyncing skills...\n'));

  for (const skillEntry of config.skills) {
    const rawSkillName = Object.keys(skillEntry)[0];
    const skillConfig: SkillConfig = skillEntry[rawSkillName];

    // Sanitize skill name for security
    let skillName: string;
    try {
      skillName = sanitizeSkillName(rawSkillName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Invalid skill name "${rawSkillName}": ${errorMessage}`));
      results.push({ skillName: rawSkillName, success: false, error: errorMessage });
      continue;
    }

    const spinner = ora(`Syncing ${chalk.cyan(skillName)}`).start();

    try {
      // Validate skill config
      validateSkillConfig(skillName, skillConfig);

      if (dryRun) {
        spinner.succeed(
          `${chalk.cyan(skillName)} - Would sync from ${skillConfig.remote} (${skillConfig.type})`
        );
        results.push({ skillName, success: true });
        continue;
      }

      // Check if we should force this skill
      const shouldForce = forceSkills && forceSkills.length > 0 && forceSkills.includes(skillName);

      // Check if sync can be skipped (unless forced)
      if (!shouldForce) {
        const skipCheck = await shouldSkipSync(skillName, skillConfig, config.skillsPath);

        if (skipCheck.shouldSkip) {
          spinner.info(
            `${chalk.cyan(skillName)} - ${chalk.yellow('Skipped')}: ${skipCheck.reason}`
          );
          results.push({ skillName, success: true, skipped: true, reason: skipCheck.reason });
          continue;
        }

        // Handle local modifications
        if (skipCheck.needsInteraction) {
          spinner.stop();
          const shouldOverwrite = await promptForOverwrite(skillName);
          if (!shouldOverwrite) {
            spinner.info(
              `${chalk.cyan(skillName)} - ${chalk.yellow('Skipped')}: ${skipCheck.reason}`
            );
            results.push({ skillName, success: true, skipped: true, reason: skipCheck.reason });
            continue;
          }
          spinner.start(`Syncing ${chalk.cyan(skillName)}`);
        }
      }

      // Get fetcher from factory (Open/Closed Principle - extensible without modification)
      const fetcher = FetcherFactory.getFetcher(skillConfig.type);

      // Fetch the skill
      await fetcher.fetch(skillName, skillConfig, config.skillsPath);

      spinner.succeed(`${chalk.cyan(skillName)} - ${chalk.green('Synced successfully')}`);
      results.push({ skillName, success: true });
    } catch (error) {
      const errorMessage = isSkillManagerError(error)
        ? error.getDetailedMessage()
        : error instanceof Error
          ? error.message
          : String(error);
      spinner.fail(`${chalk.cyan(skillName)} - ${chalk.red('Failed')}: ${errorMessage}`);
      results.push({ skillName, success: false, error: errorMessage });
    }
  }

  return results;
}

/**
 * Print summary of sync results
 * @param results Array of fetch results
 */
export function printSummary(results: FetchResult[]): void {
  console.log('\n' + chalk.bold('Summary:'));

  const successful = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`${chalk.green('✓')} Successful: ${successful}`);
  if (skipped > 0) {
    console.log(`${chalk.yellow('⊘')} Skipped: ${skipped}`);
  }
  if (failed > 0) {
    console.log(`${chalk.red('✗')} Failed: ${failed}`);
  }

  console.log('');
}
