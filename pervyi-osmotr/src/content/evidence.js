// Улики Эпизода 1, вариант истины «А — инсценировка племянником».
// Методические детали — черновик; помечено TODO(кафедра) там, где нужна проверка.

export const PACKS = {
  paper_env: { label: 'Бумажный конверт', needs: 'envelopes' },
  box: { label: 'Картонная коробка', needs: 'boxes' },
  pe_bag: { label: 'Полиэтиленовый пакет', needs: 'pe_bags' },
  faraday: { label: 'Экранирующий пакет', needs: 'faraday' },
};

// visibility: null — видно сразу; oblique — косой свет фонаря; low_flash — присесть и посветить;
// latent — УФ-источник или косой свет вблизи, затем порошок.
export const EVIDENCE = [
  {
    id: 'ev01_glass', n: 1, title: 'Осколки стекла балконной двери', zone: 'balcony', model: 'glass',
    pos: [3.0, 0.13, 9.0], size: [0.9, 0.04, 0.6], normal: [0, 1, 0], surface: 'concrete',
    visibility: null, kind: 'key', weight: 10, mustCollect: true, docRequired: ['overview', 'node', 'detail'],
    inspect: {
      text: 'Осколки прозрачного стекла толщиной около 4 мм. Основная масса — на полу балкона, на расстоянии до 70 см от двери. В комнате у порога — единичные мелкие осколки. В раме остались фрагменты стекла.',
      facts: ['f_glass_outside'],
    },
    collect: {
      methods: [
        { id: 'frame_and_large', label: 'Крупные осколки и фрагменты из рамы, с пометкой сторон', needs: ['gloves'], ok: true },
        { id: 'sweep', label: 'Смести все осколки в одну кучу и забрать', ok: false, why: 'Утрачено взаиморасположение осколков, стороны не помечены.' },
      ],
      packs: { box: true, paper_env: false, pe_bag: false },
      packWhy: 'Осколки стекла упаковывают в жёсткую тару (коробку), каждый с пометкой стороны.',
    },
    exams: ['trace'],
    protocol: { neutral: 'На полу балкона у двери — осколки прозрачного стекла, основная масса на удалении до 70 см от двери; в раме — фрагменты стекла.', conclusion: 'Стекло балконной двери выбито снаружи злоумышленником, проникшим через балкон.' },
  },
  {
    id: 'ev02_snow', n: 2, title: 'Непотревоженный снег на балконе и перилах', zone: 'balcony', model: 'snow',
    pos: [3.2, 0.06, 9.2], size: [3.9, 0.12, 1.15], normal: [0, 1, 0], surface: 'snow',
    visibility: null, kind: 'record', weight: 10, mustCollect: false, docRequired: ['overview', 'node'],
    inspect: { text: 'Снег на полу балкона и на перилах лежит ровным слоем 3–4 см, следов на нём нет.', facts: ['f_snow_intact'] },
    collect: null, exams: [],
    protocol: { neutral: 'На полу балкона и перилах — снег слоем 3–4 см, следы на поверхности снега не обнаружены.' },
  },
  {
    id: 'ev03_lock', n: 3, title: 'Замок входной двери', zone: 'landing', model: 'lock',
    pos: [1.06, 0.95, -0.82], size: [0.06, 0.18, 0.1], normal: [1, 0, 0], surface: 'metal',
    visibility: null, kind: 'record', weight: 6, mustCollect: false, docRequired: ['node', 'detail'],
    inspect: {
      needs: 'magnifier',
      text: 'Под лупой и в свете фонаря: на лицевой накладке и цилиндре замка следов воздействия посторонних предметов нет, ригель в исходном положении, дверная коробка без повреждений.',
      textWithout: 'Невооружённым глазом явных повреждений не видно. Для уверенного вывода нужна лупа.',
      facts: ['f_no_forced_entry'],
    },
    collect: {
      methods: [
        { id: 'cylinder', label: 'Демонтировать цилиндровый механизм', needs: ['tools', 'gloves'], ok: true },
        { id: 'record', label: 'Не изымать, зафиксировать в протоколе', ok: true },
      ],
      packs: { box: true, paper_env: true, pe_bag: false },
      packWhy: 'Механизм замка — в коробку или конверт, чтобы не повредить трассы.',
    },
    exams: ['trace'],
    protocol: { neutral: 'Замок входной двери видимых повреждений не имеет, ригель в исходном положении, дверная коробка без повреждений.', conclusion: 'Следов взлома нет — дверь открыта своим ключом.' },
  },
  {
    id: 'ev04_shoeprint', n: 4, title: 'След подошвы обуви', zone: 'hall', model: 'shoeprint',
    pos: [0.76, 0.006, 2.0], size: [0.13, 0.01, 0.31], normal: [0, 1, 0], surface: 'linoleum',
    visibility: 'oblique', kind: 'key', weight: 12, mustCollect: true, docRequired: ['overview', 'node', 'detail'],
    inspect: { text: 'Поверхностный след подошвы, образованный веществом бурого цвета. Рисунок — «ёлочка» с кольцевым элементом в пяточной части, длина около 29 см (≈ 43 размер).', facts: ['f_shoeprint_43'] },
    collect: {
      methods: [
        { id: 'gel', label: 'Скопировать на следокопирующую плёнку (после масштабной съёмки)', needs: ['gel_film'], ok: true },
        { id: 'photo_only', label: 'Только масштабная фотосъёмка', ok: true, partial: true },
        { id: 'scrape', label: 'Соскоблить вещество скальпелем', needs: ['tweezers'], ok: false, why: 'Рисунок протектора уничтожен.' },
      ],
      packs: { paper_env: true, box: true, pe_bag: false },
      packWhy: 'Плёнку со следом — в бумажный конверт или коробку.',
    },
    exams: ['trace'], dna: false,
    protocol: { neutral: 'На полу прихожей — поверхностный след подошвы обуви, образованный веществом бурого цвета, длиной 29 см.', conclusion: 'Кровавый след кроссовки преступника 43 размера.' },
  },
  {
    id: 'ev05_stain', n: 5, title: 'Пятна бурого цвета на углу тумбы', zone: 'hall', model: 'stain',
    pos: [0.46, 0.74, 2.32], size: [0.03, 0.08, 0.06], normal: [1, 0, 0], surface: 'laminate',
    visibility: null, kind: 'key', weight: 10, mustCollect: true, docRequired: ['node', 'detail'], dna: true,
    inspect: { text: 'На верхнем переднем углу тумбы — пятна вещества бурого цвета, на ребре — несколько волос. Брызг на стенах и потолке нет.', facts: ['f_stain_corner'] },
    collect: {
      methods: [
        { id: 'swab_dry', label: 'Смыв на стерильный тампон + контрольный тампон, высушить', needs: ['swabs', 'gloves', 'mask'], ok: true },
        { id: 'swab_wet', label: 'Смыв на тампон, сразу упаковать влажным', needs: ['swabs'], ok: true, wet: true },
      ],
      packs: { paper_env: true, box: true, pe_bag: false },
      packWhy: 'Биологический объект сушат и упаковывают в бумагу. Во влажном виде в полиэтилене он загнивает.',
    },
    exams: ['bio', 'dna'],
    protocol: { neutral: 'На верхнем переднем углу тумбы — пятна вещества бурого цвета и волосы; брызг на стенах и потолке не обнаружено.', conclusion: 'На углу тумбы кровь потерпевшего — он ударился об угол.' },
  },
  {
    id: 'ev06_butt', n: 6, title: 'Окурок в блюдце', zone: 'kitchen', model: 'butt',
    pos: [4.6, 0.79, 2.4], size: [0.13, 0.04, 0.13], normal: [0, 1, 0], surface: 'ceramic',
    visibility: null, kind: 'key', weight: 9, mustCollect: true, docRequired: ['node', 'detail'], dna: true,
    inspect: { text: 'Окурок сигареты с фильтром, на фильтре надпись «ЯВА». Блюдце используется как пепельница, других окурков нет.', facts: ['f_butt'] },
    collect: {
      methods: [
        { id: 'tweezers', label: 'Пинцетом, в перчатках и маске', needs: ['tweezers', 'gloves', 'mask'], ok: true },
        { id: 'hand', label: 'Рукой в перчатке', needs: ['gloves'], ok: false, why: 'Высокий риск переноса биоматериала, без маски — загрязнение.' },
      ],
      packs: { paper_env: true, box: true, pe_bag: false },
      packWhy: 'Окурок — в бумажный конверт, отдельно от других объектов.',
    },
    exams: ['dna'],
    protocol: { neutral: 'На столе в кухне — блюдце с окурком сигареты с фильтром, на фильтре надпись «ЯВА».' },
  },
  {
    id: 'ev07_cup', n: 7, title: 'Вторая чашка в сушилке', zone: 'kitchen', model: 'cups',
    pos: [5.88, 0.97, 1.0], size: [0.3, 0.12, 0.18], normal: [-1, 0, 0], surface: 'ceramic',
    visibility: null, kind: 'record', weight: 5, mustCollect: false, docRequired: ['node'],
    inspect: { touch: true, text: 'В сушилке две чашки. На ощупь (в перчатке) одна сухая, вторая — влажная: её недавно вымыли.', textWithout: 'В сушилке две чашки. Чтобы понять больше, проверьте их на ощупь — только в перчатках.', facts: ['f_second_cup'] },
    collect: null, exams: [],
    protocol: { neutral: 'В сушилке для посуды — две чашки, одна из которых влажная.' },
  },
  {
    id: 'ev08_dust', n: 8, title: 'Пыльный контур на полке стеллажа', zone: 'room', model: 'dust',
    pos: [5.98, 1.215, 5.9], size: [0.24, 0.01, 0.32], normal: [0, 1, 0], surface: 'wood',
    visibility: 'oblique', kind: 'key', weight: 7, mustCollect: false, docRequired: ['node', 'detail'], measure: true,
    inspect: { text: 'На полке, покрытой слоем пыли, — чистый прямоугольный участок 32×24 см: здесь долго стоял предмет, недавно убранный.', facts: ['f_dust_outline'] },
    collect: null, exams: [],
    protocol: { neutral: 'На третьей полке стеллажа — свободный от пыли прямоугольный участок размером 32×24 см.' },
  },
  {
    id: 'ev09_valuables', n: 9, title: 'Шкатулка с деньгами и ноутбук', zone: 'room', model: 'valuables',
    pos: [-1.3, 0.8, 7.1], size: [0.5, 0.12, 0.6], normal: [0, 1, 0], surface: 'wood',
    visibility: null, kind: 'record', weight: 6, mustCollect: false, docRequired: ['overview'],
    inspect: { text: 'На столе — открытая шкатулка с деньгами (купюры видны сверху) и ноутбук. Следов того, что их искали, нет.', facts: ['f_valuables_intact'] },
    collect: null, exams: [],
    protocol: { neutral: 'На письменном столе — шкатулка с денежными купюрами и ноутбук; ящики стола закрыты, вещи не разбросаны.' },
  },
  {
    id: 'ev10_prints', n: 10, title: 'Следы пальцев на шпингалете и стекле двери', zone: 'room', model: 'prints',
    pos: [2.68, 1.15, 8.56], size: [0.12, 0.16, 0.02], normal: [0, 0, -1], surface: 'glass_paint',
    visibility: 'latent', kind: 'key', weight: 10, mustCollect: true, docRequired: ['detail'], latent: true,
    inspect: { text: 'Потожировые следы пальцев рук на внутренней стороне стекла и на окрашенном шпингалете балконной двери.', facts: ['f_prints_inside'] },
    collect: {
      methods: [
        { id: 'film', label: 'Перенести на дактилоплёнку, на подложку с надписью', needs: ['dacto_film'], needsPowder: true, ok: true },
        { id: 'photo_only', label: 'Только детальная съёмка с масштабом', ok: true, partial: true },
      ],
      packs: { paper_env: true, box: false, pe_bag: false },
      packWhy: 'Дактилоплёнку на подложке — в бумажный конверт.',
    },
    exams: ['dacto'],
    protocol: { neutral: 'На внутренней стороне стекла и на шпингалете балконной двери выявлены следы папиллярных узоров.' },
  },
  {
    id: 'ev10s_shelf_prints', n: 16, title: 'Следы пальцев на стекле стеллажа', zone: 'room', model: 'prints',
    pos: [5.79, 1.35, 6.1], size: [0.02, 0.15, 0.15], normal: [-1, 0, 0], surface: 'glass',
    visibility: 'latent', kind: 'key', weight: 6, mustCollect: true, docRequired: ['detail'], latent: true,
    inspect: { text: 'Следы пальцев рук на стеклянной дверце стеллажа, у ручки.', facts: ['f_prints_shelf'] },
    collect: {
      methods: [
        { id: 'film', label: 'Перенести на дактилоплёнку, на подложку с надписью', needs: ['dacto_film'], needsPowder: true, ok: true },
        { id: 'photo_only', label: 'Только детальная съёмка с масштабом', ok: true, partial: true },
      ],
      packs: { paper_env: true, box: false, pe_bag: false },
      packWhy: 'Дактилоплёнку на подложке — в бумажный конверт.',
    },
    exams: ['dacto'],
    protocol: { neutral: 'На стеклянной дверце стеллажа у ручки выявлены следы папиллярных узоров.' },
  },
  {
    id: 'ev11_receipt', n: 11, title: 'Квитанция ГСК «Мотор»', zone: 'hall', model: 'receipt',
    pos: [2.78, 0.004, 0.9], size: [0.09, 0.005, 0.14], normal: [0, 1, 0], surface: 'linoleum',
    visibility: 'low_flash', kind: 'key', weight: 8, mustCollect: true, docRequired: ['node', 'detail'],
    inspect: { text: 'Квитанция об оплате членских взносов ГСК «Мотор», бокс № 47, плательщик «Ланской К. В.», дата: 19.11, 20:40.', facts: ['f_receipt'] },
    collect: {
      methods: [{ id: 'tweezers', label: 'Пинцетом за край', needs: ['tweezers', 'gloves'], ok: true }, { id: 'hand', label: 'Рукой в перчатке', needs: ['gloves'], ok: true }],
      packs: { paper_env: true, box: true, pe_bag: false },
      packWhy: 'Бумажный документ — в бумажный конверт (возможны следы пальцев).',
    },
    exams: ['dacto'],
    protocol: { neutral: 'На полу под вешалкой — квитанция ГСК «Мотор» об оплате взносов за бокс № 47 на имя «Ланской К. В.» от 19.11.' },
  },
  {
    id: 'ev12_phone', n: 12, title: 'Мобильный телефон потерпевшего', zone: 'room', model: 'phone',
    pos: [3.4, 0.47, 5.7], size: [0.08, 0.02, 0.16], normal: [0, 1, 0], surface: 'plastic',
    visibility: null, kind: 'key', weight: 8, mustCollect: true, docRequired: ['node', 'detail'],
    inspect: { text: 'Телефон включён, экран заблокирован. На экране уведомление: «Пропущенный вызов: Кирюша, вчера 21:14». Заряд 31 %.', facts: ['f_phone_call'] },
    collect: {
      methods: [
        { id: 'faraday_on', label: 'С участием специалиста: зафиксировать состояние, авиарежим не включать, сразу экранирующий пакет', needs: ['faraday'], ok: true },
        { id: 'switch_off', label: 'Выключить телефон и забрать', ok: false, why: 'При выключении можно утратить данные и столкнуться с блокировкой при включении.' },
        { id: 'unlock', label: 'Попробовать разблокировать и посмотреть звонки', ok: false, why: 'Самостоятельное исследование содержимого недопустимо: изменение данных устройства.' },
      ],
      packs: { faraday: true, paper_env: false, pe_bag: false, box: false },
      packWhy: 'Включённое устройство без экранирования может быть удалённо очищено.',
    },
    exams: ['ctech'],
    protocol: { neutral: 'На журнальном столике — мобильный телефон в корпусе чёрного цвета, включён, экран заблокирован, на экране уведомление о пропущенном вызове от абонента «Кирюша» (вчера, 21:14).' },
  },
  // Ложные следы — нужно отделить и отразить происхождение.
  {
    id: 'L1_bandage', n: 0, title: 'Упаковка от бинта и перчатки', zone: 'hall', model: 'bandage',
    pos: [2.1, 0.02, 3.3], size: [0.25, 0.03, 0.18], normal: [0, 1, 0], surface: 'linoleum',
    visibility: null, kind: 'false', origin: 'medics', weight: 0, mustCollect: false, docRequired: [],
    inspect: { text: 'Вскрытая упаковка стерильного бинта и пара медицинских перчаток.', facts: [] },
    collect: null, exams: [],
    protocol: { neutral: 'На полу прихожей — упаковка от бинта и медицинские перчатки, оставленные бригадой скорой помощи.' },
  },
  {
    id: 'L2_boots', n: 0, title: 'Следы ботинок от входа к санузлу', zone: 'hall', model: 'boots',
    pos: [0.6, 0.006, 1.2], size: [0.9, 0.01, 0.9], normal: [0, 1, 0], surface: 'linoleum',
    visibility: null, kind: 'false', origin: 'police', weight: 0, mustCollect: false, docRequired: [],
    inspect: { text: 'Грязные следы обуви с крупным рельефным протектором ведут от входной двери к санузлу.', facts: [] },
    collect: null, exams: [],
    protocol: { neutral: 'От входной двери к санузлу — следы обуви с крупным протектором, оставленные участковым уполномоченным Беловым.' },
  },
  {
    id: 'L4_water', n: 0, title: 'Вода на раковине в санузле', zone: 'bath', model: 'water',
    pos: [-1.2, 0.86, 0.6], size: [0.4, 0.02, 0.3], normal: [0, 1, 0], surface: 'ceramic',
    visibility: null, kind: 'false', origin: 'police', weight: 0, mustCollect: false, docRequired: [],
    inspect: { text: 'На раковине и на полу у раковины — капли воды. Полотенце смято.', facts: [] },
    collect: null, exams: [],
    protocol: { neutral: 'В санузле на раковине — капли воды; со слов участкового Белова, он мыл руки.' },
  },
];

export const ORIGINS = {
  medics: 'бригада скорой помощи',
  police: 'участковый уполномоченный',
  neighbor: 'соседка',
};

// Матрица «порошок × поверхность»: excellent | weak | none. TODO(кафедра): утвердить.
export const SURFACES = {
  glass_paint: { name: 'стекло и окрашенный металл', powder_dark: 'weak', powder_light: 'excellent', powder_magnetic: 'none' },
  glass: { name: 'стекло', powder_dark: 'excellent', powder_light: 'excellent', powder_magnetic: 'weak' },
};

export const EXAMS = {
  trace: 'Трасологическая',
  bio: 'Судебно-биологическая',
  dna: 'Молекулярно-генетическая (ДНК)',
  dacto: 'Дактилоскопическая',
  ctech: 'Компьютерно-техническая',
  fizchem: 'Физико-химическая',
};
