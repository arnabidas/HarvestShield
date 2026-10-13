import Dexie,{type Table} from 'dexie';
import type {Scenario,Snapshot} from '../domain/schema';
export interface Review {itemId:string;decision:'APPROVE'|'REJECT'|'HOLD'|'HUMAN'|'ALTERNATE';reason:string;action?:'REVIEW'|'RECOVER'|'RETEST';actor?:string;verifiedId?:string;permittedUse?:string;}
export interface SavedRun {id:string;scenario:Scenario;cursor:number;reviews:Review[];savedAtUtc:string;snapshot:Snapshot;}
class RunDatabase extends Dexie {runs!:Table<SavedRun,string>;constructor(){super('HarvestShieldLocal');this.version(1).stores({runs:'id,savedAtUtc'});this.version(2).stores({runs:'id,savedAtUtc'}).upgrade(tx=>tx.table('runs').toCollection().modify(run=>{run.reviews=(run.reviews??[]).map((a:Review)=>({...a,action:a.action??'REVIEW'}));}));}}
export const db=new RunDatabase();
export function download(name:string,data:unknown,type='application/json'){const text=typeof data==='string'?data:JSON.stringify(data,null,2);const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function csv(snapshot:Snapshot){const cell=(s:unknown)=>`"${(/^[\s]*[=+@-]/.test(String(s??''))?`'${String(s??'')}`:String(s??'')).replaceAll('"','""')}"`;return [['event_id','sequence','sim_time_ms','type','item_id','crate_id','source','reason','causal_references'],...snapshot.events.map(e=>[e.eventId,e.seq,e.simTimeMs,e.type,e.itemId,e.crateId,e.source,e.reason,e.references.join(';')])].map(row=>row.map(cell).join(',')).join('\r\n');}
