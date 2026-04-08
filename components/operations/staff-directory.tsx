"use client";

import { useState, useMemo } from "react";
import { Search, ArrowLeft, Phone, Mail, X, ArrowUpDown, Plus, Lock } from "lucide-react";
import { STRUCTURES, type DirectoryEntry } from "@/lib/data/directory";
import { useDirectoryStore } from "@/lib/store/directory-store";

const OPS_PASSWORD = "GP2026";

function AddContactForm({ onAdd, onCancel }: { onAdd: (entry: DirectoryEntry) => void; onCancel: () => void }) {
  const [step, setStep] = useState<"auth" | "form">("auth");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [form, setForm] = useState<DirectoryEntry>({
    name: "", email: "", phone: "", department: "", title: "", role: "", structure: "IN HOUSE",
  });

  function checkPassword() {
    if (pw === OPS_PASSWORD) { setStep("form"); setPwError(false); }
    else { setPwError(true); }
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.title.trim()) return;
    onAdd(form);
  }

  if (step === "auth") {
    return (
      <div className="bg-terminal-panel border border-terminal-yellow/30 rounded p-4 space-y-3">
        <div className="flex items-center gap-2 text-terminal-yellow text-terminal-sm font-medium tracking-wider">
          <Lock size={14} /> ADD CONTACT
        </div>
        <input
          type="password"
          placeholder="Enter password..."
          value={pw}
          onChange={e => { setPw(e.target.value); setPwError(false); }}
          onKeyDown={e => e.key === "Enter" && checkPassword()}
          className="w-full bg-terminal-bg border border-border rounded px-3 py-2 text-terminal-sm outline-none focus:border-terminal-yellow/50"
        />
        {pwError && <p className="text-terminal-red text-terminal-xs">Incorrect password</p>}
        <div className="flex gap-2">
          <button onClick={checkPassword} className="flex-1 bg-terminal-yellow/10 border border-terminal-yellow/40 text-terminal-yellow text-terminal-sm rounded py-1.5 hover:bg-terminal-yellow/20 transition-colors">
            Unlock
          </button>
          <button onClick={onCancel} className="px-3 border border-border text-terminal-dim text-terminal-sm rounded py-1.5 hover:text-foreground transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const fields: { key: keyof DirectoryEntry; label: string; required?: boolean }[] = [
    { key: "name", label: "Name", required: true },
    { key: "title", label: "Title / Role", required: true },
    { key: "department", label: "Department" },
    { key: "structure", label: "Type (IN HOUSE / CONSULTANT / etc.)" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "role", label: "Notes" },
  ];

  return (
    <div className="bg-terminal-panel border border-terminal-yellow/30 rounded p-4 space-y-3">
      <div className="text-terminal-yellow text-terminal-sm font-medium tracking-wider">NEW CONTACT</div>
      {fields.map(f => (
        <div key={f.key}>
          <label className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-1">{f.label}{f.required && " *"}</label>
          <input
            type="text"
            value={form[f.key]}
            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
            className="w-full bg-terminal-bg border border-border rounded px-3 py-1.5 text-terminal-sm outline-none focus:border-terminal-yellow/50"
          />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!form.name.trim() || !form.title.trim()}
          className="flex-1 bg-terminal-yellow/10 border border-terminal-yellow/40 text-terminal-yellow text-terminal-sm rounded py-1.5 hover:bg-terminal-yellow/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add Contact
        </button>
        <button onClick={onCancel} className="px-3 border border-border text-terminal-dim text-terminal-sm rounded py-1.5 hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

type SortKey = "name" | "department";

const STRUCTURE_COLORS: Record<string, string> = {
  "IN HOUSE": "text-terminal-green",
  "CONSULTANT": "text-terminal-yellow",
  "VOLUNTEER ADVISOR": "text-sky-400",
  "FORMAL ADVISOR": "text-purple-400",
  "VOLUNTEER": "text-terminal-dim",
  "OFFICIAL TEAM": "text-orange-400",
};

const DEPT_COLORS: Record<string, string> = {
  "COMMS": "text-sky-400",
  "COMMS + FINANCE": "text-violet-400",
  "FINANCE": "text-terminal-green",
  "OPERATIONS": "text-orange-400",
  "OUTREACH": "text-amber-400",
  "OVERALL": "text-terminal-yellow",
  "POLICY": "text-teal-400",
  "POLLING": "text-pink-400",
};

function StructureBadge({ structure }: { structure: string }) {
  const color = STRUCTURE_COLORS[structure] ?? "text-terminal-dim";
  return (
    <span className={`text-terminal-xs tracking-wider ${color}`}>
      {structure}
    </span>
  );
}

function DeptBadge({ department }: { department: string }) {
  const color = DEPT_COLORS[department] ?? "text-terminal-dim";
  return (
    <span className={`text-terminal-xs tracking-wider ${color}`}>
      {department}
    </span>
  );
}

function PersonDetail({
  person,
  onBack,
}: {
  person: DirectoryEntry;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-terminal-dim hover:text-terminal-yellow transition-colors text-sm"
      >
        <ArrowLeft size={14} />
        Back to directory
      </button>

      <div className="border border-border rounded-lg p-4 space-y-4">
        <div>
          <h3 className="text-terminal-green text-lg font-bold">{person.name}</h3>
          <p className="text-terminal-yellow text-sm">{person.title}</p>
          <div className="flex items-center gap-3 mt-1">
            <DeptBadge department={person.department} />
            <StructureBadge structure={person.structure} />
          </div>
        </div>

        {person.role && (
          <div>
            <p className="text-terminal-dim text-terminal-xs tracking-wider mb-1">ROLE</p>
            <p className="text-sm">{person.role}</p>
          </div>
        )}

        <div className="space-y-2">
          {person.email && (
            <a
              href={`mailto:${person.email}`}
              className="flex items-center gap-2 text-sm text-terminal-dim hover:text-terminal-yellow transition-colors"
            >
              <Mail size={14} />
              {person.email}
            </a>
          )}
          {person.phone && (
            <a
              href={`tel:${person.phone}`}
              className="flex items-center gap-2 text-sm text-terminal-dim hover:text-terminal-yellow transition-colors"
            >
              <Phone size={14} />
              {person.phone}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function DepartmentGroup({
  department,
  people,
  onSelect,
}: {
  department: string;
  people: DirectoryEntry[];
  onSelect: (p: DirectoryEntry) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50">
        <DeptBadge department={department} />
        <span className="text-terminal-dim text-terminal-xs">({people.length})</span>
      </div>
      <div className="space-y-px">
        {people.map((person, i) => (
          <button
            key={`${person.email}-${i}`}
            onClick={() => onSelect(person)}
            className="w-full text-left px-3 py-2.5 rounded border border-transparent hover:border-border hover:bg-terminal-raised transition-colors group"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium group-hover:text-terminal-green transition-colors truncate">
                {person.name}
              </span>
              <StructureBadge structure={person.structure} />
            </div>
            <p className="text-terminal-dim text-terminal-xs truncate mt-0.5">
              {person.title}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StaffDirectory() {
  const [query, setQuery] = useState("");
  const [filterStructure, setFilterStructure] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [selected, setSelected] = useState<DirectoryEntry | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const directory = useDirectoryStore((s) => s.getDirectory());
  const setDirectory = useDirectoryStore((s) => s.setDirectory);

  function handleAddContact(entry: DirectoryEntry) {
    setDirectory([...directory, entry]);
    setShowAddForm(false);
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return directory.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q);
      const matchesStructure =
        !filterStructure || p.structure === filterStructure;
      return matchesQuery && matchesStructure;
    });
  }, [query, filterStructure, directory]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === "department") {
        const deptCmp = a.department.localeCompare(b.department);
        if (deptCmp !== 0) return deptCmp;
      }
      return a.name.localeCompare(b.name);
    });
  }, [filtered, sortBy]);

  const groupedByDept = useMemo(() => {
    if (sortBy !== "department") return null;
    const groups: Record<string, DirectoryEntry[]> = {};
    for (const p of sorted) {
      if (!groups[p.department]) groups[p.department] = [];
      groups[p.department].push(p);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [sorted, sortBy]);

  if (selected) {
    return <PersonDetail person={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-3">
      {/* Add contact form */}
      {showAddForm && (
        <AddContactForm onAdd={handleAddContact} onCancel={() => setShowAddForm(false)} />
      )}

      {/* Search + Add button */}
      <div className="flex gap-2">
      <div className="relative flex-1">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-dim"
        />
        <input
          type="text"
          placeholder="Search name, title, department..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-terminal-panel border border-border rounded pl-9 pr-8 py-2 text-sm placeholder:text-terminal-dim focus:outline-none focus:border-terminal-yellow/50"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-dim hover:text-terminal-yellow"
          >
            <X size={14} />
          </button>
        )}
      </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-2 border border-border rounded text-terminal-dim hover:text-terminal-yellow hover:border-terminal-yellow/40 transition-colors text-terminal-sm shrink-0"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {/* Sort + Filter row */}
      <div className="flex items-center justify-between gap-2">
        {/* Structure filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterStructure(null)}
            className={`px-2 py-0.5 text-terminal-xs rounded border transition-colors ${
              !filterStructure
                ? "border-terminal-yellow text-terminal-yellow"
                : "border-border text-terminal-dim hover:text-terminal-yellow/60"
            }`}
          >
            ALL ({directory.length})
          </button>
          {STRUCTURES.map((s) => {
            const count = directory.filter((p) => p.structure === s).length;
            return (
              <button
                key={s}
                onClick={() =>
                  setFilterStructure(filterStructure === s ? null : s)
                }
                className={`px-2 py-0.5 text-terminal-xs rounded border transition-colors ${
                  filterStructure === s
                    ? "border-terminal-yellow text-terminal-yellow"
                    : "border-border text-terminal-dim hover:text-terminal-yellow/60"
                }`}
              >
                {s} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort toggle + results count */}
      <div className="flex items-center justify-between">
        <p className="text-terminal-dim text-terminal-xs tracking-wider">
          {sorted.length} {sorted.length === 1 ? "RESULT" : "RESULTS"}
        </p>
        <div className="flex items-center gap-1">
          <ArrowUpDown size={12} className="text-terminal-dim" />
          <button
            onClick={() => setSortBy("name")}
            className={`px-2 py-0.5 text-terminal-xs rounded transition-colors ${
              sortBy === "name"
                ? "text-terminal-yellow"
                : "text-terminal-dim hover:text-terminal-yellow/60"
            }`}
          >
            A-Z
          </button>
          <span className="text-terminal-dim text-terminal-xs">/</span>
          <button
            onClick={() => setSortBy("department")}
            className={`px-2 py-0.5 text-terminal-xs rounded transition-colors ${
              sortBy === "department"
                ? "text-terminal-yellow"
                : "text-terminal-dim hover:text-terminal-yellow/60"
            }`}
          >
            DEPT
          </button>
        </div>
      </div>

      {/* Directory list */}
      {sortBy === "department" && groupedByDept ? (
        <div className="space-y-4">
          {groupedByDept.map(([dept, people]) => (
            <DepartmentGroup
              key={dept}
              department={dept}
              people={people}
              onSelect={setSelected}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-px">
          {sorted.map((person, i) => (
            <button
              key={`${person.email}-${i}`}
              onClick={() => setSelected(person)}
              className="w-full text-left px-3 py-2.5 rounded border border-transparent hover:border-border hover:bg-terminal-raised transition-colors group"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium group-hover:text-terminal-green transition-colors truncate">
                  {person.name}
                </span>
                <StructureBadge structure={person.structure} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <DeptBadge department={person.department} />
                <span className="text-terminal-dim">·</span>
                <p className="text-terminal-dim text-terminal-xs truncate">
                  {person.title}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {sorted.length === 0 && (
        <div className="text-center py-8 text-terminal-dim text-sm">
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
