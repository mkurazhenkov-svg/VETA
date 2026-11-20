// Оценка кадра по метаданным, которые сообщает рендер. Чистая функция.
// visible: [{ id, frameShare, axisAngleDeg, dist, hasScale, hasMarker }]

export const PHOTO_KINDS = {
  orienting: 'Ориентирующая',
  overview: 'Обзорная',
  node: 'Узловая',
  detail: 'Детальная',
};

export function judgePhoto(meta, R) {
  const credits = [];
  const issues = [];
  const { declaredKind: kind, focal, camZone, visible = [], seesEntry } = meta;

  if (kind === 'orienting') {
    if (camZone !== 'landing') issues.push('Ориентирующий кадр снимают снаружи: с площадки, захватывая вход и окружение.');
    else if (focal > R.orientingMaxFocal) issues.push(`Слишком узкий угол (${Math.round(focal)} мм): нужен широкоугольный кадр.`);
    else if (!seesEntry) issues.push('В кадре нет входа в квартиру.');
    else credits.push({ id: '_scene', kind: 'orienting' });
    return { ok: credits.length > 0, credits, issues };
  }

  if (kind === 'overview') {
    if (focal > R.overviewMaxFocal) issues.push(`Обзорный кадр — широким углом (сейчас ${Math.round(focal)} мм).`);
    else {
      for (const v of visible) if (v.frameShare >= R.overviewMinShare && v.dist <= R.overviewMaxDist) credits.push({ id: v.id, kind: 'overview' });
      if (!credits.length) issues.push('В кадре нет зафиксированных объектов обстановки.');
    }
    return { ok: credits.length > 0, credits, issues };
  }

  // Главный объект — ближайший к центру кадра (куда направлена оптическая ось), а при равенстве — крупнейший.
  const cand = visible.filter((v) => v.frameShare >= 0.002);
  const main = [...(cand.length ? cand : visible)].sort((a, b) => (a.centerDist ?? 0) - (b.centerDist ?? 0) || b.frameShare - a.frameShare)[0];
  if (!main) return { ok: false, credits, issues: ['В кадре нет объекта съёмки.'] };

  if (kind === 'node') {
    if (main.frameShare < R.nodeMinShare) issues.push('Объект слишком мелкий для узлового кадра — подойдите ближе.');
    else if (main.frameShare > R.nodeMaxShare) issues.push('Объект занимает почти весь кадр: на узловом должно быть видно окружение.');
    else {
      credits.push({ id: main.id, kind: 'node' });
      if (!main.hasMarker) issues.push('Нет номерного указателя рядом с объектом (засчитано с замечанием).');
    }
  }

  if (kind === 'detail') {
    if (main.frameShare < R.detailMinShare) issues.push(`Объект занимает ${Math.round(main.frameShare * 100)} % кадра — для детального нужно от ${Math.round(R.detailMinShare * 100)} %. Подойдите или увеличьте зум.`);
    else if (!main.hasScale) issues.push('Нет масштабной линейки: детальный снимок не засчитан.');
    else if (main.axisAngleDeg > R.detailMaxAxisDeg) issues.push(`Оптическая ось отклонена на ${Math.round(main.axisAngleDeg)}° от перпендикуляра (допуск ${R.detailMaxAxisDeg}°).`);
    else credits.push({ id: main.id, kind: 'detail' });
  }
  return { ok: credits.length > 0, credits, issues };
}
