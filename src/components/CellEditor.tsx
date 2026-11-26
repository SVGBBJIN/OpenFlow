"use client";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Bold from "@tiptap/extension-bold";
import Strike from "@tiptap/extension-strike";
import { useEffect, useLayoutEffect, useRef } from "react";
import { actionFor, type ActionId } from "@/lib/keymap";
import { isEmptyHtml, sanitizeHtml } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import type { Status } from "@/lib/types";

// Bold/Strike without built-in key bindings: shortcuts come from the user's keymap.
const BoldNoKeys = Bold.extend({ addKeyboardShortcuts: () => ({}) });
const StrikeNoKeys = Strike.extend({ addKeyboardShortcuts: () => ({}) });
const HighlightNoKeys = Highlight.extend({ addKeyboardShortcuts: () => ({}) });

const EDIT_ACTIONS: ActionId[] = [
  "newArgument", "newResponse", "next", "prev", "bold", "strike", "highlight", "exitEdit", "palette",
  "statusActive", "statusAnswered", "statusDropped", "statusExtended", "statusTurned", "statusUnresolved",
  "extend", "turn", "newContention", "switchFlow",
];
const STATUS_ACTIONS: Partial<Record<ActionId, Status>> = {
  statusActive: "active", statusAnswered: "answered", statusDropped: "dropped",
  statusExtended: "extended", statusTurned: "turned", statusUnresolved: "unresolved",
};

export function CellEditor({ id, initial }: { id: string; initial: string }) {
  const seed = useRef(useStore.getState().editSeed);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: true,
    autofocus: "end",
    content: initial,
    extensions: [
      StarterKit.configure({
        heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false,
        bulletList: false, orderedList: false, listItem: false, listKeymap: false,
        link: false, underline: false, bold: false, strike: false, dropcursor: false, gapcursor: false,
      }),
      BoldNoKeys, StrikeNoKeys, HighlightNoKeys,
    ],
    editorProps: {
      attributes: { class: "cell-editor", "aria-label": "Argument text", "data-editing": "true" },
      handleKeyDown(view, e) {
        const st = useStore.getState();
        // Undo/redo inside a cell are native text undo/redo.
        if (/^mod\+(z|y|shift\+z)$/.test(`${e.ctrlKey || e.metaKey ? "mod+" : ""}${e.shiftKey ? "shift+" : ""}${e.key.toLowerCase()}`)) return false;
        const action = actionFor(e, st.keymap, EDIT_ACTIONS);
        if (!action) {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { editor?.commands.setHardBreak(); return true; }
          return false;
        }
        const flush = () => { if (timer.current) clearTimeout(timer.current); st.setText(id, sanitizeHtml(editor!.getHTML())); };
        const run = (fn: () => void) => { e.preventDefault(); fn(); return true; };
        const empty = () => isEmptyHtml(editor!.getHTML());
        switch (action) {
          case "bold": return run(() => editor?.chain().focus().toggleBold().run());
          case "strike": return run(() => editor?.chain().focus().toggleStrike().run());
          case "highlight": return run(() => editor?.chain().focus().toggleHighlight().run());
          case "exitEdit": return run(() => { flush(); st.endEdit(); });
          case "newArgument": return run(() => { if (empty()) return; flush(); st.endEdit(); useStore.getState().newSibling(); });
          case "newResponse": return run(() => { if (empty()) return; flush(); st.endEdit(); useStore.getState().newResponse(); });
          case "newContention": return run(() => { if (empty()) return; flush(); st.endEdit(); useStore.getState().newContention(); });
          case "next": return run(() => { flush(); st.step(1, true); });
          case "prev": return run(() => { flush(); st.step(-1, true); });
          case "palette": {
            // Only a leading "/" (empty cell or after whitespace) opens the palette; mid-word "/" types normally.
            const { $from } = view.state.selection;
            const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
            if (before === "" || /\s$/.test(before)) return run(() => { flush(); st.setPalette(true); });
            return false;
          }
          case "extend": return run(() => { flush(); st.endEdit(); useStore.getState().newResponse({ extend: true }); });
          case "turn": return run(() => { flush(); st.endEdit(); useStore.getState().newResponse({ isTurn: true }); });
          case "switchFlow": return run(() => { flush(); st.endEdit(); st.setFlow(st.flow === "pro" ? "con" : "pro"); });
          default: {
            const s = STATUS_ACTIONS[action];
            if (s) return run(() => st.setStatus(id, s));
            return false;
          }
        }
      },
    },
    onCreate({ editor: ed }) {
      if (seed.current) { ed.commands.insertContent(seed.current); seed.current = null; useStore.setState({ editSeed: null }); }
    },
    onUpdate({ editor: ed }) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => useStore.getState().setText(id, sanitizeHtml(ed.getHTML())), 350);
    },
  });

  // Focus synchronously on mount so fast typists never lose the first keystrokes.
  useLayoutEffect(() => { editor?.commands.focus("end"); }, [editor]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // Refocus after the command palette closes.
  const paletteOpen = useStore((s) => s.paletteOpen);
  useEffect(() => { if (!paletteOpen) editor?.commands.focus(); }, [paletteOpen, editor]);

  return <EditorContent editor={editor} />;
}
