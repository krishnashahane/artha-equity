/** Runs the authoritative Python service as a short-lived child process (JSON over stdin/stdout). */
import {spawn} from 'node:child_process';
import {root,resolvePython} from './python_path.mjs';

const TIMEOUT_MS=Number(process.env.PYTHON_TIMEOUT_MS)||30000;
const MAX_CONCURRENCY=Math.max(1,Number(process.env.PYTHON_MAX_CONCURRENCY)||4);
const MAX_QUEUE=Math.max(0,Number(process.env.PYTHON_MAX_QUEUE)||64);
const MAX_OUTPUT_BYTES=8*1024*1024;

/** Errors that are safe to surface to API clients; everything else is reported generically. */
export class ServiceError extends Error{
  constructor(message,status=503){super(message);this.name='ServiceError';this.status=status;}
}

let active=0;const waiting=[];
function acquire(){
  if(active<MAX_CONCURRENCY){active++;return Promise.resolve();}
  if(waiting.length>=MAX_QUEUE)return Promise.reject(new ServiceError('The calculation service is busy. Try again shortly.',503));
  return new Promise(resolve=>waiting.push(resolve));
}
function release(){const next=waiting.shift();if(next)next();else active--;}

function run(input){
  return new Promise((resolve,reject)=>{
    const child=spawn(resolvePython(),['backend/python_service.py'],{cwd:root,stdio:['pipe','pipe','pipe'],shell:false,windowsHide:true});
    const out=[],err=[];let size=0,settled=false;
    const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};
    const timer=setTimeout(()=>{child.kill('SIGKILL');finish(reject,new ServiceError('Python calculation timed out.',504));},TIMEOUT_MS);
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>MAX_OUTPUT_BYTES){child.kill('SIGKILL');return finish(reject,new ServiceError('Python service returned an oversized response.',502));}out.push(chunk);});
    child.stderr.on('data',chunk=>{if(err.length<64)err.push(chunk);});
    child.on('error',error=>finish(reject,new ServiceError(error.code==='ENOENT'?'Python 3 is not installed or PYTHON_EXECUTABLE is wrong.':'Python service could not start.',503)));
    child.stdin.on('error',()=>{});
    child.on('close',code=>{
      if(code!==0){
        const detail=Buffer.concat(err).toString('utf8').trim().split('\n').at(-1)??'';
        if(detail)console.error('[python] '+detail.slice(0,500));
        return finish(reject,new ServiceError('Python service failed.',502));
      }
      try{finish(resolve,JSON.parse(Buffer.concat(out).toString('utf8')));}
      catch{finish(reject,new ServiceError('Python service returned invalid JSON.',502));}
    });
    child.stdin.end(JSON.stringify(input));
  });
}

export async function pythonOperation(input){
  await acquire();
  try{return await run(input);}finally{release();}
}
