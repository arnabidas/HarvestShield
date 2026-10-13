import { z } from 'zod';
import {modelEvidenceSchema} from './model';

export const commoditySchema = z.enum(['tomato', 'apple', 'potato']);
export const visualSchema = z.enum(['GOOD', 'MODERATE', 'BAD', 'UNCERTAIN', 'UNKNOWN']);
export const routeSchema = z.enum(['APPROVED', 'SECONDARY_SCREENING', 'ISOLATE_REJECT', 'HUMAN_REVIEW']);
export type Route = z.infer<typeof routeSchema>;
export type Visual = z.infer<typeof visualSchema>;
export type Commodity = z.infer<typeof commoditySchema>;
const id = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const grams = z.number().int().positive().max(1e9);
const positionSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), confidence: z.number().min(0).max(1) }).strict();
export const profileSchema = z.object({ commodity: commoditySchema,washPermitted:z.boolean().default(false), version: z.literal('heuristic-1'), alpha: z.number().positive().max(100), beta: z.number().positive().max(10), threshold: z.number().min(.01).max(1), storageSuitable: z.boolean(), handling: z.enum(['SOFT_SUCTION', 'PADDED_GRIP']), model: z.literal('SYNTHETIC_FIXTURE') }).strict();
export const profiles: Record<Commodity, z.infer<typeof profileSchema>> = {
  tomato: { commodity: 'tomato',washPermitted:false, version: 'heuristic-1', alpha: 7, beta: 1.1, threshold: .2, storageSuitable: true, handling: 'SOFT_SUCTION', model: 'SYNTHETIC_FIXTURE' },
  apple: { commodity: 'apple',washPermitted:false, version: 'heuristic-1', alpha: 9, beta: 1.2, threshold: .2, storageSuitable: true, handling: 'PADDED_GRIP', model: 'SYNTHETIC_FIXTURE' },
  potato: { commodity: 'potato',washPermitted:false, version: 'heuristic-1', alpha: 8, beta: 1.3, threshold: .2, storageSuitable: true, handling: 'PADDED_GRIP', model: 'SYNTHETIC_FIXTURE' }
};
export const itemInputSchema = z.object({ itemId: id, alias: id, layer: z.number().int().min(1).max(50), index: z.number().int().min(1).max(10000), origin: positionSchema, massGrams: grams, visual: visualSchema.exclude(['UNKNOWN']), coverage: z.number().min(0).max(.99), leaking: z.boolean(), rearDefect: z.boolean(), secondary: z.enum(['APPROVE', 'REJECT', 'HUMAN', 'HOLD']), expert: z.enum(['APPROVE', 'REJECT', 'HOLD']), inferenceRequired:z.boolean().optional(), modelEvidence:modelEvidenceSchema.optional(),modelViews:z.array(modelEvidenceSchema).min(1).max(8).optional() }).strict();
export const batchSchema = z.object({ daysSinceHarvest:z.number().nonnegative().max(365).nullable().default(null), batchId: id, commodity: commoditySchema, sourceLot: id, arrivalMs: z.number().int().nonnegative(), handlingWindowHours: z.number().nonnegative().nullable(), windowSource: z.enum(['SCENARIO_FIXTURE', 'OPERATOR', 'UNKNOWN']), urgency: z.number().min(0).max(100), environmentalHistory: z.object({temperatureC: z.array(z.number().min(-10).max(60)).max(1000), humidityPct: z.array(z.number().min(0).max(100)).max(1000), ethylene: z.array(z.number().nonnegative()).max(1000).nullable(), source: z.enum(['SCENARIO_FIXTURE', 'OPERATOR', 'UNKNOWN'])}).strict() }).strict();
export const crateSchema = z.object({ crateId: id, batchId: id, expectedCount: z.number().int().positive().max(10000), expectedMassGrams: grams, items: z.array(itemInputSchema).min(1).max(10000) }).strict();
export const faultTypeSchema = z.enum(['PICK_FAILED', 'IDENTITY_LOST', 'SANITATION_HOLD', 'COUNT_MISMATCH', 'COVERAGE_INCOMPLETE']);
export const scenarioSchema = z.object({ schemaVersion: z.enum(['1.0','1.1']), scenarioId: id, title: z.string().min(1).max(200), seed: z.number().int().min(0).max(4294967295), batches: z.array(batchSchema).min(1).max(100), crates: z.array(crateSchema).min(1).max(200), profiles: z.array(profileSchema).min(1).max(3), machine: z.object({simulatedWashing:z.boolean().default(false),upstreamCapacity:z.number().int().min(1).max(4).default(1),changeoverMs:z.number().int().min(100).max(60000).default(1500),secondaryCapacity:z.number().int().min(1).max(100).default(4),autoSecondary:z.boolean().default(true),laneGroups:z.array(z.object({batchId:id,lanes:z.array(z.number().int().min(1).max(20)).min(1)}).strict()).max(100).default([]),lanes: z.number().int().min(1).max(20), bufferCapacity: z.number().int().min(1).max(10000), humanCapacity: z.number().int().min(1).max(100), serviceMs: z.number().int().min(100).max(60000), autoExpert: z.boolean(), autoCleaning: z.boolean()}).strict(), capacities: z.object({truckGrams: z.number().int().nonnegative().max(1e9), storageGrams: z.number().int().nonnegative().max(1e9), transitHours: z.number().nonnegative().max(1000), safetyHours: z.number().nonnegative().max(1000), storageCompatible: z.boolean()}).strict(), faultInjections: z.array(z.object({type: faultTypeSchema, itemId: id}).strict()).max(1000), bubbleEnabled: z.boolean() }).strict().superRefine((s, ctx) => {
  const unique = (values: string[], name: string) => { if (new Set(values).size !== values.length) ctx.addIssue({code:'custom',message:`Duplicate ${name}`}); };
  unique(s.batches.map(b=>b.batchId), 'batch IDs'); unique(s.crates.map(c=>c.crateId), 'crate IDs'); unique(s.crates.flatMap(c=>c.items.map(i=>i.itemId)), 'item IDs'); unique(s.profiles.map(p=>p.commodity),'profiles');
  for (const b of s.batches) {
    if (!s.profiles.some(p=>p.commodity===b.commodity)) ctx.addIssue({code:'custom',message:`Missing profile for ${b.commodity}`});
    if (b.handlingWindowHours !== null && b.windowSource === 'UNKNOWN') ctx.addIssue({code:'custom',message:'Handling window requires provenance'});
  }
  for (const c of s.crates) {
    if (!s.batches.some(b=>b.batchId===c.batchId)) ctx.addIssue({code:'custom',message:`Unknown batch ${c.batchId}`});
    unique(c.items.map(i=>`${i.layer}-${i.index}`),'layer/index');
    for (const i of c.items) {if(i.modelViews&&(!i.modelEvidence||i.modelViews.some(v=>v.sourceItemId!==i.itemId)||new Set(i.modelViews.map(v=>v.imageSha256)).size!==i.modelViews.length||i.modelViews.reduce((a,b)=>b.deteriorationScore>a.deteriorationScore?b:a).imageSha256!==i.modelEvidence.imageSha256))ctx.addIssue({code:'custom',message:'Distinct real views must match their original ID and conservative aggregate'});if(i.modelEvidence&&(i.modelEvidence.sourceItemId!==i.itemId||s.batches.find(b=>b.batchId===c.batchId)?.commodity!=='tomato'||i.coverage!==0||i.rearDefect||i.visual!==(i.modelEvidence.sourceLabel==='Fresh'?'GOOD':'BAD')))ctx.addIssue({code:'custom',message:'Real image evidence must match its tomato ID/label and unknown surface coverage'});if (i.itemId !== `${c.batchId}-${c.crateId}-L${String(i.layer).padStart(2,'0')}-I${String(i.index).padStart(2,'0')}`) ctx.addIssue({code:'custom',message:`Item ID must encode origin: ${i.itemId}`});}
  }
  const reserved=s.machine.laneGroups.flatMap(g=>g.lanes);if(new Set(reserved).size!==reserved.length)ctx.addIssue({code:'custom',message:'Reserved lane groups overlap'});for(const g of s.machine.laneGroups)if(!s.batches.some(b=>b.batchId===g.batchId))ctx.addIssue({code:'custom',message:'Lane group references unknown batch'});
  for (const f of s.faultInjections) if (!s.crates.some(c=>c.items.some(i=>i.itemId===f.itemId))) ctx.addIssue({code:'custom',message:`Fault references unknown item ${f.itemId}`});
  if (s.crates.reduce((n,c)=>n+c.items.length,0)>10000) ctx.addIssue({code:'custom',message:'Run limited to 10,000 items'});
});
export type Scenario = z.infer<typeof scenarioSchema>;
export type ItemInput = z.infer<typeof itemInputSchema>;
export type Batch = z.infer<typeof batchSchema>;
export type CrateInput = z.infer<typeof crateSchema>;
export type Profile = z.infer<typeof profileSchema>;

export const states = ['IN_CRATE','MAPPED','PICKING','PICKED','CARRIER','IMAGING','BUFFERED','SORTING','SECONDARY','HUMAN','ISOLATED','PACKAGED','HELD'] as const;
export type ItemState = typeof states[number];
export const itemSchema = itemInputSchema.extend({batchId:id,crateId:id,commodity:commoditySchema,visualCondition:visualSchema,state:z.enum(states),stateSince:z.number().int().nonnegative(),carrierId:z.string().nullable(),slot:z.number().int().nonnegative().nullable(),holdingSlot:z.number().int().nonnegative().nullable(),heldFromState:z.enum(states).nullable(),imagingDurationMs:z.number().nonnegative().default(0),lane:z.number().int().min(1).max(20).nullable(),route:routeSchema.nullable(),neighborReviewFlag:z.boolean(),priority:z.number().min(0).max(1),bubbleIds:z.array(id),observationIds:z.array(id),marketability:z.enum(['PENDING','APPROVED','REJECTED','HELD']),disposition:z.enum(['DISPATCH','STORE','HOLD']).nullable(),simulatedWashed:z.boolean().default(false),alternateUse:z.string().nullable().default(null),reason:z.string()});
export type Item = z.infer<typeof itemSchema>;
export const observationSchema = z.object({observationId:id,itemId:id,view:z.enum(['TOP','FRONT','REAR','REVERSE','UPLOAD']),visual:visualSchema,coverage:z.number().min(0).max(1),simTimeMs:z.number().int().nonnegative(),source:z.enum(['SYNTHETIC_FIXTURE','REAL_TOMATO_MODEL'])});
export type Observation = z.infer<typeof observationSchema>;
export const layerSnapshotSchema = z.object({snapshotId:id,crateId:id,layer:z.number().int().positive(),itemIds:z.array(id),simTimeMs:z.number().int().nonnegative(),version:z.number().int().positive(),shiftFlag:z.boolean(),uncertainty:z.number().min(0).max(1)});
export type LayerSnapshot = z.infer<typeof layerSnapshotSchema>;
export const bubbleSchema = z.object({bubbleId:id,itemId:id,crateId:id,triggerEventId:id,origin:positionSchema,layer:z.number().int().positive(),alpha:z.number(),beta:z.number(),severity:z.number().min(0).max(1),policyVersion:z.string()});
export type Bubble = z.infer<typeof bubbleSchema>;
export const faultSchema = z.object({faultId:id,type:z.string(),itemId:id,crateId:id,simTimeMs:z.number().int().nonnegative(),resolved:z.boolean(),reason:z.string()});
export type Fault = z.infer<typeof faultSchema>;
export const outputLotSchema = z.object({lotId:id,batchId:id,crateId:id,sourceLot:id,itemIds:z.array(id),massGrams:z.number().int().nonnegative(),approved:z.literal(true)});
export type OutputLot = z.infer<typeof outputLotSchema>;
export const runSchema=z.object({runId:id,engineVersion:z.string(),configHash:z.string(),seed:z.number().int().nonnegative(),simTimeMs:z.number().int().nonnegative(),status:z.enum(['READY','RUNNING','COMPLETE'])});
export const warehouseSchema=z.object({warehouseId:id,coldCapacityGrams:z.number().int().nonnegative(),truckCapacityGrams:z.number().int().nonnegative(),environmentalHistory:batchSchema.shape.environmentalHistory});
export const carrierSlotSchema=z.object({slotId:id,laneId:z.number().int().min(1).max(20),occupancyItemId:id.nullable(),cleanliness:z.enum(['SIMULATED_CLEAR','HOLD']),verified:z.boolean()});
export const routeDecisionSchema=z.object({itemId:id,visual:visualSchema,route:routeSchema,reason:z.string(),bubbleIds:z.array(id),policyVersion:z.string(),marketability:z.enum(['PENDING','APPROVED','REJECTED','HELD'])});
export const allocationSchema = z.object({itemId:id,lotId:id,massGrams:grams,action:z.enum(['DISPATCH','STORE','HOLD']),reason:z.string(),source:z.literal('HEURISTIC')});
export const resourcePlanSchema = z.object({allocations:z.array(allocationSchema),dispatchGrams:z.number().int().nonnegative(),storageGrams:z.number().int().nonnegative(),holdGrams:z.number().int().nonnegative(),excludedGrams:z.number().int().nonnegative()});
export type ResourcePlan = z.infer<typeof resourcePlanSchema>;
export const eventTypes = ['WASH_STARTED','WASH_VERIFIED','SORTER_DISPATCH','RECOVERY_VERIFIED','SECONDARY_RETEST','ALTERNATE_GRADE_ASSIGNED','BATCH_REGISTERED','CRATE_ENTERED','LAYER_MAPPED','LAYER_REMAPPED','PICK_ATTEMPTED','PICK_SUCCEEDED','ITEM_ENTERED_CARRIER','IDENTITY_VERIFIED','ROLLER_VIEW_CAPTURED','ITEM_VISUAL_CLASSIFIED','ITEM_BUFFERED','DEFECT_FLAGGED','BUBBLE_CREATED','NEIGHBOR_PRIORITY_UPDATED','EARLY_ISOLATED','EQUIPMENT_HOLD','CLEANING_STARTED','CLEANING_VERIFIED','FAULT_RAISED','BUFFER_BACKPRESSURE','CRATE_ALL_ITEMS_ACCOUNTED','CRATE_RECONCILED','CRATE_RELEASE_BLOCKED','LANE_ASSIGNED','LANE_CLEARED','LANE_CHANGEOVER','ITEM_ROUTE_FINALIZED','SECONDARY_RESULT','EXPERT_DECISION','ITEM_PACKAGED','ITEM_REJECTED','OUTPUT_LOT_CREATED','RESOURCE_PLAN_GENERATED','TRUCK_LOADED','STORAGE_ALLOCATED','RUN_COMPLETE'] as const;
export type EventType = typeof eventTypes[number];
export const eventSchema = z.object({eventId:id,seq:z.number().int().positive(),simTimeMs:z.number().int().nonnegative(),type:z.enum(eventTypes),itemId:id.optional(),crateId:id.optional(),source:z.enum(['SYNTHETIC_FIXTURE','HEURISTIC','HUMAN','REAL_TOMATO_MODEL']),reason:z.string(),references:z.array(id),before:z.string().optional(),after:z.string().optional()});
export type MachineEvent = z.infer<typeof eventSchema>;
export interface Lane {laneId:number;batchId:string|null;itemId:string|null;clear:boolean;availableAt:number;pendingBatchId:string|null;}
export interface Crate {crateId:string;batchId:string;reconciled:boolean;held:boolean;reason:string;}
export interface Snapshot {runId:string;engineVersion:string;configHash:string;seed:number;simTimeMs:number;status:'READY'|'RUNNING'|'COMPLETE';items:Record<string,Item>;crates:Record<string,Crate>;lanes:Lane[];observations:Observation[];maps:LayerSnapshot[];bubbles:Bubble[];faults:Fault[];events:MachineEvent[];lots:OutputLot[];plan:ResourcePlan|null;maxBuffer:number;equipmentHold:boolean;}
