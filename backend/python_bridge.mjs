/** Bounded Python process workers. No shell, third-party packages or stderr leakage. */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {existsSync} from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

/** Execute one isolated stdlib worker, bounded by time and output size.
 * @param {Object} input
 * @returns {Promise<Object>}
 */
export function runPython(input){
  return new Promise((resolve,reject)=>{
    const venv=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
    const command=process.env.PYTHON_EXECUTABLE||process.env.CODEX_PRIMARY_RUNTIME_PYTHON||(existsSync(venv)?venv:process.platform==='win32'?'python':'python3');
    // Least privilege: credentials and LLM keys never enter the calculation process.
    const env={PATH:process.env.PATH??'/usr/bin:/bin',PYTHONDONTWRITEBYTECODE:'1',PYTHONIOENCODING:'utf-8',LANG:'C.UTF-8'};
    for(const key of ['ARTHA_STORAGE_MODE','RESEARCH_RETENTION_DAYS','SYSTEMROOT','TMPDIR','TEMP','TMP'])if(process.env[key]!==undefined)env[key]=process.env[key];
    const child=spawn(command,['-S','backend/python_service.py'],{cwd:root,env,stdio:['pipe','pipe','pipe'],shell:false});
    let output='',bytes=0,failure=null,settled=false;
    const timer=setTimeout(()=>{failure=new Error('Python calculation timed out.');child.kill('SIGKILL');},30000);
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
    child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024){failure=new Error('Python response exceeds the output limit.');child.kill('SIGKILL');}else output+=chunk;});
    // Drain stderr without retaining or exposing paths, tracebacks or input values.
    child.stderr.on('data',()=>{});
    child.stdin.on('error',()=>{});
    child.on('error',()=>finish(new Error('Python service is unavailable.')));
    child.on('close',code=>{
      if(failure)return finish(failure);
      if(code!==0)return finish(new Error('Python service failed.'));
      try{finish(null,JSON.parse(output));}catch{finish(new Error('Python service returned invalid JSON.'));}
    });
    try{child.stdin.end(JSON.stringify(input));}catch{failure=new Error('Invalid Python request.');child.kill('SIGKILL');}
  });
}

/** FIFO worker admission with bounded concurrency and waiting capacity.
 * Processes are isolated per operation, preventing cross-issuer state retention.
 * @param {{concurrency?:number,maxQueue?:number,queueTimeoutMs?:number,execute?:(input:Object)=>Promise<Object>}} options
 */
export function createPythonPool({concurrency=2,maxQueue=16,queueTimeoutMs=10000,execute=runPython}={}){
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8||!Number.isInteger(maxQueue)||maxQueue<0||maxQueue>128||!Number.isFinite(queueTimeoutMs)||queueTimeoutMs<1)throw new Error('Invalid Python pool limits.');
  let active=0;const queue=[];
  function start(job){
    clearTimeout(job.timer);active++;
    Promise.resolve().then(()=>execute(job.input)).then(job.resolve,job.reject).finally(()=>{active--;const next=queue.shift();if(next)start(next);});
  }
  return {
    operation(input){return new Promise((resolve,reject)=>{
      const job={input,resolve,reject,timer:null};
      if(active<concurrency)return start(job);
      if(queue.length>=maxQueue)return reject(new Error('Python capacity is busy. Try again shortly.'));
      job.timer=setTimeout(()=>{const i=queue.indexOf(job);if(i>=0){queue.splice(i,1);reject(new Error('Python queue wait timed out.'));}},queueTimeoutMs);
      queue.push(job);
    });},
    stats(){return {active,queued:queue.length,concurrency,maxQueue};}
  };
}
const pool=createPythonPool({concurrency:Number(process.env.PYTHON_WORKERS??2),maxQueue:Number(process.env.PYTHON_QUEUE_LIMIT??16)});
export const pythonOperation=input=>pool.operation(input);
