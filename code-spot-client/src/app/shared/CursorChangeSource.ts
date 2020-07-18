export const enum CursorChangeSource {
  MOUSE_EVENT = 'mouse',
  DRAG_AND_DROP_EVENT = 'editor.contrib.dragAndDrop',
  CTRL_SHIFT_K_EVENT = 'editor.action.deletelines',
  CTRL_ENTER_EVENT = 'editor.action.insertLineAfter',
  CTRL_SHIFT_ENTER_EVENT = 'editor.action.insertLineBefore'
}
