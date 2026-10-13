import {z} from 'zod';
export const modelEvidenceSchema=z.object({
  sourceItemId:z.string(),sourceType:z.literal('REAL_TOMATO_MODEL'),sourceLabel:z.enum(['Fresh','Rotten']),
  condition:z.string(),confidence:z.number().min(0).max(1),freshScore:z.number().min(0).max(1),deteriorationScore:z.number().min(0).max(1),
  modelVersion:z.string(),checkpointSha256:z.string().regex(/^[a-f0-9]{64}$/),imageSha256:z.string().regex(/^[a-f0-9]{64}$/),
  imageWidth:z.number().int().positive(),imageHeight:z.number().int().positive(),inferredAtUtc:z.string(),
}).strict();
export type ModelEvidence=z.infer<typeof modelEvidenceSchema>;
export const UPLOAD_ITEM_ID='UPLOAD-C01-L01-I01';
