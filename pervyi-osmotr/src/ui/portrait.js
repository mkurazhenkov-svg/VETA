// Комиксные портреты-плейсхолдеры (SVG), 6 эмоций. Оригинальный стиль, без заимствований.
const MOUTH = {
  neutral: 'M-14 30 Q0 33 14 30',
  anxiety: 'M-12 32 Q0 27 12 32',
  fear: 'M-9 30 Q0 22 9 30 Q0 38 -9 30',
  irritation: 'M-14 33 Q0 26 14 33',
  sorrow: 'M-13 34 Q0 26 13 34',
  evasive: 'M-14 31 Q4 33 14 28',
};
const BROWS = {
  neutral: ['M-26 -14 L-8 -14', 'M8 -14 L26 -14'],
  anxiety: ['M-26 -12 L-8 -18', 'M8 -18 L26 -12'],
  fear: ['M-26 -14 L-8 -22', 'M8 -22 L26 -14'],
  irritation: ['M-26 -20 L-8 -12', 'M8 -12 L26 -20'],
  sorrow: ['M-26 -12 L-8 -18', 'M8 -18 L26 -12'],
  evasive: ['M-26 -15 L-8 -15', 'M8 -18 L26 -14'],
};

export function portraitSVG(npc, emotion, emoColor) {
  const female = /Галина|Орлова/.test(npc.name);
  const cap = /Белов/.test(npc.name);
  const eyeY = emotion === 'evasive' ? -2 : 0;
  const eyeDx = emotion === 'evasive' ? 5 : 0;
  return `<svg viewBox="-100 -110 200 230" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs><pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="rgba(0,0,0,0.12)"/></pattern></defs>
  <rect x="-100" y="-110" width="200" height="230" fill="${emoColor}"/>
  <rect x="-100" y="-110" width="200" height="230" fill="url(#dots)"/>
  <path d="M-80 120 Q-78 50 -30 40 L30 40 Q78 50 80 120 Z" fill="${npc.color}" stroke="#111" stroke-width="4"/>
  ${cap ? '<path d="M-14 42 L0 70 L14 42" fill="#e8e8e8" stroke="#111" stroke-width="3"/>' : ''}
  <rect x="-14" y="22" width="28" height="24" fill="#e8c2a0" stroke="#111" stroke-width="4"/>
  <ellipse cx="0" cy="-5" rx="44" ry="52" fill="#e8c2a0" stroke="#111" stroke-width="4"/>
  ${female
    ? `<path d="M-48 10 Q-58 -60 0 -62 Q58 -60 48 10 Q40 -30 0 -40 Q-40 -30 -48 10Z" fill="${npc.hair}" stroke="#111" stroke-width="4"/>`
    : `<path d="M-44 -18 Q-46 -62 0 -60 Q46 -62 44 -18 Q30 -44 0 -42 Q-30 -44 -44 -18Z" fill="${npc.hair}" stroke="#111" stroke-width="4"/>`}
  ${cap ? '<path d="M-50 -38 Q0 -80 50 -38 L56 -30 L-56 -30 Z" fill="#24324a" stroke="#111" stroke-width="4"/><rect x="-8" y="-58" width="16" height="10" fill="#d4af37" stroke="#111" stroke-width="2"/>' : ''}
  <g stroke="#111" stroke-width="4" stroke-linecap="round" fill="none">
    <path d="${BROWS[emotion][0]}"/><path d="${BROWS[emotion][1]}"/>
    <path d="${MOUTH[emotion]}" ${emotion === 'fear' ? 'fill="#5a1f1f"' : ''}/>
    <path d="M0 -2 L-5 16 L4 16"/>
  </g>
  <circle cx="${-17 + eyeDx}" cy="${eyeY}" r="${emotion === 'fear' ? 6 : 4.5}" fill="#111"/>
  <circle cx="${17 + eyeDx}" cy="${eyeY}" r="${emotion === 'fear' ? 6 : 4.5}" fill="#111"/>
  ${emotion === 'sorrow' ? '<path d="M-20 8 Q-22 18 -18 22" stroke="#4aa3ff" stroke-width="3" fill="none"/>' : ''}
  ${emotion === 'anxiety' ? '<path d="M36 -40 Q42 -30 36 -24" stroke="#4aa3ff" stroke-width="3" fill="#bfe3ff"/>' : ''}
  ${/Ланской/.test(npc.name) ? '<path d="M-30 50 L-10 110 M30 50 L10 110" stroke="#111" stroke-width="3"/>' : ''}
</svg>`;
}
