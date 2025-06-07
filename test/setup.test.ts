import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('#SetupCLI', () => {
  const testProjectRoot = path.resolve(process.cwd(), 'test-cli-temp');
  const setupScript = path.resolve(process.cwd(), 'bin', 'setup.js');

  beforeEach(async () => {
    // Clean up any existing test files
    try {
      await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    
    // Create test project directory
    await fs.promises.mkdir(testProjectRoot, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('#detectNextJsStructure', () => {
    it('should detect Pages Router structure', async () => {
      const pagesDir = path.join(testProjectRoot, 'pages');
      await fs.promises.mkdir(pagesDir, { recursive: true });
      
      // Mock the setup script execution in the test directory
      const { stdout } = await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(stdout).toContain('pages/api/devtools-json.js');
      
      const apiFile = path.join(testProjectRoot, 'pages', 'api', 'devtools-json.js');
      expect(fs.existsSync(apiFile)).toBe(true);
      
      const content = await fs.promises.readFile(apiFile, 'utf-8');
      expect(content).toContain('export default async function handler');
      expect(content).toContain('getOrCreateUUID');
    });

    it('should detect App Router structure', async () => {
      const appDir = path.join(testProjectRoot, 'app');
      await fs.promises.mkdir(appDir, { recursive: true });
      
      const { stdout } = await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(stdout).toContain('app/api/devtools-json/route.js');
      
      const apiFile = path.join(testProjectRoot, 'app', 'api', 'devtools-json', 'route.js');
      expect(fs.existsSync(apiFile)).toBe(true);
      
      const content = await fs.promises.readFile(apiFile, 'utf-8');
      expect(content).toContain('export async function GET');
      expect(content).toContain('NextResponse.json');
    });

    it('should handle missing Next.js structure', async () => {
      // Ensure the test directory is completely empty
      await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
      await fs.promises.mkdir(testProjectRoot, { recursive: true });
      
      try {
        const result = await execAsync(`cd "${testProjectRoot}" && node "${setupScript}" 2>&1`, {
          env: { ...process.env, NODE_ENV: 'test' }
        });
        console.log('Command succeeded unexpectedly:', result.stdout);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        console.log('Error output:', error.stdout, 'stderr:', error.stderr);
        expect(error.code).toBe(1);
        // Check both stdout and stderr since we're capturing both
        const output = (error.stdout || '') + (error.stderr || '');
        expect(output).toContain('Could not detect Next.js structure');
      }
    });

    it('should not overwrite existing API routes', async () => {
      const pagesDir = path.join(testProjectRoot, 'pages', 'api');
      await fs.promises.mkdir(pagesDir, { recursive: true });
      
      const existingFile = path.join(pagesDir, 'devtools-json.js');
      const existingContent = '// Existing content';
      await fs.promises.writeFile(existingFile, existingContent);
      
      const { stdout } = await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(stdout).toContain('already exists');
      
      const content = await fs.promises.readFile(existingFile, 'utf-8');
      expect(content).toBe(existingContent); // Should not be overwritten
    });
  });

  describe('#generatedAPIRoutes', () => {
    it('should generate valid Pages Router API route', async () => {
      const pagesDir = path.join(testProjectRoot, 'pages');
      await fs.promises.mkdir(pagesDir, { recursive: true });
      
      await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      const apiFile = path.join(testProjectRoot, 'pages', 'api', 'devtools-json.js');
      const content = await fs.promises.readFile(apiFile, 'utf-8');
      
      // Check for required imports
      expect(content).toContain('import fs from \'fs\'');
      expect(content).toContain('import path from \'path\'');
      expect(content).toContain('import { v4, validate } from \'uuid\'');
      
      // Check for main function
      expect(content).toContain('export default async function handler');
      expect(content).toContain('getOrCreateUUID');
      
      // Check for HTTP method handling
      expect(content).toContain('req.method !== \'GET\'');
      expect(content).toContain('res.status(405)');
      
      // Check for JSON response
      expect(content).toContain('res.status(200).json(devtoolsJson)');
    });

    it('should generate valid App Router API route', async () => {
      const appDir = path.join(testProjectRoot, 'app');
      await fs.promises.mkdir(appDir, { recursive: true });
      
      await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      const apiFile = path.join(testProjectRoot, 'app', 'api', 'devtools-json', 'route.js');
      const content = await fs.promises.readFile(apiFile, 'utf-8');
      
      // Check for required imports
      expect(content).toContain('import fs from \'fs\'');
      expect(content).toContain('import path from \'path\'');
      expect(content).toContain('import { v4, validate } from \'uuid\'');
      expect(content).toContain('import { NextResponse } from \'next/server\'');
      
      // Check for main function
      expect(content).toContain('export async function GET');
      expect(content).toContain('getOrCreateUUID');
      
      // Check for NextResponse usage
      expect(content).toContain('NextResponse.json(devtoolsJson');
    });
  });
});
