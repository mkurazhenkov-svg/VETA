// Процессуальные и тактические правила, веса, пороги. Кафедра меняет значения здесь, без правки логики.
// category: procedure | tactics | technique | interview | documentation; severity: minor | major | critical
// source — заполняет кафедра.

const SRC = 'TODO(кафедра): ссылка на норму / учебник';

export const RULES = {
  R_NO_GUARD: { title: 'Не обеспечена охрана места происшествия', category: 'procedure', severity: 'minor', penalty: 3,
    explain: 'До выезда дайте дежурному указание обеспечить охрану места, по прибытии — оградите его и удалите посторонних.', source: SRC },
  R_BASIS: { title: 'Осмотр жилища начат без надлежащего основания', category: 'procedure', severity: 'critical', penalty: 15,
    explain: 'Жилище осматривают с согласия проживающих или по судебному решению, кроме случаев ч. 5 ст. 165 УПК РФ. Соседка и племянник согласие дать не вправе — они не проживают в квартире. Правильный вариант для этой ситуации утверждает кафедра.', source: 'ст. 12, ч. 5 ст. 165, ч. 5 ст. 177 УПК РФ; ' + SRC },
  R_NO_FIXATION: { title: 'Без понятых и без видеофиксации', category: 'procedure', severity: 'critical', penalty: 15,
    explain: 'Если понятые не участвуют, применение технических средств фиксации обязательно (ч. 1.1 ст. 170 УПК РФ).', source: 'ч. 1.1 ст. 170, ст. 177 УПК РФ' },
  R_VIDEO_GAP: { title: 'Изъятие в момент, когда видеозапись не велась (без понятых)', category: 'procedure', severity: 'major', penalty: 6,
    explain: 'При осмотре без понятых ход изъятия должен быть зафиксирован непрерывно. Следите за зарядом аккумулятора.', source: 'ч. 1.1 ст. 170 УПК РФ' },
  R_NO_INTRO: { title: 'Нет вступительного слова на видеозаписи', category: 'documentation', severity: 'minor', penalty: 2,
    explain: 'В начале записи озвучьте дату, время, место, участников и применяемые средства.', source: SRC },
  R_NO_PPE: { title: 'Вход на место осмотра без перчаток и бахил', category: 'technique', severity: 'major', penalty: 5,
    explain: 'Средства защиты надевают до входа: иначе вы оставляете свои следы и уничтожаете чужие.', source: SRC },
  R_CHANGES_UNKNOWN: { title: 'Не выяснены изменения обстановки до прибытия СОГ', category: 'tactics', severity: 'major', penalty: 5,
    explain: 'Спросите прямо у первого прибывшего (участкового) и медиков, кто где ходил и что трогал. Иначе их следы попадут в протокол как следы преступника.', source: SRC },
  R_TOUCH_BEFORE_PHOTO: { title: 'Объект изъят до фиксации исходного положения', category: 'tactics', severity: 'major', penalty: 4,
    explain: 'Сначала обзорная и узловая съёмка, затем изменение положения объекта.', source: SRC },
  R_NO_GLOVES: { title: 'Касание объекта без перчаток', category: 'technique', severity: 'major', penalty: 4,
    explain: 'Без перчаток на объекте остаются ваши потожировые следы и биоматериал.', source: SRC },
  R_CROSS_DNA: { title: 'Перчатки не сменены между ДНК-объектами', category: 'technique', severity: 'minor', penalty: 2,
    explain: 'Между отбором разных биологических объектов перчатки меняют, чтобы не перенести биоматериал.', source: SRC },
  R_FRAGILE: { title: 'След уничтожен: шаг по хрупкой зоне без мостков', category: 'tactics', severity: 'major', penalty: 5,
    explain: 'Определите дорожку движения и используйте переходные мостки там, где могут быть следы.', source: SRC },
  R_DOOR_PRINTS: { title: 'Балконная дверь открыта до обработки шпингалета', category: 'tactics', severity: 'major', penalty: 5,
    explain: 'Шпингалет и ручка — вероятные места следов рук. Сначала выявление и изъятие следов, потом — манипуляции с дверью.', source: SRC },
  R_BAD_METHOD: { title: 'Неверный способ изъятия', category: 'technique', severity: 'major', penalty: 4, explain: 'Способ изъятия должен сохранять признаки следа.', source: SRC },
  R_PACKAGING: { title: 'Нарушены правила упаковки', category: 'technique', severity: 'major', penalty: 4,
    explain: 'Упаковка выбирается по типу объекта: биология — сухой в бумагу, электроника — экранирование, стекло — жёсткая тара. Каждый объект — отдельно, опечатан, с пояснительной надписью.', source: SRC },
  R_LABEL: { title: 'Неполная пояснительная надпись на упаковке', category: 'documentation', severity: 'minor', penalty: 1,
    explain: 'Что изъято, где, когда, по какому материалу, подписи участников, оттиск печати.', source: 'ст. 177 УПК РФ; ' + SRC },
  R_POWDER_BEFORE_PHOTO: { title: 'Порошок нанесён до фотосъёмки выявленного следа', category: 'technique', severity: 'minor', penalty: 2,
    explain: 'Порядок неразрушающих методов: освещение → фото → порошок → фото → плёнка.', source: SRC },
  R_LIFT_BEFORE_PHOTO: { title: 'След скопирован на плёнку без съёмки после проявления', category: 'technique', severity: 'major', penalty: 4,
    explain: 'Проявленный след фотографируют с масштабом до копирования: перенос на плёнку может его исказить.', source: SRC },
  R_WRONG_POWDER: { title: 'Порошок не подходит к поверхности', category: 'technique', severity: 'minor', penalty: 2,
    explain: 'Подбирайте порошок по цвету и материалу поверхности; магнитный не применяют на ферромагнитных металлах.', source: 'surfaces — ' + SRC },
  R_FALSE_FLAG: { title: 'Значимый след ошибочно отнесён к следам посторонних', category: 'tactics', severity: 'minor', penalty: 2,
    explain: 'Происхождение следа устанавливают по объяснениям и обстановке, а не по первому впечатлению.', source: SRC },
  R_RIGHTS: { title: 'Опрос начат без разъяснения прав', category: 'interview', severity: 'major', penalty: 4,
    explain: 'До начала беседы разъясните права, в том числе ст. 51 Конституции РФ.', source: 'ст. 51 Конституции РФ; ст. 144 УПК РФ' },
  R_LEADING: { title: 'Наводящий вопрос', category: 'interview', severity: 'minor', penalty: 2,
    explain: 'Наводящий вопрос подсказывает ответ: свидетель начинает повторять вашу версию, показания «загрязняются».', source: SRC },
  R_PRESSURE: { title: 'Давление на опрашиваемого', category: 'interview', severity: 'major', penalty: 5,
    explain: 'Обвинения «в лоб» и крик разрушают психологический контакт: человек замыкается.', source: SRC },
  R_THREAT: { title: 'Угроза при опросе', category: 'interview', severity: 'critical', penalty: 10,
    explain: 'Угрозы и обман недопустимы; полученные так сведения не могут быть использованы.', source: 'ст. 9 УПК РФ' },
  R_SEIZE_SHOES: { title: 'Изъятие обуви у племянника без процессуального оформления', category: 'procedure', severity: 'critical', penalty: 15,
    explain: 'Обувь нельзя просто «забрать». Порядок до возбуждения дела утверждает кафедра; в демо верно — отразить и доложить руководителю.', source: SRC },
  R_NOT_IN_PROTOCOL: { title: 'Изъятое не отражено в протоколе', category: 'documentation', severity: 'critical', penalty: 10,
    explain: 'Всё изъятое описывается в протоколе с индивидуальными признаками (ст. 177 УПК РФ).', source: 'ст. 166, 177, 180 УПК РФ' },
  R_CONCLUSION: { title: 'Вывод в описательной части протокола', category: 'documentation', severity: 'minor', penalty: 2,
    explain: 'Протокол описывает, а не оценивает: «вещество бурого цвета», а не «кровь»; «повреждений нет», а не «взлома не было».', source: SRC },
  R_CHANGES_NOT_IN_PROTOCOL: { title: 'Изменения обстановки не отражены в протоколе', category: 'documentation', severity: 'major', penalty: 4,
    explain: 'Кто и что изменил до начала осмотра — отражается в протоколе.', source: SRC },
  R_NOT_PRESENTED: { title: 'Изъятое не предъявлено участникам осмотра', category: 'procedure', severity: 'minor', penalty: 2,
    explain: 'Всё обнаруженное и изъятое предъявляется участникам осмотра (ст. 177 УПК РФ).', source: 'ст. 177 УПК РФ' },
};

// Варианты основания осмотра жилища. TODO(кафедра): утвердить правильный ответ (см. ТЗ, раздел 10).
export const DWELLING_BASIS = [
  { id: 'consent_neighbor', label: 'Письменное согласие соседки-заявителя', ok: false },
  { id: 'consent_nephew', label: 'Согласие племянника (у него есть ключ)', ok: false },
  { id: 'urgent_165', label: 'Не терпящий отлагательства случай (ч. 5 ст. 165 УПК): постановление следователя, уведомление судьи и прокурора в течение 24 часов', ok: true, draft: true },
  { id: 'no_basis', label: 'Основание не требуется — это место происшествия', ok: false },
];

// Пороги «правильного» кадра. TODO(кафедра): утвердить.
export const PHOTO_RULES = {
  orientingMaxFocal: 35,
  overviewMaxFocal: 35,
  overviewMinShare: 0.0004,
  overviewMaxDist: 7,
  nodeMinShare: 0.02,
  nodeMaxShare: 0.3,
  detailMinShare: 0.25,
  detailMaxAxisDeg: 15,
};

export const SCORE = {
  weights: { procedure: 25, completeness: 25, photo: 20, interview: 15, protocol: 15 },
  criticalCap: 59,
  majorsOnOneEvidenceCap: 74,
  grades: [ { min: 90, label: 'отлично' }, { min: 75, label: 'хорошо' }, { min: 60, label: 'удовлетворительно' }, { min: 0, label: 'неудовлетворительно' } ],
  // В какой критерий идут штрафы по категориям правил.
  categoryTo: { procedure: 'procedure', tactics: 'completeness', technique: 'completeness', interview: 'interview', documentation: 'protocol' },
};

// Игровое время, мин.
export const COSTS = { photo: 0.5, inspect: 1, marker: 0.5, scale: 0.5, measure: 2, powder: 5, lift: 4, swab: 6, collect: 3, blood_test: 2, dialogue: 0.5, call: 3, bridge: 0.5, gloves: 0.5 };
export const REAL_SEC_PER_GAME_MIN = 10;

// Словарь недопустимых выводов в описательной части протокола.
export const CONCLUSION_WORDS = ['кровь', 'кровав', 'преступник', 'злоумышленник', 'убийц', 'похитител', 'взлом', 'вор', 'нападавш', 'инсценир'];
