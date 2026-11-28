import fs from 'node:fs/promises';
import {build} from 'esbuild';
// Use compiled production CSS and embed the module worker so the demo runs from file://.
const bundle=async(entry,options={})=>(await build({entryPoints:[entry],bundle:true,minify:true,write:false,format:'iife',...options})).outputFiles[0].text;
const worker=await bundle('src/optimizer.worker.js');
const aiWorker=await bundle('src/ai.worker.js');
const script=await bundle('src/main.jsx',{
  loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},
  plugins:[{name:'standalone-worker',setup(builder){
    builder.onLoad({filter:/(main|AiCompare)\.jsx$/},async({path})=>{
      const source=await fs.readFile(path,'utf8');
      const url="new URL('./optimizer.worker.js',import.meta.url)";
      const aiUrl="new URL('./ai.worker.js',import.meta.url)";
      return {loader:'jsx',contents:source.replace(url,()=> 'URL.createObjectURL(new Blob(['+JSON.stringify(worker)+'],{type:"text/javascript"}))').replace(aiUrl,()=> 'URL.createObjectURL(new Blob(['+JSON.stringify(aiWorker)+'],{type:"text/javascript"}))')};
    });
  }}]
});
const files=await fs.readdir('dist/assets');
const css=(await fs.readFile('dist/assets/'+files.find(x=>x.endsWith('.css')),'utf8')).replace(/@import\s*url\([^)]*\);?/g,'');
await fs.writeFile('docs/index.html','<!doctype html><html lang="ru" class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ЭПОХА — план участка</title><style>'+css+'</style><div id="root"></div><script>'+script.replace(/<\/script/gi,'<\\/script')+'</script></html>');
