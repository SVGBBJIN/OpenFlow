export type ActionId =
  | "newArgument" | "newResponse" | "next" | "prev"
  | "up" | "down" | "left" | "right"
  | "bold" | "strike" | "highlight" | "exitEdit" | "startEdit" | "palette"
  | "undo" | "redo" | "deleteArg" | "toggleCollapse"
  | "moveUp" | "moveDown" | "colLeft" | "colRight"
  | "statusActive" | "statusAnswered" | "statusDropped" | "statusExtended" | "statusTurned" | "statusUnresolved"
  | "extend" | "turn" | "switchFlow" | "newContention";

export const ACTION_LABELS: Record<ActionId, string> = {
  newArgument: "New argument (sibling)",
  newResponse: "New response (next speech)",
  next: "Next argument", prev: "Previous argument",
  up: "Move up", down: "Move down", left: "Move left", right: "Move right",
  bold: "Bold", strike: "Strikethrough", highlight: "Highlight",
  exitEdit: "Exit editing", startEdit: "Edit selected", palette: "Command palette",
  undo: "Undo", redo: "Redo", deleteArg: "Delete argument",
  toggleCollapse: "Collapse / expand tree",
  moveUp: "Reorder up", moveDown: "Reorder down",
  colLeft: "Move to earlier speech", colRight: "Move to later speech",
  statusActive: "Status: active", statusAnswered: "Status: answered", statusDropped: "Status: dropped",
  statusExtended: "Status: extended", statusTurned: "Status: turned", statusUnresolved: "Status: unresolved",
  extend: "Extend into next speech", turn: "Add turn response",
  switchFlow: "Switch Pro/Con flow", newContention: "New contention",
};

export type Keymap = Record<ActionId, string>;

export const DEFAULT_KEYMAP: Keymap = {
  newArgument: "enter", newResponse: "shift+enter", next: "tab", prev: "shift+tab",
  up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright",
  bold: "mod+b", strike: "mod+shift+x", highlight: "mod+shift+h",
  exitEdit: "escape", startEdit: "f2", palette: "/",
  undo: "mod+z", redo: "mod+shift+z", deleteArg: "delete", toggleCollapse: "alt+c",
  moveUp: "alt+arrowup", moveDown: "alt+arrowdown", colLeft: "alt+arrowleft", colRight: "alt+arrowright",
  statusActive: "alt+1", statusAnswered: "alt+2", statusDropped: "alt+3",
  statusExtended: "alt+4", statusTurned: "alt+5", statusUnresolved: "alt+6",
  extend: "alt+e", turn: "alt+t", switchFlow: "mod+shift+f", newContention: "mod+shift+enter",
};

const IGNORE = new Set(["control", "meta", "alt", "shift", "altgraph", "capslock"]);

/** Layout-independent key name (Option+1 on a Mac still reports "1"). */
function keyName(e: KeyboardEvent): string {
  const c = e.code || "";
  if (c.startsWith("Digit")) return c.slice(5);
  if (c.startsWith("Key")) return c.slice(3).toLowerCase();
  return e.key.toLowerCase() === " " ? "space" : e.key.toLowerCase();
}

export function comboFromEvent(e: KeyboardEvent): string | null {
  const k = keyName(e);
  if (IGNORE.has(k)) return null;
  return [e.ctrlKey || e.metaKey ? "mod" : "", e.altKey ? "alt" : "", e.shiftKey ? "shift" : "", k]
    .filter(Boolean)
    .join("+");
}

export function actionFor(e: KeyboardEvent, map: Keymap, only?: ActionId[]): ActionId | null {
  const combo = comboFromEvent(e);
  if (!combo) return null;
  for (const [action, bound] of Object.entries(map) as [ActionId, string][]) {
    if (bound === combo && (!only || only.includes(action))) return action;
  }
  // Backspace also deletes, and Mod+Y redoes.
  if (combo === "backspace" && (!only || only.includes("deleteArg"))) return "deleteArg";
  if (combo === "mod+y" && (!only || only.includes("redo"))) return "redo";
  return null;
}

export function prettyCombo(combo: string): string {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return combo
    .split("+")
    .map((p) =>
      p === "mod" ? (mac ? "⌘" : "Ctrl") : p === "alt" ? (mac ? "⌥" : "Alt") : p === "shift" ? "Shift"
      : p.startsWith("arrow") ? { arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→" }[p] ?? p
      : p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1),
    )
    .join(mac ? "" : "+");
}

const KEY = "openflow:keymap";
export function loadKeymap(): Keymap {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_KEYMAP, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_KEYMAP;
}
export function saveKeymap(map: Keymap) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch {}
}
