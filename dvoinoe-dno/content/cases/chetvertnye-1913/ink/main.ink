// «Двойное дно. Дело о фальшивых четвертных» — диалоги.
// Соглашения (см. docs/content-guide.md):
//   реплика:   текст #s:<персонаж> [#m:calm|tense|broken]
//   голос:     текст #v:<навык> [#p:<сложность>] [#shortcut]   (#p — пассивная проверка: строка видна, если навык+6 ≥ сложности)
//   выбор:     + [Текст #open|#clarify|#control|#leading|#pressure|#threat|#present #voice:<навык> #shortcut #min:<минут>]
//   проверка:  + [Текст #check:<навык>:<сложность>:once|rep:<ключ> #fact:<факт>]  → результат в переменной last_check
//   Состояние меняется только через внешние функции (они вызывают dispatch в домене).

VAR last_check = false
VAR kuk_shown = 0
VAR skob_shown = 0
VAR gurov_shown = 0

EXTERNAL fact(id)
EXTERNAL has(id)
EXTERNAL skill(id)
EXTERNAL variant()
EXTERNAL trust(npc)
EXTERNAL add_trust(npc, d)
EXTERNAL spend(minutes)
EXTERNAL set_flag(id)
EXTERNAL flag(id)
EXTERNAL mode()
EXTERNAL examined(ev)
EXTERNAL collected(ev)
EXTERNAL condition(ev)
EXTERNAL clock()
EXTERNAL invite(person)
EXTERNAL dismiss(person)
EXTERNAL is_witness(person)
EXTERNAL witnesses_count()
EXTERNAL ui(command)

INCLUDE museum.ink
INCLUDE bank.ink
INCLUDE yard.ink
INCLUDE cellar.ink
INCLUDE shop.ink
INCLUDE pharmacy.ink
INCLUDE flophouse.ink
INCLUDE chamber.ink

-> DONE
