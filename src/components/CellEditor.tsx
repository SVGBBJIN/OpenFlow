"use client";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Bold from "@tiptap/extension-bold";
import Strike from "@tiptap/extension-strike";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getSession, localIdentity } from "@/lib/collab/session";
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
  // Live session: this cell's text is a shared CRDT fragment so partners can type in it simultaneously.
  const [collab] = useState(() => {
    const sess = getSession();
    if (!sess || !sess.canWrite) return null;
    const fragment = sess.fragment(id);
    // Resync the fragment to the argument's stored text unless a partner is already typing here.
    if (!sess.othersEditing(id) && fragment.length > 0) fragment.delete(0, fragment.length);
    return { sess, fragment, user: localIdentity() };
  });

  const editor = useEditor({
    immediatelyRender: true,
    autofocus: "end",
    content: collab ? undefined : initial,
    extensions: [
      StarterKit.configure({
        undoRedo: collab ? false : undefined,
        heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false,
        bulletList: false, orderedList: false, listItem: false, listKeymap: false,
        link: false, underline: false, bold: false, strike: false, dropcursor: false, gapcursor: false,
      }),
      BoldNoKeys, StrikeNoKeys, HighlightNoKeys,
      ...(collab ? [Collaboration.configure({ fragment: collab.fragment }), CollaborationCaret.configure({ provider: { awareness: collab.sess.awareness }, user: collab.user })] : []),
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
      if (collab && collab.fragment.length === 0 && initial) ed.chain().setMeta("addToHistory", false).setContent(initial, { emitUpdate: false }).run();
      if (seed.current) { ed.commands.insertContent(seed.current); seed.current = null; useStore.setState({ editSeed: null }); }
    },
    onUpdate({ editor: ed }) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => useStore.getState().setText(id, sanitizeHtml(ed.getHTML())), 350);
    },
  });

  // Focus synchronously on mount so fast typists never lose the first keystrokes.
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // Tiptap's focus() command defers to requestAnimationFrame; focus the DOM synchronously instead.
    editor.view.focus();
    editor.commands.setTextSelection(editor.state.doc.content.size);
  }, [editor]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // Refocus after the command palette closes.
  const paletteOpen = useStore((s) => s.paletteOpen);
  useEffect(() => { if (!paletteOpen) editor?.commands.focus(); }, [paletteOpen, editor]);

  return <EditorContent editor={editor} />;
}
