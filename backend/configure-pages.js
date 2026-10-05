import { mkdir, writeFile } from 'node:fs/promises';
import { cloudflare } from './cloudflare-client.js';
await mkdir('backups/cloudflare', { recursive: true });
for (const project of ['keytehipkins', 'portfolio-site']) {
  const original = await cloudflare(`/pages/projects/${project}`);
  await writeFile(`backups/cloudflare/pages-${project}.json`, JSON.stringify(original, null, 2));
  console.log(JSON.stringify({ project, domains: original.domains, source: original.source?.config?.repo_name, build: original.build_config }));
  if (process.argv.includes('--apply')) {
    if (original.source?.config?.repo_name !== 'portfolio-site') throw new Error('Unexpected source repository.');
    await cloudflare(`/pages/projects/${project}`, { method: 'PATCH', body: JSON.stringify({ build_config: { ...original.build_config, build_command: 'npm run build', destination_dir: 'dist' } }) });
    console.log(`${project}: configured npm run build → dist/`);
  }
}
