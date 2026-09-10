/** CLI: review, approve, reject, search and share application knowledge. Author: Raushan Raj */
import { resolve } from 'node:path';
import { ApplicationKnowledgeStore, type KnowledgeStatus } from '../src/framework/intelligence/knowledge/store.js';

function arg(name:string):string|undefined{const prefix=`--${name}=`;return process.argv.slice(2).find((value:string)=>value.startsWith(prefix))?.slice(prefix.length);}
function positional(index:number):string|undefined{return process.argv.slice(2).filter((value:string)=>!value.startsWith('--'))[index];}

async function main():Promise<void>{
  const root=process.cwd(),store=new ApplicationKnowledgeStore(root),command=positional(0)??'summary';
  if(command==='summary'){console.log(JSON.stringify(await store.summary(arg('app')??process.env.APP),null,2));return;}
  if(command==='list'){
    const app=arg('app')??process.env.APP,status=arg('status') as KnowledgeStatus|undefined;
    const rows=(await store.list()).filter(record=>(!app||record.application===app)&&(!status||(record.status??(record.reviewRequired===false?'APPROVED':'REVIEW_REQUIRED'))===status)).map(record=>({id:record.id,kind:record.kind,title:record.title,application:record.application,status:record.status??(record.reviewRequired===false?'APPROVED':'REVIEW_REQUIRED'),revision:record.revision,source:record.source}));
    console.log(JSON.stringify(rows,null,2));return;
  }
  if(command==='show'){const id=positional(1);if(!id)throw new Error('Usage: npm run app:knowledge -- show <id>');const record=await store.get(id);if(!record)throw new Error(`Knowledge record '${id}' not found.`);console.log(JSON.stringify(record,null,2));return;}
  if(command==='search'){const query=positional(1);if(!query)throw new Error('Usage: npm run app:knowledge -- search "payment checkout" [--app=billing]');console.log(JSON.stringify(await store.search(query,{application:arg('app')??process.env.APP,limit:20}),null,2));return;}
  if(command==='approve'||command==='reject'){
    const id=positional(1);if(!id)throw new Error(`Usage: npm run app:knowledge -- ${command} <id> [--note=...]`);
    const result=await store.review(id,command==='approve'?'APPROVED':'REJECTED',arg('reviewer')??process.env.USER??'human-reviewer',arg('note'));console.log(JSON.stringify(result,null,2));return;
  }
  if(command==='export'){
    const app=arg('app')??process.env.APP; if(!app)throw new Error('Provide APP=<application> or --app=<application> for export.');
    const output=resolve(arg('out')??`application-knowledge/approved/${app}.approved.json`);console.log(`Approved knowledge exported: ${await store.exportApproved(app,output)}`);return;
  }
  if(command==='import'){
    const file=positional(1);if(!file)throw new Error('Usage: npm run app:knowledge -- import <approved-bundle.json>');console.log(`Approved records imported: ${await store.importApproved(resolve(file))}`);return;
  }
  throw new Error(`Unknown command '${command}'. Supported: summary, list, show, search, approve, reject, export, import.`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
