import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [{
    name: 'local-server-environment',
    hooks: {
      'astro:config:setup'({ command, config }) {
        if (command !== 'dev') return;
        try {
          process.loadEnvFile(join(fileURLToPath(config.root), '.env'));
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      },
    },
  }],
});
