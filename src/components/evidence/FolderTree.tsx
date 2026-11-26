"use client";
import { useState } from "react";
import { useLib } from "@/lib/lib-store";
import type { Scope } from "@/lib/library";

/** Folder/file tree shared by the evidence and block libraries. */
export function FolderTree({ scope, selected, onSelect, counts }: { scope: Scope; selected: string | null; onSelect(id: string | null): void; counts: Record<string, number> }) {
  const folders = useLib((s) => s.folders).filter((f) => f.scope === scope);
  const { addFolder, renameFolder, deleteFolder } = useLib.getState();
  const [editing, setEditing] = useState<string | null>(null);

  const render = (parent: string | null, depth: number): React.ReactNode =>
    folders.filter((f) => f.parentId === parent).map((f) => (
      <div key={f.id}>
        <div className={`group flex items-center gap-1 rounded px-1 py-0.5 text-[13px] ${selected === f.id ? "bg-raised text-fg" : "text-muted hover:text-fg"}`} style={{ paddingLeft: 4 + depth * 12 }}>
          <span>{f.kind === "file" ? "▤" : "▸"}</span>
          {editing === f.id ? (
            <input autoFocus className="input py-0" defaultValue={f.name}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { renameFolder(f.id, (e.target as HTMLInputElement).value || f.name); setEditing(null); } if (e.key === "Escape") setEditing(null); }}
              onBlur={() => setEditing(null)} />
          ) : (
            <button className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect(f.id)} onDoubleClick={() => setEditing(f.id)}>{f.name}</button>
          )}
          <span className="text-[11px]">{counts[f.id] ?? 0}</span>
          <span className="hidden gap-1 group-hover:flex">
            <button title="Add subfolder" onClick={() => { const id = addFolder(scope, "New folder", f.id); setEditing(id); }}>＋</button>
            <button title="Rename" onClick={() => setEditing(f.id)}>✎</button>
            <button title="Delete folder (contents move up)" onClick={() => deleteFolder(f.id)}>×</button>
          </span>
        </div>
        {render(f.id, depth + 1)}
      </div>
    ));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><span className="label">Folders & files</span>
        <span className="flex gap-1 text-[12px] text-muted">
          <button title="New folder" onClick={() => setEditing(addFolder(scope, "New folder", null))}>＋📁</button>
          <button title="New file" onClick={() => setEditing(addFolder(scope, "New file", null, "file"))}>＋▤</button>
        </span>
      </div>
      {render(null, 0)}
    </div>
  );
}
