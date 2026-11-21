// Изъятие и упаковка: исход определяется правилами из content/rules/packaging.yaml.
import type { Content, Evidence } from '../content/schemas';
import type { Condition } from './events';

const ORDER: Condition[] = ['intact', 'degraded', 'destroyed'];
const worst = (a: Condition, b: Condition) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

export interface PackResult {
  outcome: Condition;
  reasons: string[];
}

export function judgePackaging(content: Content, ev: Evidence, method: string, pack: string): PackResult {
  let outcome: Condition = 'intact';
  const reasons: string[] = [];
  const methodOk = ev.collection.methods.includes(method);
  const packOk = ev.collection.packs.includes(pack);
  for (const rule of content.packaging.rules) {
    if (!ev.materials.includes(rule.material)) continue;
    const mHit = rule.methodNotIn ? !rule.methodNotIn.includes(method) : rule.methodIn ? rule.methodIn.includes(method) : false;
    const pHit = rule.packNotIn ? !rule.packNotIn.includes(pack) : false;
    if (mHit || pHit) {
      outcome = worst(outcome, rule.outcome);
      reasons.push(rule.text);
    }
  }
  if (!methodOk && outcome === 'intact') {
    outcome = 'degraded';
    reasons.push('Способ изъятия не подходит для этого предмета: часть следов утрачена.');
  }
  if (!packOk && outcome === 'intact') {
    outcome = 'degraded';
    reasons.push('Упаковка не защищает предмет при перевозке.');
  }
  return { outcome, reasons };
}
