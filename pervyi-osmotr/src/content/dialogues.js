// Диалоги опроса. Теги реплик (игрок их не видит, они подсвечиваются в разборе):
// rights — разъяснение прав; open — открытый; clarify — уточняющий; control — контрольный;
// leading — наводящий; pressure — давление; threat — угроза; seize — изъятие без оформления; order — распоряжение.
// В полной версии — Ink. Формулировки прав — TODO(кафедра).

export const NPCS = {
  sosedka: {
    name: 'Галина Петровна Сомова', short: 'Г. П. Сомова', role: 'соседка, заявитель, 71 год', color: '#b5677a', hair: '#cfcfd6',
    requiresRights: true, trust: 50,
    intro: { text: 'Ой, товарищ следователь… Я как увидела его утром — чуть сама не упала. Давление теперь…', emotion: 'anxiety' },
    choices: [
      { id: 'rights', tags: ['rights'], text: 'Галина Петровна, я следователь. Вы вправе не свидетельствовать против себя и близких (ст. 51 Конституции РФ), можете пользоваться помощью адвоката. Объяснение даётся добровольно.', reply: 'Поняла, поняла. Мне скрывать нечего, спрашивайте.', emotion: 'neutral', trust: 10 },
      { id: 'story', tags: ['open'], text: 'Расскажите, пожалуйста, всё, что вы видели и слышали — с вечера и до утра.', reply: 'Вечером — часов в девять, а может, полдесятого — слышала за стенкой: ругаются. Виктор Палыч и голос молодой, мужской. Потом стекло зазвенело, как будто у него в квартире. Я подумала — посуду бьют. А утром смотрю — дверь приоткрыта…', emotion: 'anxiety', facts: ['f_neigh_quarrel', 'f_neigh_glass'] },
      { id: 'time', tags: ['clarify'], after: 'story', text: 'Как вы определили время? Что в этот момент шло по телевизору?', reply: 'Сериал мой кончился, новости начались… Значит, полдесятого. Да, точно, в полдесятого.', emotion: 'neutral', facts: ['f_neigh_time'] },
      { id: 'touch', tags: ['clarify'], after: 'story', text: 'Что вы делали утром, когда увидели открытую дверь? К чему прикасались?', reply: 'Ручку двери потянула, зашла — и выключатель в прихожей включила. Он там лежит… Я сразу в милицию звонить.', emotion: 'sorrow', facts: ['f_neigh_touched'] },
      { id: 'keys', tags: ['clarify'], after: 'story', text: 'Кто бывает у Виктора Павловича? У кого есть ключи от квартиры?', minTrust: 55, reply: 'Да никто почти. Племянник Кирилл ходит, у него ключ свой. Денег всё просит, Виктор Палыч жаловался.', replyLow: 'Да кто ж его знает, я в чужие дела не лезу.', emotion: 'neutral', facts: ['f_neigh_keys'] },
      { id: 'smoke', tags: ['clarify'], after: 'story', text: 'Виктор Павлович курит? У него в квартире курят?', reply: 'Что вы! Он астматик, сорок лет как бросил. И гостям не разрешает.', emotion: 'neutral', facts: ['f_owner_nonsmoker'] },
      { id: 'control', tags: ['control'], after: 'time', text: 'Вы сказали — звон стекла был «в квартире». Почему вы так решили, а не что на улице?', reply: 'Так у меня балкон рядом, через стенку. Если б на улице — с улицы бы слышно было. А это глухо, внутри.', emotion: 'neutral', facts: ['f_neigh_glass_inside'] },
      { id: 'lead', tags: ['leading'], text: 'Это ведь племянник у него был, да? Его голос?', reply: 'Ну… да, наверное. Наверное, Кирилл. Да, точно он, он всегда кричит.', emotion: 'evasive', facts: ['f_neigh_leading'] },
      { id: 'press', tags: ['threat'], text: 'Вы что-то скрываете. Будете молчать — пойдёте как соучастница.', reply: 'Да как вам не стыдно! Мне плохо… Я больше ничего говорить не буду.', emotion: 'fear', trust: -60, close: true },
    ],
    present: {
      f_phone_call: { reply: 'Кирюша — это Кирилл и есть, племянник. Он ему звонил часто.', facts: [] },
    },
  },

  belov: {
    name: 'ст. лейтенант полиции Белов', short: 'ст. л-т Белов', role: 'участковый уполномоченный, прибыл первым', color: '#3d5a80', hair: '#5a4632',
    requiresRights: false, trust: 50,
    intro: { text: 'Здравия желаю. Прибыл в 07:55, скорая уже была. Потерпевшего увезли.', emotion: 'neutral' },
    choices: [
      { id: 'report', tags: ['open'], text: 'Доложите подробно, что происходило до нашего прибытия.', reply: 'Ну, прибыл, скорая работала. Осмотрелся, всё нормально, ничего не трогал практически. Соседку опросил в общих чертах.', emotion: 'evasive' },
      { id: 'route', tags: ['clarify'], text: 'Вы место ограждали? Кто и каким путём проходил в квартиру?', reply: 'Не ограждал, не успел. Фельдшера с водителем я провёл… через комнату, они носилки разворачивали. Ну и сами они в прихожей работали.', emotion: 'evasive', facts: ['f_officer_route'] },
      { id: 'self', tags: ['clarify'], text: 'Вы сами куда-то заходили, к чему-то прикасались?', minTrust: 45, reply: 'Ну… в санузел заходил, руки помыл после носилок. Воду открывал. Больше ничего.', replyLow: 'Никуда я не заходил, товарищ следователь.', emotion: 'evasive', facts: ['f_officer_bath'] },
      { id: 'initial', tags: ['clarify'], text: 'В каком положении были двери, свет, окна, когда вы пришли?', reply: 'Входная приоткрыта, свет в прихожей горел — соседка включила. Балконную дверь не трогал, она закрыта была.', emotion: 'neutral', facts: ['f_initial_state'] },
      { id: 'guard', tags: ['order'], text: 'Оградите место лентой, посторонних на площадку не пускать, никому в квартиру не входить.', reply: 'Есть. Обеспечу.', emotion: 'neutral', decision: { key: 'guard', value: 'yes' } },
      { id: 'shout', tags: ['pressure'], text: 'Вы что, порядка не знаете?! Затоптали мне всё место!', reply: 'Виноват… Только кричать-то зачем.', emotion: 'irritation', trust: -30 },
    ],
    present: {},
  },

  orlova: {
    name: 'фельдшер СМП Орлова', short: 'Орлова', role: 'по телефону', color: '#5b8e7d', hair: '#7a3b2e', phone: true,
    requiresRights: false, trust: 60,
    intro: { text: 'Алло, Орлова слушает. Да, мы были на Заречной, четырнадцать. Говорите, только быстро — у меня вызов.', emotion: 'irritation' },
    choices: [
      { id: 'pose', tags: ['open'], text: 'Опишите, в каком положении вы обнаружили пострадавшего.', reply: 'Лежал на спине в прихожей, головой к тумбочке, ногами к входной двери. Мы его повернули на бок, потом на носилки.', emotion: 'neutral', facts: ['f_victim_pose'] },
      { id: 'changes', tags: ['clarify'], text: 'Что вы изменили в обстановке? Что оставили после себя?', reply: 'Коврик сдвинули. Упаковку от бинта бросили и перчатки — извините, не до того было.', emotion: 'neutral', facts: ['f_medics_left'] },
      { id: 'clothes', tags: ['clarify'], text: 'Как был одет пострадавший?', reply: 'По-домашнему: трико, рубашка, тапочки.', emotion: 'neutral', facts: ['f_victim_home'] },
      { id: 'injury', tags: ['clarify'], text: 'Какие повреждения вы видели?', reply: 'Рана волосистой части головы, затылочная область. Других не видела, но я не эксперт.', emotion: 'neutral', facts: ['f_injury_back'] },
      { id: 'lead', tags: ['leading'], text: 'Его ведь ударили чем-то тяжёлым, правда?', reply: 'Ну… может, и ударили. Наверное. Я не знаю.', emotion: 'evasive', facts: ['f_medic_leading'] },
    ],
    present: {},
  },

  kirill: {
    name: 'Кирилл Ланской', short: 'Кирилл Ланской', role: 'племянник потерпевшего, 32 года', color: '#6b5b95', hair: '#2b2b2b',
    requiresRights: true, trust: 35,
    intro: { text: 'Что случилось? Мне соседка позвонила… Где дядя? Он живой?', emotion: 'anxiety' },
    choices: [
      { id: 'rights', tags: ['rights'], text: 'Кирилл Владимирович, вы вправе не свидетельствовать против себя и близких родственников (ст. 51 Конституции РФ), пользоваться помощью адвоката. Беседа добровольная.', reply: 'Да… понял. Мне скрывать нечего.', emotion: 'neutral', trust: 15 },
      { id: 'story', tags: ['open'], text: 'Виктор Павлович в больнице, жив. Расскажите, когда вы виделись последний раз и как он жил.', reply: 'Неделю не был. В прошлую субботу заезжал, продукты привёз. Общаемся нормально.', emotion: 'evasive', facts: ['f_kirill_week'] },
      { id: 'evening', tags: ['clarify'], after: 'story', text: 'Где вы были вчера вечером, с 20 до 23 часов?', minTrust: 45, reply: 'Дома был, один. Потом в гараж ездил, машину проверить. Часов в одиннадцать.', replyLow: 'А это вы к чему спрашиваете?', emotion: 'evasive', facts: ['f_kirill_garage'] },
      { id: 'keys', tags: ['clarify'], text: 'У вас есть ключи от квартиры дяди?', reply: 'Есть, он сам дал. На всякий случай.', emotion: 'neutral', facts: ['f_kirill_keys'] },
      { id: 'smoke', tags: ['clarify'], text: 'Вы курите?', reply: 'Курю. «Яву». А какая разница?', emotion: 'irritation', facts: ['f_kirill_smokes'] },
      { id: 'size', tags: ['clarify'], text: 'Какой у вас размер обуви?', reply: 'Сорок третий… А что?', emotion: 'anxiety', facts: ['f_kirill_43'] },
      { id: 'shoes_ok', tags: ['clarify'], text: 'Я отражу в объяснении, во что вы обуты, и доложу руководителю — решение по обуви будет принято процессуально.', reply: 'Делайте что хотите. Кроссовки как кроссовки.', emotion: 'irritation', facts: ['f_kirill_shoes_noted'] },
      { id: 'accuse', tags: ['pressure'], text: 'Хватит врать! Это ты дядю толкнул, признавайся!', reply: 'Я больше ничего не скажу без адвоката.', emotion: 'irritation', trust: -60, close: true },
      { id: 'threat', tags: ['threat'], text: 'Не скажешь правду — закрою прямо сейчас, сядешь надолго.', reply: 'Вы мне угрожаете? Всё, разговор окончен.', emotion: 'fear', trust: -80, close: true },
      { id: 'seize', tags: ['seize'], text: 'Снимайте кроссовки. Я их забираю.', reply: 'На каком основании?! …Ладно, забирайте, только босиком я как пойду?', emotion: 'irritation', trust: -30 },
    ],
    present: {
      f_phone_call: { reply: 'Ну… звонил, да. Вечером. Денег хотел занять. Он не взял трубку.', facts: ['f_kirill_contra_call'], emotion: 'evasive' },
      f_receipt: { reply: 'Квитанция моя, да. Выронил, наверное… когда был в субботу. Вчера? Ну… я не помню, когда платил.', facts: ['f_kirill_contra_receipt'], emotion: 'fear' },
      f_neigh_quarrel: { reply: 'Мало ли кто там у него ругался. Не я.', facts: [], emotion: 'evasive' },
      f_shoeprint_43: { reply: '…Сорок третий у половины города.', facts: [], emotion: 'fear' },
    },
  },
};

export const EMOTIONS = {
  neutral: { label: 'спокойствие', color: '#8fa3b8' },
  anxiety: { label: 'тревога', color: '#e0b04c' },
  fear: { label: 'страх', color: '#9d6bd1' },
  irritation: { label: 'раздражение', color: '#d9534f' },
  sorrow: { label: 'скорбь', color: '#5d7fbf' },
  evasive: { label: 'уклончивость', color: '#7d8c6a' },
};
