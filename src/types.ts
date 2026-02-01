export type SkillType = 'GIT_FILE' | 'GIT_FOLDER' | 'GIT_REPO' | 'GIST';

export interface SkillConfig {
  type: SkillType;
  remote: string;
  ref?: string;
  filename?: string; // For GIST type: specific file to fetch from multi-file gists
}

export interface Config {
  skillsPath: string; // Now non-optional - always set by loadConfig
  skills: Array<{
    [skillName: string]: SkillConfig;
  }>;
}

export interface ParsedGitUrl {
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
  type: 'github' | 'gitlab' | 'bitbucket' | 'generic';
}

export interface FetchResult {
  skillName: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Metadata stored for each skill to track sync state
 */
export interface SkillMetadata {
  remote: string;
  ref?: string;
  type: SkillType;
  lastSync: string; // ISO timestamp
  contentHash: string; // SHA-256 hash of directory contents
}

/**
 * Result of skip check decision
 */
export interface SkipCheckResult {
  shouldSkip: boolean;
  reason?: string;
  needsInteraction?: boolean;
}

/**
 * Base interface for all fetchers - ensures consistent interface
 */
export interface IFetcher {
  fetch(skillName: string, config: SkillConfig, skillsPath: string): Promise<void>;
}
