"use client";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useRef } from "react";
import { sanitizeHtml } from "@/lib/sanitize";

function B({ on, label, title, active }: { on(): void; label: React.ReactNode; title: string; active: boolean }) {
  return (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); on(); }} className={`rounded px-1.5 py-0.5 text-[12px] ${active ? "bg-accent/25 text-fg" : "text-muted hover:text-fg"}`}>{label}</button>
  );
}

/** Small rich-text editor for card bodies, block text and document text: bold, italic, underline, strike, highlight. */
export function RichText({ html, onChange, placeholder, minHeight = 80 }: { html: string; onChange(html: string): void; placeholder?: string; minHeight?: number }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(html);
  const editor = useEditor({
    immediatelyRender: true,
    content: html,
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false, link: false, dropcursor: false, gapcursor: false }),
      Highlight,
    ],
    editorProps: {
      attributes: { class: "rich", style: `min-height:${minHeight}px`, "aria-label": placeholder ?? "Text" },
      handleKeyDown(_v, e) {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "h") { editor?.chain().focus().toggleHighlight().run(); e.preventDefault(); return true; }
        e.stopPropagation();
        return false;
      },
    },
    onUpdate({ editor: ed }) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { const h = sanitizeHtml(ed.getHTML()); last.current = h; onChange(h); }, 300);
    },
    onBlur({ editor: ed }) {
      if (timer.current) clearTimeout(timer.current);
      const h = sanitizeHtml(ed.getHTML());
      if (h !== last.current) { last.current = h; onChange(h); }
    },
  });
  // External changes (e.g. switching card) replace the content.
  useEffect(() => {
    if (editor && html !== last.current) { last.current = html; editor.commands.setContent(html, { emitUpdate: false }); }
  }, [html, editor]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className="rounded-md border border-line2 bg-bg focus-within:border-accent">
      <div className="flex gap-0.5 border-b border-line px-1 py-0.5">
        <B on={() => editor?.chain().focus().toggleBold().run()} label={<b>B</b>} title="Bold (Ctrl/⌘+B)" active={!!editor?.isActive("bold")} />
        <B on={() => editor?.chain().focus().toggleItalic().run()} label={<i>I</i>} title="Italic" active={!!editor?.isActive("italic")} />
        <B on={() => editor?.chain().focus().toggleUnderline().run()} label={<u>U</u>} title="Underline (Ctrl/⌘+U)" active={!!editor?.isActive("underline")} />
        <B on={() => editor?.chain().focus().toggleStrike().run()} label={<s>S</s>} title="Strikethrough" active={!!editor?.isActive("strike")} />
        <B on={() => editor?.chain().focus().toggleHighlight().run()} label={<mark className="bg-[#6b5b1a] px-0.5 text-[#fff3b0]">H</mark>} title="Highlight (Ctrl/⌘+Shift+H)" active={!!editor?.isActive("highlight")} />
      </div>
      <div className="px-2 py-1.5 text-[13px]"><EditorContent editor={editor} /></div>
    </div>
  );
}

/** Read-only rendering of stored sanitised HTML. */
export function Html({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`cell-body ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}
