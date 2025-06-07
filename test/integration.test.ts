import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { v4, validate } from 'uuid';

// Mock a complete Next.js API route handler
async function createDevToolsApiHandler(projectRoot: string, providedUuid?: string) {
  const getOrCreateUUID = async (root: string, uuid?: string): Promise<string> => {
    if (uuid) return uuid;
    
    const cacheDir = path.resolve(root, '.next', 'cache');
    const uuidPath = path.resolve(cacheDir, 'devtools-uuid.json');
    
    if (fs.existsSync(uuidPath)) {
      try {
        const content = fs.readFileSync(uuidPath, 'utf-8');
        const cachedUuid = content.trim();
        if (validate(cachedUuid)) return cachedUuid;
      } catch (error) {
        // Invalid file, will generate new UUID
      }
    }
    
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    const newUuid = v4();
    fs.writeFileSync(uuidPath, newUuid, 'utf-8');
    return newUuid;
  };

  return async (req: any, res: any) => {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Allow', ['GET']);
      res.end(`Method ${req.method} Not Allowed`);
      return;
    }

    try {
      const uuid = await getOrCreateUUID(projectRoot, providedUuid);
      
      const devtoolsJson = {
        workspace: {
          root: projectRoot,
          uuid,
        },
      };

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify(devtoolsJson, null, 2));
    } catch (error) {
      console.error('Error generating DevTools JSON:', error);
      res.statusCode = 500;
      res.end('{}');
    }
  };
}

describe('#IntegrationTests', () => {
  const testProjectRoot = path.resolve(process.cwd(), 'test-integration-temp');
  
  beforeAll(async () => {
    // Clean up any existing test files
    try {
      await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    
    await fs.promises.mkdir(testProjectRoot, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.promises.rm(testProjectRoot, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('#FullWorkflow', () => {
    it('should serve a valid devtools.json response', async () => {
      const apiHandler = await createDevToolsApiHandler(testProjectRoot);
      
      const server = createServer((req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        
        if (url.pathname === '/.well-known/appspecific/com.chrome.devtools.json' ||
            url.pathname === '/api/devtools-json') {
          apiHandler(req, res);
        } else {
          res.statusCode = 404;
          res.end('Not Found');
        }
      });

      await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
      });

      const response = await request(server)
        .get('/.well-known/appspecific/com.chrome.devtools.json');

      const devtoolsJson = JSON.parse(response.text);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(devtoolsJson).toHaveProperty('workspace');
      expect(devtoolsJson.workspace).toHaveProperty('root');
      expect(devtoolsJson.workspace.root).toBe(testProjectRoot);
      expect(devtoolsJson.workspace).toHaveProperty('uuid');
      expect(validate(devtoolsJson.workspace.uuid)).toBe(true);

      server.close();
    });

    it('should cache UUID between requests', async () => {
      const apiHandler = await createDevToolsApiHandler(testProjectRoot);
      
      const server = createServer((req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        
        if (url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
          apiHandler(req, res);
        } else {
          res.statusCode = 404;
          res.end('Not Found');
        }
      });

      await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
      });

      const [response1, response2] = await Promise.all([
        request(server).get('/.well-known/appspecific/com.chrome.devtools.json'),
        request(server).get('/.well-known/appspecific/com.chrome.devtools.json'),
      ]);

      expect(response1.text).toBe(response2.text);
      
      const json1 = JSON.parse(response1.text);
      const json2 = JSON.parse(response2.text);
      
      expect(json1.workspace.uuid).toBe(json2.workspace.uuid);

      server.close();
    });

    it('should use provided UUID when specified', async () => {
      const customUuid = 'test-custom-uuid-123';
      const apiHandler = await createDevToolsApiHandler(testProjectRoot, customUuid);
      
      const server = createServer((req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        
        if (url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
          apiHandler(req, res);
        } else {
          res.statusCode = 404;
          res.end('Not Found');
        }
      });

      await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
      });

      const response = await request(server)
        .get('/.well-known/appspecific/com.chrome.devtools.json');

      const devtoolsJson = JSON.parse(response.text);
      
      expect(devtoolsJson.workspace.uuid).toBe(customUuid);

      server.close();
    });

    it('should handle non-GET requests properly', async () => {
      const apiHandler = await createDevToolsApiHandler(testProjectRoot);
      
      const server = createServer((req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        
        if (url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
          apiHandler(req, res);
        } else {
          res.statusCode = 404;
          res.end('Not Found');
        }
      });

      await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
      });

      const response = await request(server)
        .post('/.well-known/appspecific/com.chrome.devtools.json');

      expect(response.status).toBe(405);
      expect(response.headers.allow).toBe('GET');

      server.close();
    });
  });
});
