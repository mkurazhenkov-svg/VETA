// Шов для арта художника: если рядом со scene.json лежит base.webp (или hidden.webp — слой «только под лампой»),
// он заменяет процедурный плейсхолдер. Код менять не нужно — достаточно положить файл и пересобрать.
const files = import.meta.glob('/content/cases/*/scenes/*/{base,hidden}.{webp,png,jpg}', { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;

export function sceneArt(sceneId: string, layer: 'base' | 'hidden'): string | null {
  for (const [path, url] of Object.entries(files)) {
    const m = /scenes\/([^/]+)\/(base|hidden)\./.exec(path);
    if (m && m[1] === sceneId && m[2] === layer) return url;
  }
  return null;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}
