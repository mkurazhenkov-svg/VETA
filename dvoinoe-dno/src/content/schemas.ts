// Схемы контента. Весь учебный и музейный контент лежит в content/ и проверяется здесь —
// и при сборке (плагин Vite), и командой `pnpm validate`.
import { z } from 'zod';

export const SKILLS = ['logic', 'chancery', 'observ', 'craft', 'instinct', 'ustav', 'local', 'merchant'] as const;
export const PHOTO_KINDS = ['orienting', 'overview', 'node', 'detail'] as const;
export const VARIANTS = ['truth_main', 'truth_landlord', 'truth_guest'] as const;

const Vec2 = z.tuple([z.number(), z.number()]);
const Poly = z.array(Vec2).min(3);
const SkillId = z.enum(SKILLS);
const VariantId = z.enum(VARIANTS);
const Clock = z.string().regex(/^\d{1,2}:\d{2}$/);

// ---------- Навыки ----------
export const SkillsFile = z.object({
  spheres: z.array(z.object({ id: z.string(), title: z.string() })),
  skills: z.array(
    z.object({
      id: SkillId,
      sphere: z.string(),
      title: z.string(),
      color: z.string(),
      gives: z.string(),
      danger: z.string(),
    }),
  ),
  archetypes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      text: z.string(),
      skills: z.partialRecord(SkillId, z.number().int().min(0).max(6)),
    }),
  ),
  freePoints: z.number().int(),
  defaultArchetype: z.string(),
});

// ---------- Инструменты ----------
export const ToolsFile = z.object({
  tools: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      task: z.string(),
      limit: z.string(),
      today: z.string(),
      bridgeToday: z.string().optional(),
    }),
  ),
});

// ---------- Упаковка ----------
const Outcome = z.enum(['intact', 'degraded', 'destroyed']);
export const PackagingFile = z.object({
  methods: z.array(z.object({ id: z.string(), title: z.string(), text: z.string() })),
  packs: z.array(z.object({ id: z.string(), title: z.string() })),
  rules: z.array(
    z.object({
      id: z.string(),
      material: z.string(),
      // правило срабатывает, если метод/упаковка НЕ из списка допустимых (или явно в списке запретных)
      methodNotIn: z.array(z.string()).optional(),
      methodIn: z.array(z.string()).optional(),
      packNotIn: z.array(z.string()).optional(),
      outcome: Outcome,
      text: z.string(),
    }),
  ),
  sealSteps: z.array(z.string()),
});

// ---------- Правила и оценка ----------
export const Severity = z.enum(['critical', 'major', 'minor']);
export const Criterion = z.enum(['procedure', 'evidence', 'fixation', 'interview', 'folder']);
export const RulesFile = z.object({
  rules: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      era: z.number(),
      category: z.enum(['procedure', 'tactics', 'fixation', 'interview', 'folder', 'evidence']),
      criterion: Criterion,
      severity: Severity,
      check: z.string(),
      params: z.record(z.string(), z.string()).optional(),
      explain: z.string(),
      right1913: z.string(),
      zharov: z.string(),
      source1913: z.string(),
      bridgeToday: z.string(),
    }),
  ),
  scoring: z.object({
    max: z.object({ procedure: z.number(), evidence: z.number(), fixation: z.number(), interview: z.number(), folder: z.number() }),
    penalty: z.object({ critical: z.number(), major: z.number(), minor: z.number() }),
    cap: z.number(),
    grades: z.array(z.object({ min: z.number(), title: z.string() })),
  }),
  protocolConclusionWords: z.array(z.string()),
  teacher: z.object({ pin: z.string() }),
});

export const BridgeFile = z.object({
  cards: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      norm: z.string(),
      text: z.string(),
      tech: z.string().optional(),
      status: z.string(),
    }),
  ),
  epilogue: z.array(z.string()),
});

// ---------- Музей ----------
export const ExhibitsFile = z.object({
  exhibits: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      hall: z.string(),
      text: z.string(),
      photo: z.string().nullable(),
      confirmed: z.boolean(),
    }),
  ),
  promo: z.object({ title: z.string(), text: z.string() }),
  kiosk: z.object({ pin: z.string(), idleSeconds: z.number(), warnSeconds: z.number() }),
});
export const QrFile = z.object({
  codes: z.array(z.object({ code: z.string(), document: z.string(), title: z.string(), hint: z.string(), fact: z.string().optional() })),
});

// ---------- Дело ----------
export const PersonRole = z.enum(['none', 'organizer', 'maker', 'seller', 'concealer', 'patron']);
export const CaseFile = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  startTime: Clock,
  endTime: Clock,
  intro: z.array(z.string()),
  locations: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      short: z.string(),
      scene: z.string().nullable(),
      plates: z.number().int(),
      onMap: z.boolean(),
      requiresFact: z.string().optional(),
      exhibit: z.boolean(),
      mapPos: Vec2,
      enterKnot: z.string().optional(),
      text: z.string(),
    }),
  ),
  travel: z.record(z.string(), z.number()), // "a>b": минуты; иначе default
  travelDefault: z.number(),
  persons: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.string(),
      portrait: z.object({ coat: z.string(), skin: z.string(), hat: z.string(), hair: z.string() }),
      accusable: z.boolean(),
      witnessCandidate: z
        .object({ admissible: z.enum(['yes', 'no', 'questionable']), reason: z.string() })
        .optional(),
    }),
  ),
  variants: z.array(
    z.object({
      id: VariantId,
      title: z.string(),
      summary: z.string(),
      roles: z.record(z.string(), PersonRole),
      fugitive: z.string().nullable(),
      reveal: z.array(z.string()),
      proofs: z.record(z.string(), z.array(z.array(z.string()))), // person -> anyOf(allOf facts)
      workshopLink: z.array(z.string()), // факты, связывающие подвал с фальшивками
      reference: z.object({
        protocolPoints: z.array(z.string()),
        examination: z.record(z.string(), z.string()),
        telegram: z.string(),
      }),
    }),
  ),
  timeline: z.array(
    z.object({
      id: z.string(),
      at: Clock,
      effect: z.string(),
      text: z.string(),
      unlessFlag: z.string().optional(),
      delayIfFlag: z.object({ flag: z.string(), at: Clock }).optional(),
    }),
  ),
  telegram: z.object({
    deadline: Clock,
    destinations: z.array(z.object({ id: z.string(), title: z.string() })),
    correctDestination: z.string(),
    steamerFact: z.string(),
    descriptionFacts: z.array(z.string()),
  }),
  examination: z.object({
    addressees: z.array(z.object({ id: z.string(), title: z.string(), status: z.string() })),
    questions: z.array(z.object({ id: z.string(), text: z.string(), for: z.array(z.string()), good: z.boolean() })),
    objects: z.array(z.object({ evidence: z.string(), correct: z.array(z.string()) })),
  }),
  costs: z.record(z.string(), z.number()),
  exhibitRoute: z.array(z.string()),
  exhibitFinale: z.object({
    signs: z.array(z.object({ id: z.string(), text: z.string(), evidence: z.array(z.string()) })),
    suspects: z.array(z.string()),
  }),
});

export const FactsFile = z.object({
  facts: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      kind: z.enum(['bank', 'evidence', 'testimony', 'document', 'inference', 'archive']),
      presentable: z.boolean().default(false),
      key: z.boolean().default(false),
      variants: z.array(VariantId).optional(),
      textByVariant: z.partialRecord(VariantId, z.string()).optional(),
      infer: z.array(z.string()).optional(), // выводится автоматически, когда известны все эти факты
    }),
  ),
});

const VoiceLine = z.object({
  skill: SkillId,
  passive: z.number().int().optional(), // пассивная проверка: показывается, если навык+6 >= сложность
  text: z.string(),
  shortcut: z.boolean().optional(), // голос предлагает нарушить процедуру
  variants: z.array(VariantId).optional(),
});

export const EvidenceItem = z.object({
  id: z.string(),
  num: z.string(),
  kind: z.enum(['evidence', 'false_trace', 'container']),
  title: z.string(),
  protocolName: z.string(),
  location: z.string(),
  hotspot: z.string(),
  sector: z.string(),
  key: z.boolean().default(false),
  weight: z.number().default(0),
  visibility: z.object({
    via: z.enum(['look', 'lamp', 'search', 'inside']),
    parent: z.string().optional(),
    check: z.object({ skill: SkillId, dc: z.number() }).optional(),
  }),
  describe: z.string(),
  protocol: z.string(),
  lampText: z.string().optional(),
  lupa: z.object({ text: z.string(), fact: z.string().optional(), check: z.object({ skill: SkillId, dc: z.number() }).optional() }).optional(),
  facts: z.array(z.string()).default([]),
  voices: z.array(VoiceLine).default([]),
  materials: z.array(z.string()).default([]),
  fragile: z
    .object({ onTouchBeforePhoto: Outcome.optional(), onWalk: Outcome.optional(), text: z.string().optional() })
    .default({}),
  documentation: z.object({ required: z.array(z.string()), closeup: z.object({ icon: z.string(), color: z.string() }) }),
  collection: z.object({
    collectable: z.boolean(),
    methods: z.array(z.string()),
    packs: z.array(z.string()),
    hint: z.string(),
    gives: z.string(),
  }),
  reveals: z.array(z.string()).default([]),
  examineMinutes: z.number().default(2),
  searchMinutes: z.number().optional(),
  searchLabel: z.string().optional(),
  hiddenText: z.string().optional(),
  origin: z.object({ options: z.array(z.object({ id: z.string(), title: z.string() })), correct: z.string(), text: z.string() }).optional(),
  museum: z.object({ exhibit: z.string().nullable() }).default({ exhibit: null }),
  variants: z.array(VariantId).default(['truth_main', 'truth_landlord', 'truth_guest']),
  byVariant: z.partialRecord(VariantId, z.object({ describe: z.string().optional(), lupa: z.string().optional(), lupaFact: z.string().optional(), facts: z.array(z.string()).optional(), protocol: z.string().optional() })).optional(),
  supports: z.array(z.string()).default([]),
  contradicts: z.array(z.string()).default([]),
});
export const EvidenceFile = z.object({ evidence: z.array(EvidenceItem) });

export const TheoriesFile = z.object({
  theories: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      text: z.string(),
      revealedBy: z.array(z.string()),
      thinkMinutes: z.number(),
      bonus: z.partialRecord(SkillId, z.number()).default({}),
      supports: z.array(z.string()),
      contradicts: z.array(z.string()),
      trueIn: z.array(VariantId),
      voice: SkillId,
    }),
  ),
});

// ---------- Сцена ----------
export const Prop = z.object({
  id: z.string(),
  shape: z.enum(['box', 'cyl', 'flat', 'panel', 'stove', 'press', 'shelf', 'bunk', 'counter', 'window', 'coat', 'bottles', 'cat', 'line']),
  pos: Vec2,
  size: z.tuple([z.number(), z.number(), z.number()]),
  color: z.string(),
  label: z.string().optional(),
  walkable: z.boolean().optional(),
  z: z.number().optional(), // высота основания (предметы на столе)
  detail: z.boolean().optional(), // интерактивная деталь — прописана точнее
});
export const SceneFile = z.object({
  id: z.string(),
  title: z.string(),
  canvas: Vec2,
  origin: Vec2,
  pxPerArshin: z.number(),
  palette: z.object({ ground: z.string(), floor: z.string(), wall: z.string(), wallDark: z.string(), accent: z.string(), grunt: z.string() }),
  light: z.object({
    ambient: z.number(),
    tint: z.string(),
    sources: z.array(z.object({ pos: Vec2, radius: z.number(), power: z.number(), color: z.string().optional(), flicker: z.boolean().optional() })),
  }),
  room: z.object({
    floor: Poly,
    walls: z.array(z.object({ from: Vec2, to: Vec2, h: z.number(), window: z.object({ at: z.number(), w: z.number(), h: z.number(), z: z.number() }).optional(), door: z.object({ at: z.number(), w: z.number(), h: z.number() }).optional() })),
    outdoor: z.boolean().optional(),
  }),
  walkable: z.array(Poly),
  props: z.array(Prop),
  hotspots: z.array(
    z.object({
      id: z.string(),
      prop: z.string().optional(),
      pos: Vec2.optional(),
      z: z.number().optional(),
      r: z.number().optional(),
      approach: Vec2,
      label: z.string(),
      knot: z.string().optional(), // разговор/описание в Ink вместо улики
      action: z.enum(['folder', 'map', 'none']).optional(),
    }),
  ),
  sectors: z.array(z.object({ id: z.string(), title: z.string(), poly: Poly })),
  landmarks: z.array(z.object({ id: z.string(), title: z.string(), pos: Vec2 })),
  north: z.number(),
  hidden: z.array(
    z.object({ id: z.string(), shape: z.enum(['footprints', 'ornament', 'contour', 'paws', 'handprint']), from: Vec2, to: Vec2.optional(), z: z.number().optional(), color: z.string().optional() }),
  ),
  noFlash: z.array(z.object({ center: Vec2, r: z.number() })),
  fragile: z.array(z.object({ poly: Poly, evidence: z.string() })),
  exits: z.array(z.object({ id: z.string(), to: z.string(), pos: Vec2, label: z.string() })),
  spawn: Vec2,
  threshold: Poly.optional(),
  npcs: z.array(z.object({ id: z.string(), person: z.string().optional(), pos: Vec2, knot: z.string(), facing: z.number().optional(), requiresFlag: z.string().optional(), hideFlag: z.string().optional() })),
  photoTargets: z.array(z.object({ id: z.string(), title: z.string(), pos: Vec2, kinds: z.array(z.enum(PHOTO_KINDS)) })),
  followers: z.boolean(),
});

export const DocumentFile = z.object({
  id: z.string(),
  title: z.string(),
  old: z.string(), // дореформенная орфография (исходник)
});

export const StringsFile = z.record(z.string(), z.string());

export type SkillId = (typeof SKILLS)[number];
export type PhotoKind = (typeof PHOTO_KINDS)[number];
export type VariantId = (typeof VARIANTS)[number];
export type Skills = z.infer<typeof SkillsFile>;
export type Tools = z.infer<typeof ToolsFile>;
export type Packaging = z.infer<typeof PackagingFile>;
export type Rules = z.infer<typeof RulesFile>;
export type Rule = Rules['rules'][number];
export type Bridge = z.infer<typeof BridgeFile>;
export type Exhibits = z.infer<typeof ExhibitsFile>;
export type Qr = z.infer<typeof QrFile>;
export type CaseDef = z.infer<typeof CaseFile>;
export type Facts = z.infer<typeof FactsFile>;
export type Fact = Facts['facts'][number];
export type Evidence = z.infer<typeof EvidenceItem>;
export type Theory = z.infer<typeof TheoriesFile>['theories'][number];
export type SceneDef = z.infer<typeof SceneFile>;
export type PropDef = z.infer<typeof Prop>;
export type DocDef = z.infer<typeof DocumentFile>;
export type Role = z.infer<typeof PersonRole>;
export type Person = CaseDef['persons'][number];
export type LocationDef = CaseDef['locations'][number];

export interface Content {
  case: CaseDef;
  facts: Fact[];
  evidence: Evidence[];
  theories: Theory[];
  skills: Skills;
  tools: Tools;
  packaging: Packaging;
  rules: Rules;
  bridge: Bridge;
  exhibits: Exhibits;
  qr: Qr;
  scenes: Record<string, SceneDef>;
  documents: Record<string, DocDef>;
  strings: Record<string, string>;
  ink: string; // скомпилированный JSON истории Ink
}
