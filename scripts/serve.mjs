import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import './build.mjs';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT)||5173,'127.0.0.1',()=>console.log(`Studyflow: http://127.0.0.1:${server.address().port}`));
