import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
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

  describe('#nextConfigSetup', () => {
    it('should create new next.config.js when none exists', async () => {
      // Create a basic package.json with Next.js dependency
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0'
        }
      };
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const { stdout } = await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(stdout).toContain('Created next.config.js');
      
      const configFile = path.join(testProjectRoot, 'next.config.js');
      expect(fs.existsSync(configFile)).toBe(true);
      
      const content = await fs.promises.readFile(configFile, 'utf-8');
      expect(content).toContain('next-plugin-devtools-json');
      expect(content).toContain('withDevToolsJSON');
      expect(content).toContain('withDevToolsJSON(nextConfig)');
      expect(content).toContain('const nextConfig');
    });

    it('should update existing CommonJS next.config.js', async () => {
      // Create a basic package.json with Next.js dependency
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0'
        }
      };
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create an existing next.config.js
      const existingConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};

module.exports = nextConfig;`;
      
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'next.config.js'),
        existingConfig
      );

      const { stdout } = await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(stdout).toContain('Updated next.config file');
      
      const configFile = path.join(testProjectRoot, 'next.config.js');
      const content = await fs.promises.readFile(configFile, 'utf-8');
      
      expect(content).toContain('next-plugin-devtools-json');
      expect(content).toContain('withDevToolsJSON');
      
      expect(content).toContain('withDevToolsJSON(nextConfig)');
      expect(content).toContain('const nextConfig');
      expect(content).toContain('reactStrictMode: true'); // Preserve existing config
    });

    it('should update existing ESM next.config.mjs', async () => {
      // Create a basic package.json with Next.js dependency
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0'
        }
      };
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create an existing next.config.mjs
      const existingConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};

export default nextConfig;`;
      
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'next.config.mjs'),
        existingConfig
      );

      const { stdout } = await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(stdout).toContain('Updated next.config file');
      
      const configFile = path.join(testProjectRoot, 'next.config.mjs');
      const content = await fs.promises.readFile(configFile, 'utf-8');
      
      expect(content).toContain('next-plugin-devtools-json');
      expect(content).toContain('withDevToolsJSON');
      
      expect(content).toContain('withDevToolsJSON(nextConfig)');
      expect(content).toContain('const nextConfig');
      expect(content).toContain('reactStrictMode: true'); // Preserve existing config
    });

    it('should handle TypeScript next.config.ts', async () => {
      // Create a basic package.json with Next.js dependency
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0',
          typescript: '^5.0.0'
        }
      };
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create an existing next.config.ts
      const existingConfig = `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true
};

export default nextConfig;`;
      
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'next.config.ts'),
        existingConfig
      );

      const { stdout } = await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(stdout).toContain('Updated next.config file');
      
      const configFile = path.join(testProjectRoot, 'next.config.ts');
      const content = await fs.promises.readFile(configFile, 'utf-8');
      
      expect(content).toContain('next-plugin-devtools-json');
      expect(content).toContain('withDevToolsJSON');
      
      expect(content).toContain('withDevToolsJSON(nextConfig)');
      expect(content).toContain(': NextConfig');
      expect(content).toContain('reactStrictMode: true'); // Preserve existing config
    });

    it('should not overwrite already configured next.config', async () => {
      // Create a basic package.json with Next.js dependency
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0'
        }
      };
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create a next.config.js that already has the plugin
      const existingConfig = `const withDevToolsJSON = require('next-plugin-devtools-json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};

module.exports = withDevToolsJSON(nextConfig);`;
      
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'next.config.js'),
        existingConfig
      );

      const { stdout } = await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(stdout).toContain('Plugin already configured');
      
      const configFile = path.join(testProjectRoot, 'next.config.js');
      const content = await fs.promises.readFile(configFile, 'utf-8');
      
      // Should be unchanged
      expect(content).toBe(existingConfig);
    });

    it('should fail when not in a Next.js project', async () => {
      // Create a directory without package.json
      try {
        await execAsync(`cd "${testProjectRoot}" && node "${setupScript}" 2>&1`, {
          env: { ...process.env, NODE_ENV: 'test' }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stdout || '') + (error.stderr || '');
        expect(output).toContain('package.json not found');
      }
    });

    it('should fail when Next.js is not in dependencies', async () => {
      // Create a package.json without Next.js
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0'
        }
      };
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      try {
        await execAsync(`cd "${testProjectRoot}" && node "${setupScript}" 2>&1`, {
          env: { ...process.env, NODE_ENV: 'test' }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = (error.stdout || '') + (error.stderr || '');
        expect(output).toContain('Next.js not found in dependencies');
      }
    });
  });

  describe('#pluginFunctionality', () => {
    it('should indicate that the endpoint will be available', async () => {
      // Create a basic package.json with Next.js dependency
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0'
        }
      };
      await fs.promises.writeFile(
        path.join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const { stdout } = await execAsync(`cd "${testProjectRoot}" && node "${setupScript}"`, {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(stdout).toContain('/.well-known/appspecific/com.chrome.devtools.json');
      expect(stdout).toContain('development mode');
      expect(stdout).toContain('npm run dev');
    });
  });
});
