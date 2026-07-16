# Open bugs & features

Источник живых багов и фичей для `tmp/todos.md`.  
Маркер: ✅ = закрыто (в Closed).

## Open

- зум других вьюпортов не должен влиять на отображение элементов с соседних - сейчас включенные в одном окне boundaries меняются при зуме другого окна
- добавить оверлей поверх вьюпорта для заполнения блоками отображения различных данных. Например: индикация включенного параллакса, имя активной камеры, общая статистика уровня/слоя и т.д.
- при отрыве окна и наведении на зону где создается отдельное окно - показывать гост будущего окна.
- добавить схлопывание пенели по клику в шапке. условие схлопывания - есть другие панели сверху или снизу


## Closed (архив)

✅ DK-CUR — grab cursor на leaf header gap только при Shift (`body.dock-customize`); иначе pointer  
✅ DK-ICO — иконка отрыва панели в окно убрана; float только Shift+drag gap  
✅ OL-F — F над Outliner: scrollToSelection (single center / multi average Y); expand collapsed ancestors  
✅ VP-EQ — viewport peers: display/filter/camera не протекают с «главного»; last leaf non-closeable  
✅ VP-TB — копии тулбара для копий viewport, View toggles + Focus paired с leaf  
✅ VP-EYE — иконка глаза в шапке viewport: меню Grid/Boundaries/Collisions/Parallax per-view  
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
