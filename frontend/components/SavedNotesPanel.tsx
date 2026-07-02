"use client";

import type { ResearchNote } from "@/lib/apiClient";

type SavedNotesPanelProps = {
  notes: ResearchNote[];
  onOpen: (note: ResearchNote) => void;
  onDelete: (id: string) => void;
  onLoadMore?: () => void;
};

export function SavedNotesPanel({ notes, onOpen, onDelete, onLoadMore }: SavedNotesPanelProps) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Saved notes</p>
        <span className="text-[10px] text-[var(--text-muted)]">{notes.length}</span>
      </div>
      {notes.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">Save important answers for later review.</p>
      ) : (
        <>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {notes.map((note) => (
              <li key={note.id} className="group rounded-lg border border-[var(--border-subtle)] p-2">
                <button
                  type="button"
                  onClick={() => onOpen(note)}
                  className="w-full text-left"
                >
                  <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{note.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-muted)]">{note.question}</p>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(note.id)}
                  className="mt-1 text-[10px] text-rose-400 opacity-0 transition group-hover:opacity-100"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {onLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              className="mt-2 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Load more
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

