import {z} from 'zod';
export const kindSchema=z.enum(['description','audience','capability','marketing','demo','prohibited','voice','asset','template','cta']);
const selectorSchema=z.object({claimId:z.string().min(1),projectId:z.string().min(1),kind:kindSchema,pointer:z.string().startsWith('/').optional(),lines:z.tuple([z.number().int().positive(),z.number().int().positive()]).optional()}).strict().refine(v=>Boolean(v.pointer)!==Boolean(v.lines),'Selector requires exactly one JSON pointer or Markdown line range');
export const knowledgeSourceSchema=z.object({id:z.string().min(1),path:z.string().min(1),category:z.enum(['product-description','feature-doc','changelog']),reviewed:z.literal(true),reviewedSha256:z.string().regex(/^[a-f0-9]{64}$/),selectors:z.array(selectorSchema).min(1)}).strict();
export const knowledgeRegistrySchema=z.object({sources:z.array(knowledgeSourceSchema),projects:z.array(z.object({id:z.string(),enabled:z.boolean(),scope:z.string()}).strict())}).strict();
