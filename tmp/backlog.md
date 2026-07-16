# Open bugs & features

Источник живых багов и фичей для `tmp/todos.md`.  
Маркер: ✅ = закрыто (в Closed).

## Open

- в шапку вьюпорта добавить иконку глаза (View) в меню которой можно выбрать отображение разных состояний вьюпорта (коллизии, и прочее)
- добавить копии тулбара для копий вьюпорта работающие в паре.
- хоткеи F должен срабатывать над аутлайнером и авто-скроллить содержимое что-бы выбранный ассет попал в видимое поле, если возможно. Если выбрано несколько - усреднять.
- иконка отрыва панели в окно не нужна - достаточно функционала по шифту
- при отрыве окна и наведении на зону где создается отдельное окно - показывать гост будущего окна.
- курсор лапки на шапке панели должен быть только при активации режима редактирования (shift) Иначе - палец для клика
- добавить схлопывание пенели по клику в шапке. условие схлопывания - есть другие панели сверху или снизу


## Closed (архив)

✅ VP-HK — хоткеи F/A/Grid/Boundaries/Collisions/Parallax на viewport под курсором (view-scoped displayOptions + camera)  
✅ AS-REN-END — inline rename: клик в пустое / вне input всегда закрывает поле (capture pointerdown)  
✅ AS-FAV/MMB — empty favorites «Drop favorite folders here»; MMB closes favorite tab  
✅ VP-COL — color/name game camera → live refresh chrome icon (`refreshAllViewportChrome`)  
✅ VP-FIL — active viewport type-filter icon blue (`viewport-filter-active`)  
✅ AS-REN/F2/DBL — inline rename ассета (без dialog); F2 над Assets → library asset; dblclick имени → rename  
✅ регрессия MMB zoom viewport — `MouseHandlers` early-return по `.leaf-body` глотал canvas (dock); `_shouldDeferMiddleMouseToPanel` исключает viewport canvas  
✅ параллакс первого слоя слишком сильный — `getParallaxOffset` использовал `cam×(1+offset)` вместо `cam×offset`  
✅ ctrl на меню фильтров не стабильно работает если увести мыш и на включение  
✅ убрать все контекстные переключения имени таба Details — всегда Details  
✅ уровни в панели Levels, не Layers  
✅ выравнивание пунктов View  
✅ добавляемые слои скрыты пока не кликнешь  
✅ soloed уровней Ctrl+click на глазу  
✅ повёрнутая группа: bounds / click-out close  
✅ undo групп — лишний шаг  
✅ ungroup / cut — тяжёлая перерисовка  
✅ auto apply settings сбрасывался  
✅ имена фолдеров Content — перенос  
✅ filter menu Outliner offset  
✅ isolation mode Outliner  
✅ New Level + console hotkey  
✅ hotkeys только через settings  
✅ tab drag persist  
✅ new level dirty confirm  
✅ solo layers style stick  
✅ object flash on add to group  
✅ duplicate into open group  
✅ ungroup child transforms  
