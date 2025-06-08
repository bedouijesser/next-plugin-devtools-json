import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Next.js Compatibility (Integration Tests)', () => {
  let testDir: string;
  const setupScript = path.resolve(process.cwd(), 'bin/setup.js');

  beforeEach(async () => {
    // Create a unique test directory
    testDir = path.join('/tmp', `nextjs-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  // Test different Next.js project structures
  const projectStructures = [
    { type: 'pages', name: 'Pages Router' },
    { type: 'app', name: 'App Router' }
  ];

  for (const structure of projectStructures) {
    it(`should work with ${structure.name} structure`, async () => {
      // Create package.json
      const packageJson = {
        name: `test-${structure.type}-router`,
        version: '1.0.0',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start'
        },
        dependencies: {
          next: '^14.2.5',
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create appropriate directory structure
      if (structure.type === 'pages') {
        await fs.promises.mkdir(path.join(testDir, 'pages'), { recursive: true });
        await fs.promises.writeFile(
          path.join(testDir, 'pages', 'index.js'),
          `export default function Home() {
            return <div>Hello World</div>;
          }`
        );
      } else {
        await fs.promises.mkdir(path.join(testDir, 'app'), { recursive: true });
        await fs.promises.writeFile(
          path.join(testDir, 'app', 'page.js'),
          `export default function Page() {
            return <div>Hello World</div>;
          }`
        );
        await fs.promises.writeFile(
          path.join(testDir, 'app', 'layout.js'),
          `export default function RootLayout({ children }) {
            return (
              <html lang="en">
                <body>{children}</body>
              </html>
            );
          }`
        );
      }

      // Run the setup script
      const { stdout } = await execAsync(`node "${setupScript}"`, {
        cwd: testDir,
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(stdout).toContain('Setup complete!');

      // Verify config was created
      const configPath = path.join(testDir, 'next.config.js');
      expect(fs.existsSync(configPath)).toBe(true);

      const configContent = await fs.promises.readFile(configPath, 'utf-8');
      expect(configContent).toContain('withDevToolsJSON');
    }, 30000);
  }

  // Test monorepo structure
  it('should work in monorepo structure', async () => {
    // Create monorepo structure
    await fs.promises.mkdir(path.join(testDir, 'apps', 'web'), { recursive: true });
    const webDir = path.join(testDir, 'apps', 'web');

    const packageJson = {
      name: '@monorepo/web',
      version: '1.0.0',
      dependencies: { next: '^14.2.5', react: '^18.0.0', 'react-dom': '^18.0.0' }
    };

    await fs.promises.writeFile(
      path.join(webDir, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );

    // Run setup script from nested directory
    const { stdout } = await execAsync(`node "${setupScript}"`, {
      cwd: webDir,
      env: { ...process.env, NODE_ENV: 'test' }
    });

    expect(stdout).toContain('Setup complete!');
    expect(fs.existsSync(path.join(webDir, 'next.config.js'))).toBe(true);
  }, 30000);
});
