export interface DirectoryEntry {
  name: string;
  email: string;
  phone: string;
  department: string;
  title: string;
  role: string;
  structure: string;
}

// Platner campaign staff — add entries here as staff info becomes available
export const DIRECTORY: DirectoryEntry[] = [
  { name: "Graham Platner", email: "graham@grahamformaine.com", phone: "", department: "OVERALL", title: "Candidate", role: "U.S. Senate candidate, Maine 2026", structure: "CANDIDATE" },
];

export const STRUCTURES = [...new Set(DIRECTORY.map((d) => d.structure))].sort();
export const DEPARTMENTS = [...new Set(DIRECTORY.map((d) => d.department))].sort();
