// Persist worker retirement until Arbiter confirms it. This survives web restarts.
export function createNativeJobCleanup({db,stopJob,now=Date.now,staleMs=120000,retryMs=15000,timeoutMs=45000}){
  db.exec(`CREATE TABLE IF NOT EXISTS native_job_cleanup (
    job_id TEXT PRIMARY KEY, requested_at INTEGER NOT NULL, retry_at INTEGER NOT NULL DEFAULT 0
  )`);
  const inFlight=new Map();let stopped=false;
  function retire(staleOnly){
    const cutoff=staleOnly?now()-staleMs:Number.MAX_SAFE_INTEGER;
    db.exec('BEGIN IMMEDIATE');
    try{
      db.prepare('INSERT OR IGNORE INTO native_job_cleanup(job_id,requested_at) SELECT job_id,? FROM native_jobs WHERE closed=0 AND last_heartbeat<?').run(now(),cutoff);
      db.prepare('UPDATE native_jobs SET closed=1 WHERE closed=0 AND last_heartbeat<?').run(cutoff);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  retire(false);
  function request(jobId){
    db.exec('BEGIN IMMEDIATE');
    try{
      db.prepare('INSERT OR IGNORE INTO native_job_cleanup(job_id,requested_at) VALUES(?,?)').run(jobId,now());
      db.prepare('UPDATE native_jobs SET closed=1 WHERE job_id=?').run(jobId);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  async function tick(){
    if(stopped)return;
    retire(true);
    // Retry scheduling persists too; failed workers cannot monopolize later cleanup.
    const rows=db.prepare('SELECT job_id,requested_at FROM native_job_cleanup WHERE retry_at<=? ORDER BY retry_at,requested_at,job_id LIMIT 32').all(now());
    const tasks=[];
    for(const row of rows){
      if(inFlight.size>=2)break;
      const id=row.job_id;
      if(inFlight.has(id))continue;
      const controller=new AbortController();inFlight.set(id,controller);
      tasks.push((async()=>{
        try{
          const result=await stopJob(id,AbortSignal.any([controller.signal,AbortSignal.timeout(timeoutMs)]));
          if(stopped)return;
          // A bootstrap can report shutdown before OpenJob has registered in Arbiter.
          // Keep unknown IDs through that bounded startup window before acknowledging.
          const absent=result?.success===false&&/Job ID not found/.test(result.message||'');
          if(!result?.success&&!(absent&&now()-row.requested_at>=staleMs))throw Error(absent?'Worker is not registered yet':'Worker cleanup rejected');
          db.prepare('DELETE FROM native_job_cleanup WHERE job_id=?').run(id);
        }catch(error){
          if(!stopped){db.prepare('UPDATE native_job_cleanup SET retry_at=? WHERE job_id=?').run(now()+retryMs,id);console.warn('[2x2 native] Worker cleanup deferred:',id,error.name==='TimeoutError'?'timeout':error.message);}
        }finally{inFlight.delete(id);}
      })());
    }
    await Promise.all(tasks);
  }
  return {request,tick,pending:jobId=>!!db.prepare('SELECT 1 FROM native_job_cleanup WHERE job_id=?').get(jobId),close(){stopped=true;for(const controller of inFlight.values())controller.abort();}};
}
