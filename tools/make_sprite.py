#!/usr/bin/env python3
"""
Генерация спрайта героя с головой из фото.

Что делает:
  1. Берёт фото assets/source/terentyev.jpg или .png (анфас, нейтральный или вырезанный прозрачный фон).
  2. Находит голову, вырезает лицо, уменьшает до 12 px по ширине.
  3. Переводит цвета в фирменную палитру VETA + 4 оттенка кожи.
  4. Накладывает лицо на тело-шаблон (assets/sprites/hero_template.json) во всех 15 кадрах.
  5. Сохраняет:
       assets/sprites/hero.png           — спрайтшит 15 кадров 32×48 (его берёт игра)
       assets/sprites/hero_portrait.png  — портрет 96×96 для диалогов
       assets/sprites/hero_preview.png   — крупное превью для проверки глазами

Запуск: npm run sprite   (или: python3 tools/make_sprite.py)
Если голова нашлась неудачно, можно указать рамку лица вручную (в пикселях исходного фото):
  python3 tools/make_sprite.py --crop 410,220,380,450

Если фото нет — скрипт ничего не ломает: игра использует обезличенного «Прораба».
"""
import argparse
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TEMPLATE = os.path.join(ROOT, 'assets', 'sprites', 'hero_template.json')
OUT_SHEET = os.path.join(ROOT, 'assets', 'sprites', 'hero.png')
OUT_PORTRAIT = os.path.join(ROOT, 'assets', 'sprites', 'hero_portrait.png')
OUT_PREVIEW = os.path.join(ROOT, 'assets', 'sprites', 'hero_preview.png')
DEFAULT_PHOTO = os.path.join(ROOT, 'assets', 'source', 'terentyev.jpg')

try:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageDraw
except ImportError:
    print('Нужна библиотека Pillow. Установите её командой:  pip install pillow')
    print('Игра при этом продолжит работать с обезличенным героем.')
    sys.exit(0)


def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def palette_image(colors):
    flat = []
    for c in colors:
        flat.extend(c)
    # Дополняем палитру повтором первого цвета, чтобы не появлялся «лишний» чёрный.
    while len(flat) < 768:
        flat.extend(colors[0])
    img = Image.new('P', (1, 1))
    img.putpalette(flat[:768])
    return img


def quantize(img, colors):
    pal = palette_image(colors)
    q = img.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE)
    return q.convert('RGB')


def color_dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def border_color(img):
    """Цвет фона — медиана пикселей по краю фото."""
    w, h = img.size
    px = img.load()
    samples = []
    step = max(1, min(w, h) // 60)
    m = max(1, min(w, h) // 30)
    for x in range(0, w, step):
        for y in list(range(0, m)) + list(range(h - m, h)):
            samples.append(px[x, y])
    for y in range(0, h, step):
        for x in list(range(0, m)) + list(range(w - m, w)):
            samples.append(px[x, y])
    samples.sort(key=lambda c: c[0] + c[1] + c[2])
    return samples[len(samples) // 2]


def foreground_mask(img, bg, threshold=48):
    w, h = img.size
    px = img.load()
    mask = Image.new('L', (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            if color_dist(px[x, y], bg) > threshold:
                mp[x, y] = 255
    # Убираем шум.
    mask = mask.filter(ImageFilter.MedianFilter(5))
    return mask


def detect_head_cv2(photo):
    try:
        import cv2  # noqa
        import numpy as np  # noqa
    except Exception:
        return None
    arr = np.array(photo.convert('RGB'))[:, :, ::-1]
    gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(40, 40))
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    # Haar находит овал лица без волос — расширяем до «макушка–подбородок».
    top = y - int(h * 0.35)
    return {'cx': x + w / 2, 'top': max(0, top), 'width': w * 1.1, 'chin': y + h * 1.02}


def silhouette_mask(photo, alpha=None):
    """Маска человека на фото: из прозрачности (если фон вырезан) или по отличию от цвета фона."""
    if alpha is not None:
        return alpha.point(lambda v: 255 if v > 100 else 0)
    small = photo.copy()
    scale = 400 / max(small.size)
    if scale < 1:
        small = small.resize((max(1, int(small.width * scale)), max(1, int(small.height * scale))), Image.LANCZOS)
    mask = foreground_mask(small, border_color(small))
    return mask.resize(photo.size, Image.NEAREST)


def detect_head(photo, fg):
    """Ищет голову на фото: OpenCV (если установлен) или по силуэту."""
    found = detect_head_cv2(photo)
    if found:
        print('Голова найдена (OpenCV).')
        return found
    scale = min(1, 400 / max(photo.size))
    mask = fg.resize((max(1, int(fg.width * scale)), max(1, int(fg.height * scale))), Image.NEAREST)
    bbox = mask.getbbox()
    if not bbox:
        return None
    w, h = mask.size
    mp = mask.load()
    x0, y0, x1, y1 = bbox
    spans = []
    for y in range(y0, y1):
        xs = [x for x in range(x0, x1) if mp[x, y] > 0]
        if len(xs) > 2:
            spans.append((y, xs[0], xs[-1]))
        else:
            spans.append((y, None, None))
    # Голова — верхняя часть силуэта до «плеч», где ширина резко растёт.
    band = [s for s in spans if s[1] is not None][: max(4, int((y1 - y0) * 0.45))]
    if not band:
        return None
    widths = [s[2] - s[1] for s in band]
    head_w = sorted(widths[: max(3, len(widths) * 2 // 3)])[-1]
    best = max(band[: max(3, len(band) * 2 // 3)], key=lambda s: s[2] - s[1])
    cx = (best[1] + best[2]) / 2
    top = band[0][0]
    print(f'Голова найдена по силуэту: центр {cx / scale:.0f}, макушка {top / scale:.0f}, ширина {head_w / scale:.0f} px. Если неточно — укажите --crop.')
    return {'cx': cx / scale, 'top': top / scale, 'width': head_w / scale, 'chin': (top + head_w * 1.3) / scale}


def crop_face(photo, head, aspect):
    w = head['width']
    h = (head['chin'] - head['top']) if head.get('chin') else w * 1.3
    h = max(h, w * aspect * 0.95)
    x0 = head['cx'] - w / 2
    return photo.crop((int(x0), int(head['top']), int(x0 + w), int(head['top'] + h)))


def make_face(photo, head, fw, fh, colors, fg):
    face = crop_face(photo, head, fh / fw)
    face_fg = crop_face(fg, head, fh / fw).resize((fw, fh), Image.BOX)
    face = ImageEnhance.Contrast(face).enhance(1.35)
    face = ImageEnhance.Color(face).enhance(1.3)
    face = face.filter(ImageFilter.SHARPEN)
    small = face.resize((fw, fh), Image.LANCZOS)
    # Прозрачность: фон вокруг головы и углы вне овала.
    alpha = Image.new('L', (fw, fh), 0)
    ImageDraw.Draw(alpha).ellipse((0, 0, fw - 1, fh - 1), fill=255)
    sp = small.load()
    ap = alpha.load()
    mp = face_fg.load()
    for y in range(fh):
        for x in range(fw):
            if mp[x, y] < 128:
                ap[x, y] = 0
    # Усиливаем тёмные черты (глаза, брови, усы), иначе на лице 12 px они растворяются в коже.
    lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    inside = [lum(sp[x, y]) for y in range(fh) for x in range(fw) if ap[x, y] > 0]
    if inside:
        med = sorted(inside)[len(inside) // 2]
        for y in range(fh):
            for x in range(fw):
                if ap[x, y] > 0 and lum(sp[x, y]) < med * 0.78:
                    r, g, b = sp[x, y]
                    sp[x, y] = (int(r * 0.45), int(g * 0.45), int(b * 0.45))
    q = quantize(small, colors)
    return q, alpha


def compose(template, face_img, face_alpha):
    fw_, fh_ = template['frameWidth'], template['frameHeight']
    n = len(template['frames'])
    pal = {k: hex_to_rgb(v) for k, v in template['palette'].items()}
    outline = hex_to_rgb(template['outline'])
    sheet = Image.new('RGBA', (fw_ * n, fh_), (0, 0, 0, 0))
    for i in range(n):
        frame = Image.new('RGBA', (fw_, fh_), (0, 0, 0, 0))
        fp = frame.load()

        def draw_rows(rows):
            for y, row in enumerate(rows):
                for x, ch in enumerate(row):
                    if ch != '.':
                        fp[x, y] = pal[ch] + (255,)

        draw_rows(template['body'][i])
        if face_img is None:
            draw_rows(template['generic'][i])
        else:
            fr = template['face'][i]
            src = face_img.load()
            al = face_alpha.load()
            for y in range(face_img.height):
                for x in range(face_img.width):
                    if al[x, y] > 0:
                        X, Y = fr['x'] + x, fr['y'] + y
                        if 0 <= X < fw_ and 0 <= Y < fh_:
                            fp[X, Y] = src[x, y] + (255,)
        draw_rows(template['helmet'][i])
        # Обводка силуэта.
        copy = frame.copy().load()
        for y in range(fh_):
            for x in range(fw_):
                if copy[x, y][3] != 0:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if 0 <= X < fw_ and 0 <= Y < fh_ and copy[X, Y][3] != 0:
                        fp[x, y] = outline + (255,)
                        break
        sheet.paste(frame, (i * fw_, 0))
    return sheet


def make_portrait(photo, head, colors, fg, size=96):
    w = head['width']
    side = w * 2.1
    x0 = head['cx'] - side / 2
    y0 = head['top'] - w * 0.18
    box = (int(x0), int(y0), int(x0 + side), int(y0 + side))
    crop = ImageEnhance.Contrast(photo.crop(box)).enhance(1.2)
    low = crop.resize((size // 2, size // 2), Image.LANCZOS)
    low_fg = fg.crop(box).resize((size // 2, size // 2), Image.BOX)
    blue_deep = hex_to_rgb('#024f99')
    lp = low.load()
    mp = low_fg.load()
    for y in range(low.height):
        for x in range(low.width):
            if mp[x, y] < 128:
                lp[x, y] = blue_deep
    q = quantize(low, colors + [blue_deep])
    return q.resize((size, size), Image.NEAREST)


def main():
    ap = argparse.ArgumentParser(description='Спрайт героя из фото')
    ap.add_argument('--photo', default=DEFAULT_PHOTO, help='путь к фото (по умолчанию assets/source/terentyev.jpg)')
    ap.add_argument('--crop', help='рамка лица вручную: x,y,ширина,высота (в пикселях фото)')
    args = ap.parse_args()

    if not os.path.exists(TEMPLATE):
        print('Нет шаблона героя. Запустите команду npm run sprite (она создаст шаблон).')
        sys.exit(1)
    with open(TEMPLATE, encoding='utf-8') as f:
        template = json.load(f)

    photo_path = args.photo
    if not os.path.exists(photo_path):
        for ext in ('.jpeg', '.png', '.JPG', '.JPEG', '.PNG'):
            alt = os.path.splitext(photo_path)[0] + ext
            if os.path.exists(alt):
                photo_path = alt
                break
    if not os.path.exists(photo_path):
        print('Фото не найдено: assets/source/terentyev.jpg')
        print('Это не ошибка: игра использует обезличенного героя «Прораб».')
        print('Положите фото в эту папку и запустите команду ещё раз.')
        return

    src = ImageOps.exif_transpose(Image.open(photo_path))
    alpha = None
    if src.mode in ('RGBA', 'LA') or (src.mode == 'P' and 'transparency' in src.info):
        src = src.convert('RGBA')
        alpha = src.getchannel('A')
        if alpha.getextrema()[0] < 250:
            print('Фон на фото прозрачный — используем его как готовую маску человека.')
            white = Image.new('RGBA', src.size, (255, 255, 255, 255))
            white.alpha_composite(src)
            src = white
        else:
            alpha = None
    photo = src.convert('RGB')
    fg = silhouette_mask(photo, alpha)
    if args.crop:
        x, y, w, h = [float(v) for v in args.crop.split(',')]
        head = {'cx': x + w / 2, 'top': y, 'width': w, 'chin': y + h}
    else:
        head = detect_head(photo, fg)
    if not head:
        print('Не удалось найти голову на фото. Укажите рамку вручную: --crop x,y,ширина,высота')
        sys.exit(1)

    q = template['quantize']
    # Лицо: оттенки кожи + нейтральные цвета палитры (чёрный, серые, белый).
    # Красный и синий исключены, иначе губы и тени на 12 пикселях превращаются в «пятна».
    # Средние серые тоже исключены: тень на щеке должна стать тёмной кожей, а не серым пятном.
    neutral = [c for c in q['brand'] if (lambda r, g, b: max(r, g, b) - min(r, g, b) < 24 and (r < 80 or r > 250))(*hex_to_rgb(c))]
    face_colors = [hex_to_rgb(c) for c in neutral + q['skin']]
    # Портрет крупнее: берём всю палитру, кроме красного (одежда — серые и синие, лицо — кожа).
    not_red = [c for c in q['brand'] if (lambda r, g, b: not (r > g + 80 and r > b + 60))(*hex_to_rgb(c))]
    portrait_colors = [hex_to_rgb(c) for c in not_red + q['skin']]
    fr = template['face'][0]
    face_img, face_alpha = make_face(photo, head, fr['w'], fr['h'], face_colors, fg)
    sheet = compose(template, face_img, face_alpha)
    os.makedirs(os.path.dirname(OUT_SHEET), exist_ok=True)
    sheet.save(OUT_SHEET)
    portrait = make_portrait(photo, head, portrait_colors, fg)
    portrait.save(OUT_PORTRAIT)

    # Превью для проверки глазами: кадры ×6 на фирменном синем фоне + портрет.
    scale = 6
    fw_, fh_ = template['frameWidth'], template['frameHeight']
    show = [0, 2, 4, 8, 10, 13]
    pw = len(show) * fw_ * scale + 96 * 2 + 40
    prev = Image.new('RGB', (pw, max(fh_ * scale, 192) + 20), hex_to_rgb('#024f99'))
    for i, f in enumerate(show):
        fr_img = sheet.crop((f * fw_, 0, (f + 1) * fw_, fh_)).resize((fw_ * scale, fh_ * scale), Image.NEAREST)
        prev.paste(fr_img, (10 + i * fw_ * scale, 10), fr_img)
    prev.paste(portrait.resize((192, 192), Image.NEAREST), (len(show) * fw_ * scale + 30, 10))
    prev.save(OUT_PREVIEW)

    print('Готово!')
    print('  спрайтшит:', os.path.relpath(OUT_SHEET, ROOT))
    print('  портрет:  ', os.path.relpath(OUT_PORTRAIT, ROOT))
    print('  превью:   ', os.path.relpath(OUT_PREVIEW, ROOT), '— откройте и проверьте, узнаваем ли герой')
    print('Теперь соберите игру: npm run build')


if __name__ == '__main__':
    main()
