export const enum CursorChangeReason {
  Explicit = 3, // There was an explicit user gesture.
  NotSet = 0, // unknown or not set
  Undo = 5,
  Redo = 6,
  Paste = 4
}
