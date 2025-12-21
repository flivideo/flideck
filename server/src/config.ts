import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Config {
  presentationsRoot: string;
  history: string[];
}

const CONFIG_FILENAME = 'config.json';
const CONFIG_EXAMPLE_FILENAME = 'config.example.json';
const MAX_HISTORY_ENTRIES = 10;

/**
 * Get the project root directory (where config files live)
 */
function getProjectRoot(): string {
  // server/src -> server -> project root
  return path.resolve(__dirname, '../..');
}

/**
 * Get the path to config.json
 */
export function getConfigPath(): string {
  return path.join(getProjectRoot(), CONFIG_FILENAME);
}

/**
 * Get the path to config.example.json
 */
export function getExampleConfigPath(): string {
  return path.join(getProjectRoot(), CONFIG_EXAMPLE_FILENAME);
}

/**
 * Expand tilde (~) to user's home directory
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (filePath === '~') {
    return os.homedir();
  }
  // Resolve relative paths from project root
  if (!path.isAbsolute(filePath)) {
    return path.resolve(getProjectRoot(), filePath);
  }
  return filePath;
}

/**
 * Load configuration from config.json, falling back to config.example.json
 */
export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();
  const examplePath = getExampleConfigPath();

  let rawConfig: Config;

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    rawConfig = JSON.parse(content);
  } catch {
    // config.json doesn't exist or is invalid, fall back to example
    try {
      const content = await fs.readFile(examplePath, 'utf-8');
      rawConfig = JSON.parse(content);
      console.log('Using config.example.json (config.json not found)');
    } catch {
      // Neither file exists, use defaults
      console.warn('No config files found, using defaults');
      rawConfig = {
        presentationsRoot: './presentations',
        history: [],
      };
    }
  }

  // Validate and expand paths
  const config: Config = {
    presentationsRoot: expandPath(rawConfig.presentationsRoot || './presentations'),
    history: (rawConfig.history || []).map(expandPath),
  };

  return config;
}

/**
 * Save configuration to config.json
 */
export async function saveConfig(config: Config): Promise<void> {
  const configPath = getConfigPath();

  // Convert absolute paths back to tilde notation for readability
  const configToSave: Config = {
    presentationsRoot: collapsePath(config.presentationsRoot),
    history: config.history.map(collapsePath),
  };

  await fs.writeFile(configPath, JSON.stringify(configToSave, null, 2) + '\n', 'utf-8');
}

/**
 * Collapse home directory back to tilde for storage
 */
export function collapsePath(filePath: string): string {
  const home = os.homedir();
  if (filePath.startsWith(home + '/')) {
    return '~/' + filePath.slice(home.length + 1);
  }
  if (filePath === home) {
    return '~';
  }
  return filePath;
}

/**
 * Add a path to history (if not already present)
 * Returns updated config
 */
export async function addToHistory(config: Config, previousRoot: string): Promise<Config> {
  // Don't add if it's already the most recent entry
  if (config.history[0] === previousRoot) {
    return config;
  }

  // Remove if it exists elsewhere in history (we'll add it to front)
  const filtered = config.history.filter((h) => h !== previousRoot);

  // Add to front of history
  const newHistory = [previousRoot, ...filtered].slice(0, MAX_HISTORY_ENTRIES);

  const updatedConfig: Config = {
    ...config,
    history: newHistory,
  };

  await saveConfig(updatedConfig);
  return updatedConfig;
}
