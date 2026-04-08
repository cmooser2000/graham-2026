"use client";

import { useState, useEffect } from "react";
import {
  Trash2,
  Plus,
  RotateCcw,
  Pencil,
  Check,
  X,
  Users,
  Link2,
} from "lucide-react";
import {
  useDirectoryStore,
  DEFAULT_DIRECTORY,
  DEFAULT_LINKS,
  type DirectoryEntry,
  type OpsLink,
} from "@/lib/store/directory-store";
import { STRUCTURES, DEPARTMENTS } from "@/lib/data/directory";

type Section = "directory" | "links";

function emptyEntry(): DirectoryEntry {
  return {
    name: "",
    email: "",
    phone: "",
    department: "",
    title: "",
    role: "",
    structure: "",
  };
}

function emptyLink(): OpsLink {
  return { label: "", url: "" };
}

// ─── Directory Editor ────────────────────────────────────────────

function DirectoryEditor() {
  const { getDirectory, setDirectory, resetDirectory, directory } =
    useDirectoryStore();
  const entries = getDirectory();
  const hasOverride = directory !== null;

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editData, setEditData] = useState<DirectoryEntry>(emptyEntry());
  const [adding, setAdding] = useState(false);
  const [addData, setAddData] = useState<DirectoryEntry>(emptyEntry());

  const update = (idx: number, entry: DirectoryEntry) => {
    const next = [...entries];
    next[idx] = entry;
    setDirectory(next);
  };

  const remove = (idx: number) => {
    setDirectory(entries.filter((_, i) => i !== idx));
  };

  const startEdit = (idx: number) => {
    setEditIdx(idx);
    setEditData({ ...entries[idx] });
  };

  const saveEdit = () => {
    if (editIdx !== null) {
      update(editIdx, editData);
      setEditIdx(null);
    }
  };

  const saveAdd = () => {
    if (!addData.name.trim()) return;
    setDirectory([...entries, addData]);
    setAddData(emptyEntry());
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-terminal-yellow text-sm tracking-wider flex items-center gap-2">
          <Users size={14} />
          DIRECTORY ({entries.length})
        </h2>
        <div className="flex items-center gap-2">
          {hasOverride && (
            <button
              onClick={resetDirectory}
              className="flex items-center gap-1.5 px-2 py-1 text-terminal-xs text-terminal-dim border border-border rounded hover:text-red-400 hover:border-red-400/50 transition-colors"
            >
              <RotateCcw size={12} />
              RESET
            </button>
          )}
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-terminal-xs text-terminal-green border border-terminal-green/30 rounded hover:bg-terminal-green/10 transition-colors"
          >
            <Plus size={12} />
            ADD
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="border border-terminal-green/30 rounded-lg p-3 space-y-2">
          <p className="text-terminal-green text-terminal-xs tracking-wider">
            NEW ENTRY
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Name"
              value={addData.name}
              onChange={(v) => setAddData({ ...addData, name: v })}
            />
            <Input
              label="Email"
              value={addData.email}
              onChange={(v) => setAddData({ ...addData, email: v })}
            />
            <Input
              label="Phone"
              value={addData.phone}
              onChange={(v) => setAddData({ ...addData, phone: v })}
            />
            <Select
              label="Department"
              value={addData.department}
              options={DEPARTMENTS}
              onChange={(v) => setAddData({ ...addData, department: v })}
            />
            <Input
              label="Title"
              value={addData.title}
              onChange={(v) => setAddData({ ...addData, title: v })}
            />
            <Select
              label="Structure"
              value={addData.structure}
              options={STRUCTURES}
              onChange={(v) => setAddData({ ...addData, structure: v })}
            />
            <div className="col-span-2">
              <Input
                label="Role"
                value={addData.role}
                onChange={(v) => setAddData({ ...addData, role: v })}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setAdding(false);
                setAddData(emptyEntry());
              }}
              className="px-3 py-1 text-terminal-xs text-terminal-dim border border-border rounded hover:text-terminal-yellow transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveAdd}
              className="px-3 py-1 text-terminal-xs text-terminal-green border border-terminal-green/30 rounded hover:bg-terminal-green/10 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-terminal-dim text-terminal-xs tracking-wider text-left">
                <th className="px-3 py-2">NAME</th>
                <th className="px-3 py-2">TITLE</th>
                <th className="px-3 py-2">DEPT</th>
                <th className="px-3 py-2">STRUCTURE</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr
                  key={`${entry.email}-${idx}`}
                  className="border-b border-border/50 hover:bg-terminal-raised/50 transition-colors"
                >
                  {editIdx === idx ? (
                    <>
                      <td className="px-3 py-1.5">
                        <input
                          className="bg-transparent border-b border-terminal-yellow/50 text-sm w-full outline-none"
                          value={editData.name}
                          onChange={(e) =>
                            setEditData({ ...editData, name: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          className="bg-transparent border-b border-terminal-yellow/50 text-sm w-full outline-none"
                          value={editData.title}
                          onChange={(e) =>
                            setEditData({ ...editData, title: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          className="bg-terminal-panel border border-border rounded text-sm outline-none"
                          value={editData.department}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              department: e.target.value,
                            })
                          }
                        >
                          <option value="">--</option>
                          {DEPARTMENTS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          className="bg-terminal-panel border border-border rounded text-sm outline-none"
                          value={editData.structure}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              structure: e.target.value,
                            })
                          }
                        >
                          <option value="">--</option>
                          {STRUCTURES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={saveEdit}
                            className="p-1 text-terminal-green hover:bg-terminal-green/10 rounded transition-colors"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditIdx(null)}
                            className="p-1 text-terminal-dim hover:text-terminal-yellow rounded transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-1.5 text-terminal-green">
                        {entry.name}
                      </td>
                      <td className="px-3 py-1.5 text-terminal-dim truncate max-w-48">
                        {entry.title}
                      </td>
                      <td className="px-3 py-1.5 text-terminal-dim">
                        {entry.department}
                      </td>
                      <td className="px-3 py-1.5 text-terminal-dim">
                        {entry.structure}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(idx)}
                            className="p-1 text-terminal-dim hover:text-terminal-yellow rounded transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => remove(idx)}
                            className="p-1 text-terminal-dim hover:text-red-400 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Links Editor ────────────────────────────────────────────────

function LinksEditor() {
  const { getLinks, setLinks, resetLinks, links } = useDirectoryStore();
  const entries = getLinks();
  const hasOverride = links !== null;

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editData, setEditData] = useState<OpsLink>(emptyLink());
  const [adding, setAdding] = useState(false);
  const [addData, setAddData] = useState<OpsLink>(emptyLink());

  const remove = (idx: number) => {
    setLinks(entries.filter((_, i) => i !== idx));
  };

  const startEdit = (idx: number) => {
    setEditIdx(idx);
    setEditData({ ...entries[idx] });
  };

  const saveEdit = () => {
    if (editIdx !== null) {
      const next = [...entries];
      next[editIdx] = editData;
      setLinks(next);
      setEditIdx(null);
    }
  };

  const saveAdd = () => {
    if (!addData.label.trim() || !addData.url.trim()) return;
    setLinks([...entries, addData]);
    setAddData(emptyLink());
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-terminal-yellow text-sm tracking-wider flex items-center gap-2">
          <Link2 size={14} />
          LINKS ({entries.length})
        </h2>
        <div className="flex items-center gap-2">
          {hasOverride && (
            <button
              onClick={resetLinks}
              className="flex items-center gap-1.5 px-2 py-1 text-terminal-xs text-terminal-dim border border-border rounded hover:text-red-400 hover:border-red-400/50 transition-colors"
            >
              <RotateCcw size={12} />
              RESET
            </button>
          )}
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-terminal-xs text-terminal-green border border-terminal-green/30 rounded hover:bg-terminal-green/10 transition-colors"
          >
            <Plus size={12} />
            ADD
          </button>
        </div>
      </div>

      {adding && (
        <div className="border border-terminal-green/30 rounded-lg p-3 space-y-2">
          <p className="text-terminal-green text-terminal-xs tracking-wider">
            NEW LINK
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Label"
              value={addData.label}
              onChange={(v) => setAddData({ ...addData, label: v })}
            />
            <Input
              label="URL"
              value={addData.url}
              onChange={(v) => setAddData({ ...addData, url: v })}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setAdding(false);
                setAddData(emptyLink());
              }}
              className="px-3 py-1 text-terminal-xs text-terminal-dim border border-border rounded hover:text-terminal-yellow transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveAdd}
              className="px-3 py-1 text-terminal-xs text-terminal-green border border-terminal-green/30 rounded hover:bg-terminal-green/10 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-terminal-dim text-terminal-xs tracking-wider text-left">
              <th className="px-3 py-2">LABEL</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((link, idx) => (
              <tr
                key={`${link.url}-${idx}`}
                className="border-b border-border/50 hover:bg-terminal-raised/50 transition-colors"
              >
                {editIdx === idx ? (
                  <>
                    <td className="px-3 py-1.5">
                      <input
                        className="bg-transparent border-b border-terminal-yellow/50 text-sm w-full outline-none"
                        value={editData.label}
                        onChange={(e) =>
                          setEditData({ ...editData, label: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        className="bg-transparent border-b border-terminal-yellow/50 text-sm w-full outline-none"
                        value={editData.url}
                        onChange={(e) =>
                          setEditData({ ...editData, url: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={saveEdit}
                          className="p-1 text-terminal-green hover:bg-terminal-green/10 rounded transition-colors"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditIdx(null)}
                          className="p-1 text-terminal-dim hover:text-terminal-yellow rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-1.5 text-terminal-green">
                      {link.label}
                    </td>
                    <td className="px-3 py-1.5 text-terminal-dim truncate max-w-64">
                      {link.url}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(idx)}
                          className="p-1 text-terminal-dim hover:text-terminal-yellow rounded transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => remove(idx)}
                          className="p-1 text-terminal-dim hover:text-red-400 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared input components ─────────────────────────────────────

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-terminal-dim text-terminal-xs tracking-wider block mb-1">
        {label.toUpperCase()}
      </label>
      <input
        className="w-full bg-terminal-panel border border-border rounded px-2 py-1.5 text-sm outline-none focus:border-terminal-yellow/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-terminal-dim text-terminal-xs tracking-wider block mb-1">
        {label.toUpperCase()}
      </label>
      <select
        className="w-full bg-terminal-panel border border-border rounded px-2 py-1.5 text-sm outline-none focus:border-terminal-yellow/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">--</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function HQPage() {
  const [section, setSection] = useState<Section>("directory");
  const { resetAll, directory, links } = useDirectoryStore();
  const hasAnyOverride = directory !== null || links !== null;

  // hydration guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-terminal-yellow text-lg tracking-wider">
            SWLW // HQ
          </h1>
          <p className="text-terminal-dim text-terminal-xs tracking-wider mt-1">
            OPS DATA MANAGEMENT
          </p>
        </div>
        {hasAnyOverride && (
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-terminal-xs text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors"
          >
            <RotateCcw size={12} />
            RESET ALL TO DEFAULTS
          </button>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 mb-6">
        {(
          [
            { id: "directory" as const, label: "Directory", icon: Users },
            { id: "links" as const, label: "Links", icon: Link2 },
          ] as const
        ).map((tab) => {
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSection(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors ${
                active
                  ? "border-terminal-yellow text-terminal-yellow"
                  : "border-border text-terminal-dim hover:text-terminal-yellow/60"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {section === "directory" && <DirectoryEditor />}
      {section === "links" && <LinksEditor />}
    </div>
  );
}
