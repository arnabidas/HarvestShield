import {build} from 'esbuild';
await build({entryPoints:[new URL('./server-entry.ts',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],bundle:true,platform:'node',format:'esm',outfile:new URL('./dist/engine.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
