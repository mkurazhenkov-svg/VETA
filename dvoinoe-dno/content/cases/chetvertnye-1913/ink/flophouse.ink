=== flophouse_enter ===
{flag("flop_intro"): -> DONE}
~ set_flag("flop_intro")
Ночлежный дом у Нижнего базара. Нары в два яруса, кипяток в баках, махорочный дым. На вас оглядываются — и отворачиваются.
-> DONE

=== flop_keeper ===
Смотритель ночлежки, в жилетке, с книгой постояльцев под мышкой. #s:flop_keeper
+ [Скобцов, гравёр, здесь ночует? #open]
    Аким-то? Здесь. Вон на нарах, у окна. #s:flop_keeper
    {variant() == "guest":
        Он, ваше благородие, всю ночь тут был — с вечера лёг, к утру встал. Я ж обхожу. И мужики скажут. #s:flop_keeper
        ~ set_flag("keeper_alibi")
    - else:
        Пришёл под утро, весь в саже. Я ещё спросил — с пожара, что ли? Промолчал. #s:flop_keeper
    }
    -> DONE
+ [Ничего. #exit]
    -> DONE

=== skobtsov ===
{has("f_skobtsov_confession") || has("f_skobtsov_alibi"):
    Скобцов сидит на нарах, глядя на свои руки. #s:skobtsov #m:broken
    -> DONE
}
Худой человек на нарах. Пальцы в въевшейся тёмной краске. Он не встаёт. #s:skobtsov #m:tense
{variant() != "guest":
    Чего надо? Я ничего не знаю. Спал тут. #s:skobtsov #m:tense
- else:
    Опять? Я, ваше благородие, своё отсидел. Ничего не знаю. #s:skobtsov #m:tense
}
- (hub)
+ [Где вы были этой ночью? #open]
    {variant() == "guest":
        Здесь. На этих нарах. Спросите кого хотите. #s:skobtsov
    - else:
        Здесь… Под утро пришёл. Гулял. #s:skobtsov #m:tense
        Чутьё: Врёт. И знает, что вы это видите. #v:instinct #p:7
    }
    -> hub
+ {has("f_tools_as") && not flag("sk_tools")} [Предъявить: штихели с вашими инициалами из подвала Ветлугина. #present]
    ~ set_flag("sk_tools")
    ~ skob_shown++
    {variant() == "guest":
        Мои… были. Весной украли, с узелком. Я и в участок заявлял — спросите у Пыжова. #s:skobtsov
    - else:
        Скобцов смотрит на свёрток и отводит глаза. #s:skobtsov #m:tense
    }
    -> sk_check
+ {(has("f_prints_match") || has("f_prints")) && not flag("sk_prints")} [Предъявить: следы пальцев в краске на рукояти пресса. #present]
    ~ set_flag("sk_prints")
    ~ skob_shown++
    {variant() == "guest":
        Мои пальцы? Сравнивайте. Не мои там пальцы. #s:skobtsov
    - else:
        Скобцов прячет руки под себя. #s:skobtsov #m:tense
    }
    -> sk_check
+ {has("f_sample_number_match") && not flag("sk_sample")} [Предъявить: подлинник под стеклом и фальшивки с тем же номером. #present]
    ~ set_flag("sk_sample")
    ~ skob_shown++
    Скобцов молчит. #s:skobtsov #m:tense
    -> sk_check
+ {has("f_negative_bill") && not flag("sk_negative")} [Предъявить: негатив билета среди портретов. #present]
    ~ set_flag("sk_negative")
    ~ skob_shown++
    -> sk_check
+ {flag("keeper_alibi") && not has("f_skobtsov_alibi")} [Смотритель говорит, вы всю ночь были здесь. #clarify]
    Был. И мужики видали. А штихели у меня весной украли. #s:skobtsov
    ~ fact("f_skobtsov_alibi")
    Логика: Тогда инициалы в ящике — не его подпись, а чужая подсказка. #v:logic
    -> hub
+ [Признавайся, не то сгниёшь на каторге! #threat #voice:instinct #shortcut]
    {variant() == "guest":
        Скобцов криво усмехается. #s:skobtsov
        Пугали уже. Не был я там. #s:skobtsov
    - else:
        Скобцов вскидывается — и сникает. #s:skobtsov #m:broken
        Ну, резал… ну, печатал… Довольны? Только на суде я скажу, как вы со мной. #s:skobtsov #m:broken
        ~ fact("f_skobtsov_confession")
    }
    -> hub
+ [Пока всё. #exit]
    -> DONE

= sk_check
{skob_shown >= 2 && variant() != "guest":
    Скобцов долго молчит, потом поднимает чёрные от краски руки. #s:skobtsov #m:broken
    {variant() == "main":
        Резал я. И печатал. По заказу Ветлугина, поштучно. Он и сбывал — через менялу. #s:skobtsov #m:broken
    - else:
        Мой это подвал был. Ветлугин только сдал, и знать не знал. А околоточному — доля, каждую субботу. #s:skobtsov #m:broken
    }
    ~ fact("f_skobtsov_confession")
    Ремесло: Мастер. Жаль. Но работа — его. #v:craft
}
-> skobtsov.hub
