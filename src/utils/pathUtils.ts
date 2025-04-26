import * as path from 'path';
import { promises as fs } from 'fs';

/**
 * Resolves a relative path to an absolute path based on the current working directory
 * If the path is already absolute, returns it unchanged
 */
export const resolvePath = (relativePath: string): string => {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return path.resolve(process.cwd(), relativePath);
};

/**
 * Ensures a directory exists, creating it if necessary
 */
export const ensureDirectory = async (dirPath: string): Promise<void> => {
  const absolutePath = resolvePath(dirPath);
  try {
    await fs.mkdir(absolutePath, { recursive: true });
  } catch (err) {
    // Ignore if directory already exists
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw err;
    }
  }
};

/**
 * Returns the absolute path for the parent directory of the current working directory
 * This is useful for accessing directories outside the webapp
 */
export const getParentDirectory = (): string => {
  return path.resolve(process.cwd(), '..');
};

/**
 * Resolves a path relative to the parent directory
 * This is useful for handling paths from user uploads that might be outside the webapp
 */
export const resolvePathFromParent = (relativePath: string): string => {
  // Replace forward slashes with the OS-specific path separator
  const normalizedPath = relativePath.split('/').join(path.sep);
  return path.resolve(getParentDirectory(), normalizedPath);
};

/**
 * Attempts to resolve a path in multiple ways, checking if each exists
 * Returns the first valid path found, or null if none exist
 */
export const findValidPath = async (pathOptions: string[]): Promise<string | null> => {
  for (const p of pathOptions) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // Path doesn't exist or isn't accessible, try the next one
      continue;
    }
  }
  return null;
};
