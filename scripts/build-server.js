const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    await esbuild.build({
      entryPoints: ['server/index.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outdir: 'server_dist',
      packages: 'external',
      alias: {
        '@shared': path.resolve(__dirname, '../shared'),
      },
    });
    console.log('Server build complete');
  } catch (error) {
    console.error('Server build failed:', error);
    process.exit(1);
  }
}

build();
