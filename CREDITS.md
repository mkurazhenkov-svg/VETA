# Источники и лицензии

## Код и движок

| Что | Версия | Лицензия | Источник |
|---|---|---|---|
| Phaser (игровой движок) | 3.90.0 | MIT | https://phaser.io, https://github.com/phaserjs/phaser |
| Vite (сборка, в игру не входит) | 8.3.2 | MIT | https://vite.dev |
| vite-plugin-singlefile (сборка в один файл, в игру не входит) | 2.3.3 | MIT | https://github.com/richardtallent/vite-plugin-singlefile |

## Шрифты (встроены в файл игры)

| Шрифт | Назначение | Лицензия | Источник |
|---|---|---|---|
| Manrope (500, 700, 800; кириллица и латиница) | временная замена фирменного Museo Sans Cyrl | SIL Open Font License 1.1 | © 2019 The Manrope Project Authors, https://github.com/sharanda/manrope (пакет @fontsource/manrope 5.3.0) |
| Pixelify Sans (500, 700; кириллица и латиница) | пиксельные счётчики в интерфейсе | SIL Open Font License 1.1 | © 2021 The Pixelify Sans Project Authors, https://github.com/eifetx/Pixelify-Sans (пакет @fontsource/pixelify-sans 5.3.0) |

Фирменный шрифт Museo Sans Cyrl не используется до получения веб-лицензии (см. DECISIONS.md).

## Графика и звук

Сторонних картинок и звуков нет. Весь пиксель-арт (герой, волки, овцы, босс, тайлы, фоны, предметы, иконки)
рисуется кодом в `src/gfx/`. Все звуки генерируются кодом через WebAudio в `src/audio/sfx.js`.

Голова героя может быть получена из фотографии А. Терентьева скриптом `tools/make_sprite.py`
(согласие на использование образа получено, см. SPEC.md, раздел 4.1). Само фото в репозиторий не кладётся.

## Фирменный стиль

Палитра и правила угловых рамок — по «Руководству по фирменному стилю VETA» (бюро Flavita, 09.2019).
Логотип VETA не перерисовывается: до передачи официального файла стоит текстовая заглушка «VETA».
