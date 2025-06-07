import { promises as fs } from 'fs';
import path from 'path';
import { v4, validate } from 'uuid';

export async function getOrCreateUUID(projectRoot: string, providedUuid?: string): Promise<string> {
  if (providedUuid) {
    return providedUuid;
  }

  // Use Next.js cache directory or fallback to .next
  const cacheDir = path.resolve(projectRoot, '.next', 'cache');
  const uuidPath = path.resolve(cacheDir, 'devtools-uuid.json');

  try {
    const uuidContent = await fs.readFile(uuidPath, { encoding: 'utf-8' });
    const uuid = uuidContent.trim();
    if (validate(uuid)) {
      return uuid;
    }
  } catch (error) {
    // File doesn't exist or is invalid, will create new one
  }

  try {
    await fs.mkdir(cacheDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  const uuid = v4();
  await fs.writeFile(uuidPath, uuid, { encoding: 'utf-8' });
  console.log(`Generated UUID '${uuid}' for DevTools project settings.`);
  return uuid;
}
