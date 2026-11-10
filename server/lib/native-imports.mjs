// Staff uploads use the same validated importer and dependency resolver as CLI
// imports. Run one import off the HTTP thread; retain originals and job state.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const MAX_UPLOAD=128*1024*1024, MAX_STORED=2*1024**3, MAX_PENDING=8;
const importer=fileURLToPath(new URL('../../tools/import-any-native.mjs',import.meta.url));
export function createNativeImports({db,projectRoot,environment=process.env}) {
  const directory=path.join(projectRoot,'server/native/import-uploads');
  db.exec(`CREATE TABLE IF NOT EXISTS native_imports (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, filename TEXT NOT NULL,
    actor_id INTEGER NOT NULL, state TEXT NOT NULL, bytes INTEGER NOT NULL DEFAULT 0,
    sha256 TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, error TEXT
  )`);
  const q=sql=>db.prepare(sql);
  q("UPDATE native_imports SET state='interrupted',error='server_restarted',updated_at=? WHERE state IN ('uploading','queued','running')").run(Date.now());
  let child=null,closed=false;
  const publicJob=row=>row && ({...row,reportAvailable:row.state==='succeeded',...(row.state==='succeeded'?{launchUrl:'/native-test.html?id='+encodeURIComponent(row.slug)}:{})});
  const update=(id,state,error=null)=>q('UPDATE native_imports SET state=?,error=?,updated_at=? WHERE id=?').run(state,error,Date.now(),id);
  function stopChild(worker) {
    if(worker.exitCode!==null || worker.signalCode!==null)return;
    if(process.platform==='win32') {
      const killer=spawn('taskkill',['/PID',String(worker.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
      killer.on('error',()=>worker.kill());
    } else {
      try{process.kill(-worker.pid,'SIGTERM');}catch{}
    }
  }
  function pump() {
    if(closed || child)return;
    const job=q("SELECT * FROM native_imports WHERE state='queued' ORDER BY created_at,id LIMIT 1").get();
    if(!job)return;
    update(job.id,'running');
    let failed=false,timeout=false;
    const worker=spawn(process.execPath,[importer,'--root',projectRoot,'--file',path.join(directory,job.id+path.extname(job.filename).toLowerCase()),'--id',job.slug,'--name',job.name,'--max-fetch','100'],
      {cwd:projectRoot,env:environment,windowsHide:true,detached:process.platform!=='win32',stdio:'ignore'});
    child=worker;
    const timer=setTimeout(()=>{timeout=true;stopChild(worker);},15*60000);timer.unref();
    worker.once('error',()=>{failed=true;});
    worker.once('close',code=>{
      clearTimeout(timer);child=null;
      update(job.id,closed?'interrupted':!failed && !timeout && code===0?'succeeded':'failed',closed?'server_stopped':timeout?'import_timeout':failed?'importer_unavailable':code===0?null:'validation_or_dependency_import_failed');
      queueMicrotask(pump);
    });
  }
  return {
    list(){return q("SELECT * FROM native_imports ORDER BY CASE WHEN state IN ('uploading','queued','running') THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 100").all().map(publicJob);},
    get(id){return publicJob(q('SELECT * FROM native_imports WHERE id=?').get(id));},
    report(id) {
      const job=q('SELECT * FROM native_imports WHERE id=?').get(id);
      if(!job || job.state!=='succeeded')throw [404,'Completed import report not found.'];
      const file=path.join(projectRoot,'server/native/asset-reports',job.slug+'.json');
      const stat=fs.lstatSync(file);
      if(!stat.isFile() || stat.size>16*1024*1024)throw [413,'Import report exceeds the response limit.'];
      return JSON.parse(fs.readFileSync(file,'utf8'));
    },
    async upload(req,{slug,name,filename},actorId) {
      if(closed)throw [503,'Importer is stopping.'];
      if(typeof slug!=='string' || !/^[a-z0-9-]{1,100}$/.test(slug) || typeof name!=='string' || !name.trim() || name.length>120 || /[\x00-\x1f\x7f]/.test(name) ||
        typeof filename!=='string' || filename.length>180 || /[\\/\x00-\x1f\x7f:]/.test(filename) || !/\.rbxlx?$/i.test(filename))throw [400,'Provide a game ID, name and RBXL/RBXLX filename.'];
      const length=Number(req.headers['content-length']);
      if(req.headers['content-length']!==undefined && (!Number.isSafeInteger(length) || length<1 || length>MAX_UPLOAD))throw [413,'Place upload must be between 1 byte and 128 MiB.'];
      if(!fs.existsSync(importer))throw [503,'Native importer is unavailable.'];
      const pending=q("SELECT COUNT(*) AS n FROM native_imports WHERE state IN ('uploading','queued','running')").get().n;
      if(pending>=MAX_PENDING)throw [429,'The import queue is full.'];
      const stored=q('SELECT COALESCE(SUM(bytes),0) AS n,COUNT(*) AS jobs FROM native_imports').get();
      if(stored.jobs>=1000 || stored.n+(pending+1)*MAX_UPLOAD>MAX_STORED)throw [507,'The retained upload limit has been reached.'];
      if(q("SELECT 1 FROM native_imports WHERE slug=? AND state IN ('uploading','queued','running')").get(slug))throw [409,'This game already has an import in progress.'];
      fs.mkdirSync(directory,{recursive:true});
      if(fs.lstatSync(directory).isSymbolicLink())throw [503,'Upload directory must be a real directory.'];
      const id=crypto.randomUUID(),now=Date.now();
      const file=path.join(directory,id+path.extname(filename).toLowerCase());
      q("INSERT INTO native_imports(id,slug,name,filename,actor_id,state,created_at,updated_at) VALUES (?,?,?,?,?,'uploading',?,?)").run(id,slug,name.trim(),filename,actorId,now,now);
      let handle,bytes=0;const hash=crypto.createHash('sha256');
      try {
        handle=await fs.promises.open(file,'wx');
        for await(const chunk of req) {
          bytes+=chunk.length;
          if(bytes>MAX_UPLOAD)throw [413,'Place upload exceeds 128 MiB.'];
          hash.update(chunk);await handle.writeFile(chunk);
        }
        if(!bytes || (req.headers['content-length']!==undefined && bytes!==length))throw [400,'Place upload is empty or incomplete.'];
        await handle.sync();await handle.close();handle=null;
        q("UPDATE native_imports SET state='queued',bytes=?,sha256=?,updated_at=? WHERE id=?").run(bytes,hash.digest('hex'),Date.now(),id);
        queueMicrotask(pump);
        return this.get(id);
      } catch(error) {
        await handle?.close();
        q("UPDATE native_imports SET state='failed',bytes=?,error='upload_incomplete',updated_at=? WHERE id=?").run(Math.min(bytes,MAX_UPLOAD),Date.now(),id);
        throw error;
      }
    },
    async close(){
      closed=true;
      if(child){const worker=child;await new Promise(resolve=>{worker.once('close',resolve);stopChild(worker);});}
    }
  };
}
