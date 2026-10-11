import {createHash} from 'node:crypto';
import {z} from 'zod';

const nonEmpty = z.string().trim().min(1);
export const templateSchema = z.enum(['before-after', 'explainer', 'feature-demo', 'gameplay', 'announcement']);
export const sceneKindSchema = z.enum(['hook', 'before', 'after', 'lesson', 'cta']);
export const approvedContentSchema = z.object({
  id: nonEmpty, topic: nonEmpty, title: nonEmpty, hook: nonEmpty, body: nonEmpty,
  cta: nonEmpty, before: nonEmpty.optional(), after: nonEmpty.optional(),
  disclaimer: nonEmpty.optional(), lessons: z.array(nonEmpty.max(240)).max(6).optional(), source: nonEmpty,
}).strict();
export const projectProfileSchema = z.object({
  id: nonEmpty.regex(/^[a-z0-9][a-z0-9-]*$/), name: nonEmpty, enabled: z.boolean(),
  colors: z.object({background: nonEmpty.regex(/^#[0-9a-fA-F]{6}$/), ink: nonEmpty.regex(/^#[0-9a-fA-F]{6}$/), accent: nonEmpty.regex(/^#[0-9a-fA-F]{6}$/), muted: nonEmpty.regex(/^#[0-9a-fA-F]{6}$/)}).strict(),
  typography: z.object({display: nonEmpty, body: nonEmpty, mono: nonEmpty}).strict(),
  logo: z.object({type: z.enum(['wordmark', 'image']), value: nonEmpty}).strict(),
  voice: z.array(nonEmpty), templates: z.array(templateSchema).min(1), restrictions: z.array(nonEmpty),
  cta: nonEmpty, assetDirectories: z.array(nonEmpty),
  output: z.object({width: z.literal(1080), height: z.literal(1920), fps: z.literal(30)}).strict(),
  approvedContent: z.array(approvedContentSchema), brandSources: z.array(nonEmpty),
}).strict();
export const sceneSchema = z.object({
  kind: sceneKindSchema, headline: z.string().min(1).max(80), body: z.string().min(1).max(240),
  seconds: z.number().int().min(4).max(8), assetId: nonEmpty.optional(),
  layout:z.enum(['headline','comparison','sequence','relationship','focus','media']).optional(),
  displayTexts:z.array(nonEmpty.max(240)).min(1).max(3).optional(),
  transition:z.enum(['cut','reveal','slide']).optional(), disclaimer:nonEmpty.max(240).optional(),
}).strict();
export const scriptSchema = z.object({
  version: z.literal(1), projectId: nonEmpty, topic: nonEmpty.max(300), template: templateSchema,
  contentId: nonEmpty, scenes: z.array(sceneSchema).length(4), cta: nonEmpty,
}).strict();

export type ProjectProfile = z.infer<typeof projectProfileSchema>;
export type VideoScript = z.infer<typeof scriptSchema>;
export type Template = z.infer<typeof templateSchema>;

export function validateTrustedScript(value: unknown, profile: ProjectProfile): VideoScript {
  const script = scriptSchema.parse(value);
  if (script.projectId !== profile.id) throw new Error('Script projectId does not match profile');
  if (!profile.templates.includes(script.template)) throw new Error(`Template ${script.template} is not enabled`);
  const content = profile.approvedContent.find((entry) => entry.id === script.contentId);
  if (!content) throw new Error('Script contentId is not approved for this project');
  if (script.cta !== profile.cta) throw new Error('Script CTA must exactly match the project CTA');
  const allowed = new Set([content.title, content.hook, content.body, content.before, content.after,
    content.cta, content.disclaimer, profile.cta, ...(content.lessons??[])].filter((text): text is string => Boolean(text)));
  for (const [index, scene] of script.scenes.entries()) {
    if(scene.layout==='media'&&!scene.assetId)throw new Error('Media layout requires an actual approved asset');
    if(scene.assetId&&scene.layout&&scene.layout!=='media')throw new Error('Required scene asset must use the media renderer');
    if (!allowed.has(scene.headline) || !allowed.has(scene.body) || scene.displayTexts?.some(text=>!allowed.has(text)) || (scene.disclaimer!==undefined&&scene.disclaimer!==content.disclaimer)) {
      throw new Error(`Scene ${index + 1} contains wording outside the approved content allowlist`);
    }
  }
  if (script.template === 'before-after') {
    const expected = ['hook', 'before', 'after', 'cta'];
    if (!content.before || !content.after) throw new Error('Approved content lacks a before/after pair');
    script.scenes.forEach((scene, index) => {
      if (scene.kind !== expected[index]) throw new Error('Before-after scenes must be hook, before, after, cta');
    });
    if (script.scenes[1]?.headline !== content.before || script.scenes[1]?.body !== content.before ||
        script.scenes[2]?.headline !== content.after || script.scenes[2]?.body !== content.after) {
      throw new Error('Before and after scenes must use the exact approved pair');
    }
  }
  if (script.template === 'explainer') {
    const expected = ['hook', 'lesson', 'lesson', 'cta'];
    if(content.lessons?.length&&script.scenes.slice(1,3).some((scene,i)=>scene.body!==content.lessons?.[i]))throw new Error('Explainer must teach the approved lessons in order');
    script.scenes.forEach((scene, index) => {
      if (scene.kind !== expected[index]) throw new Error('Explainer scenes must be hook, lesson, lesson, cta');
    });
  }
  if(script.template==='gameplay'&&script.scenes.map(s=>s.kind).join(',')!=='hook,lesson,lesson,cta')throw new Error('Gameplay scenes must be hook, lesson, lesson, cta');
  if(script.scenes[3]?.kind!=='cta'||script.scenes[3]?.body!==profile.cta)throw new Error('Final scene must contain the exact project CTA');
  return script;
}

export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
