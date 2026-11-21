import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const URL = 'file://' + join(import.meta.dirname, '..', '..', 'dist', 'index.html');
const SHOTS = join(import.meta.dirname, '..', '..', 'docs', 'screenshots');
mkdirSync(SHOTS, { recursive: true });

async function open(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL + query);
  await page.waitForSelector('.title-screen, .game, .hero-screen, .teacher');
  return errors;
}
const dd = (page: Page, fn: string) => page.evaluate(`(() => { const d = window.__dd; ${fn} })()`);
async function choose(page: Page, text: string | RegExp) {
  await page.locator('.choices button', { hasText: text }).first().click();
}

test('титул и «Экспозиция» от музея до финала в кассе', async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByRole('heading', { name: 'Двойное дно' })).toBeVisible();
  await page.screenshot({ path: join(SHOTS, '01-title.png') });
  await page.getByText('Экспозиция').first().click();
  await page.waitForSelector('.game');
  await dd(page, `d.ctl.openHotspot('HS_find')`);
  await choose(page, 'Открыть папку');
  await expect(page.locator('.loc-title')).toContainText('Подвал');
  await page.waitForTimeout(800);
  // подсказка подсвечивает предметы; осмотр печи и стола через колонку текста
  await page.getByRole('button', { name: /Подсказка/ }).click();
  await page.screenshot({ path: join(SHOTS, '02-exhibit-cellar.png') });
  for (const hs of ['HS_press', 'HS_desk', 'HS_stove']) {
    await dd(page, `d.ctl.openHotspot('${hs}')`);
    const first = page.locator('.choices button').first();
    const txt = await first.textContent();
    if (txt && !/Осмотреть/.test(txt)) await first.click();
    await choose(page, 'Осмотреть и описать');
  }
  await expect(page.locator('.feed')).toContainText('В записную книжку');
  // к кассе — финал
  await dd(page, `d.ctl.travel('bank')`);
  await dd(page, `d.ctl.ink.talk('cashier', 'cashier')`);
  await choose(page, 'Сличить найденное');
  await page.locator('.modal label.check:not(.muted) input').first().check();
  await page.locator('.suspect', { hasText: 'Ветлугин' }).click();
  await page.screenshot({ path: join(SHOTS, '03-exhibit-finale.png') });
  await page.getByRole('button', { name: 'Закрыть дело' }).click();
  await expect(page.getByText(/Найдено/)).toBeVisible();
  await page.screenshot({ path: join(SHOTS, '04-exhibit-result.png') });
  expect(errors).toEqual([]);
});

test('«Практикум»: двор, понятые, подвал, снимок, изъятие, папка, разбор', async ({ page }) => {
  const errors = await open(page);
  await page.getByText('Практикум').first().click();
  await page.screenshot({ path: join(SHOTS, '05-hero.png') });
  await page.getByRole('button', { name: 'Приступить' }).click();
  await page.waitForSelector('.game');
  await dd(page, `d.ctl.travel('bank')`);
  await dd(page, `d.ctl.ink.talk('cashier', 'cashier')`);
  await choose(page, 'по порядку');
  await choose(page, 'Сверим номера');
  await page.screenshot({ path: join(SHOTS, '06-bank-dialogue.png') });
  await choose(page, 'Благодарю');
  await dd(page, `d.ctl.travel('yard')`);
  await page.waitForTimeout(600);
  // понятые
  await dd(page, `d.ctl.ink.talk('ershov', 'ershov')`);
  await choose(page, 'понятым');
  await choose(page, 'Пока всё');
  await dd(page, `d.ctl.ink.talk('sychev', 'sychev')`);
  await choose(page, 'понятым');
  await choose(page, 'Задержитесь');
  await choose(page, 'Пока всё');
  // наводящий вопрос дворнику
  await dd(page, `d.ctl.ink.talk('mitrofan', 'mitrofan')`);
  await choose(page, 'Это ведь фотограф');
  await choose(page, 'Расскажи, что видел');
  await page.screenshot({ path: join(SHOTS, '07-yard-dvornik.png') });
  const unreliable = await page.evaluate(() => (window as any).__dd.store.state.value.facts['f_dvornik_two_men']?.unreliable);
  expect(unreliable).toBe(true);
  await choose(page, 'Ступай');
  await dd(page, `d.ctl.travel('cellar')`);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Описать с порога/ }).click();
  await dd(page, `d.store.dispatch({type:'tripod', pos:[1.6,0.8]}); d.ctl.refreshScene();`);
  await dd(page, `d.store.openModal('photo', {})`);
  await page.locator('.modal select').selectOption('PT_room');
  await page.locator('.modal input[type=radio]').first().check();
  await page.locator('.modal input[type=checkbox]').nth(1).check(); // магний
  await page.getByRole('button', { name: /Снять/ }).click();
  await expect(page.locator('.fe-plate img')).toBeVisible();
  await page.getByRole('button', { name: /Лампа/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, '08-cellar-lamp-plate.png') });
  // печь: осмотр и правильное изъятие оттисков
  await dd(page, `d.ctl.openItem('ev03_burnt_proofs')`);
  await choose(page, 'Осмотреть и описать');
  await choose(page, 'Изъять и упаковать');
  await page.getByText('На жёсткую подложку под стекло').click();
  await page.getByText('Плоская коробка').click();
  for (const box of await page.locator('.modal fieldset:nth-of-type(3) input[type=checkbox]').all()) await box.check();
  await page.screenshot({ path: join(SHOTS, '09-collect.png') });
  await page.getByRole('button', { name: /Изъять \(/ }).click();
  const cond = await page.evaluate(() => (window as any).__dd.store.state.value.evidence['ev03_burnt_proofs']);
  expect(cond.collected).toBe(true);
  expect(cond.condition).toBe('intact');
  // книжка и план
  await page.getByRole('button', { name: /Книжка/ }).click();
  await page.getByRole('button', { name: 'План подвала' }).click();
  await page.screenshot({ path: join(SHOTS, '10-plan.png') });
  await page.keyboard.press('Escape');
  // камера следователя: папка и разбор
  await dd(page, `d.ctl.travel('chamber')`);
  await page.getByRole('button', { name: /Папка/ }).click();
  await page.getByRole('button', { name: 'Внести всё осмотренное' }).click();
  await page.getByRole('button', { name: 'Как документ 1913 года' }).click();
  await page.screenshot({ path: join(SHOTS, '11-folder-1913.png') });
  await page.locator('.tabs button', { hasText: 'Сдать дело' }).click();
  await page.locator('.modal button.primary', { hasText: 'Сдать дело' }).click();
  await expect(page.getByText('Разбор дела')).toBeVisible();
  await page.screenshot({ path: join(SHOTS, '12-debrief.png') });
  await expect(page.getByText(/Наводящие вопросы/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('журнал сохраняется и восстанавливается после перезагрузки', async ({ page }) => {
  await open(page);
  await page.getByText('Практикум').first().click();
  await page.getByRole('button', { name: 'Приступить' }).click();
  await dd(page, `d.ctl.travel('bank')`);
  await dd(page, `d.store.dispatch({type:'fact', id:'f_bank_paper', source:'cashier'})`);
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => JSON.stringify((window as any).__dd.store.state.value));
  await page.reload();
  await page.getByText('Продолжить сохранённое следствие').click();
  await page.waitForSelector('.game');
  const after = await page.evaluate(() => JSON.stringify((window as any).__dd.store.state.value));
  expect(after).toBe(before);
});

test('киоск: заставка, автосброс после бездействия', async ({ page }) => {
  await open(page, '?kiosk=1&idle=6').catch(() => {});
  await page.waitForSelector('.attract');
  await page.screenshot({ path: join(SHOTS, '13-kiosk-attract.png') });
  await page.locator('.attract').click();
  await page.waitForSelector('.game');
  await expect(page.locator('.idle-warn')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.attract')).toBeVisible({ timeout: 10_000 });
});

test('режим преподавателя: вход по PIN', async ({ page }) => {
  await open(page, '?mode=teacher');
  await page.locator('input[type=password]').fill('1864');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByText('Журналы студентов')).toBeVisible();
  await page.screenshot({ path: join(SHOTS, '14-teacher.png') });
});
