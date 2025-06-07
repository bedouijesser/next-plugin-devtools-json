// This file should be copied to the user's pages/api/ or app/api/ directory
import type { NextApiRequest, NextApiResponse } from 'next';

interface DevToolsJSON {
  workspace?: {
    root: string;
    uuid: string;
  };
}

// This will be replaced with actual utility when the package is installed
async function getOrCreateUUID(projectRoot: string, providedUuid?: string): Promise<string> {
  // For the template, we'll use a simple UUID generation
  // In the actual implementation, this will use proper UUID persistence
  return providedUuid || 'generated-uuid-' + Date.now();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DevToolsJSON>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const projectRoot = process.cwd();
    const uuid = await getOrCreateUUID(projectRoot);

    const devtoolsJson: DevToolsJSON = {
      workspace: {
        root: projectRoot,
        uuid,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(devtoolsJson);
  } catch (error) {
    console.error('Error generating DevTools JSON:', error);
    res.status(500).json({});
  }
}
