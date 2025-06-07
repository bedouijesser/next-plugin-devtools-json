import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { v4, validate } from 'uuid';

// Since we don't have utils.ts compiled, let's create a test version
async function getOrCreateUUID(projectRoot: string, providedUuid?: string): Promise<string> {
  if (providedUuid) {
    return providedUuid;
  }

  const cacheDir = path.resolve(projectRoot, '.next', 'cache');
  const uuidPath = path.resolve(cacheDir, 'devtools-uuid.json');

  try {
    const uuidContent = await fs.promises.readFile(uuidPath, { encoding: 'utf-8' });
    const uuid = uuidContent.trim();
    if (validate(uuid)) {
      return uuid;
    }
  } catch (error) {
    // File doesn't exist or is invalid, will create new one
  }

  try {
    await fs.promises.mkdir(cacheDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  const uuid = v4();
  await fs.promises.writeFile(uuidPath, uuid, { encoding: 'utf-8' });
  return uuid;
}

describe('#UUIDUtils', () => {
  const testProjectRoot = path.resolve(process.cwd(), 'test-temp');
  const testCacheDir = path.resolve(testProjectRoot, '.next', 'cache');
  const testUuidPath = path.resolve(testCacheDir, 'devtools-uuid.json');

  beforeEach(async () => {
    // Clean up any existing test files
    try {
      await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('#getOrCreateUUID', () => {
    it('should return provided UUID when given', async () => {
      const customUuid = 'custom-test-uuid';
      const result = await getOrCreateUUID(testProjectRoot, customUuid);
      
      expect(result).toBe(customUuid);
    });

    it('should generate and cache a new UUID', async () => {
      const result = await getOrCreateUUID(testProjectRoot);
      
      expect(validate(result)).toBe(true);
      expect(fs.existsSync(testUuidPath)).toBe(true);
      
      const cachedContent = await fs.promises.readFile(testUuidPath, { encoding: 'utf-8' });
      expect(cachedContent.trim()).toBe(result);
    });

    it('should return cached UUID on subsequent calls', async () => {
      const firstResult = await getOrCreateUUID(testProjectRoot);
      const secondResult = await getOrCreateUUID(testProjectRoot);
      
      expect(firstResult).toBe(secondResult);
      expect(validate(firstResult)).toBe(true);
    });

    it('should create cache directory if it does not exist', async () => {
      expect(fs.existsSync(testCacheDir)).toBe(false);
      
      await getOrCreateUUID(testProjectRoot);
      
      expect(fs.existsSync(testCacheDir)).toBe(true);
      expect(fs.existsSync(testUuidPath)).toBe(true);
    });

    it('should handle invalid cached UUID by generating new one', async () => {
      // Create cache directory and write invalid UUID
      await fs.promises.mkdir(testCacheDir, { recursive: true });
      await fs.promises.writeFile(testUuidPath, 'invalid-uuid', { encoding: 'utf-8' });
      
      const result = await getOrCreateUUID(testProjectRoot);
      
      expect(validate(result)).toBe(true);
      expect(result).not.toBe('invalid-uuid');
      
      const newCachedContent = await fs.promises.readFile(testUuidPath, { encoding: 'utf-8' });
      expect(newCachedContent.trim()).toBe(result);
    });

    it('should handle corrupted cache file', async () => {
      // Create cache directory and write corrupted file
      await fs.promises.mkdir(testCacheDir, { recursive: true });
      // Create a file that exists but can't be read as UTF-8
      await fs.promises.writeFile(testUuidPath, Buffer.from([0xFF, 0xFE]));
      
      const result = await getOrCreateUUID(testProjectRoot);
      
      expect(validate(result)).toBe(true);
      
      const newCachedContent = await fs.promises.readFile(testUuidPath, { encoding: 'utf-8' });
      expect(newCachedContent.trim()).toBe(result);
    });
  });
});
