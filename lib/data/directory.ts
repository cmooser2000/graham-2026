export interface DirectoryEntry {
  name: string;
  email: string;
  phone: string;
  department: string;
  title: string;
  role: string;
  structure: string;
}

export const DIRECTORY: DirectoryEntry[] = [
  { name: "Graham Platner", email: "graham@grahamformaine.com", phone: "", department: "OVERALL", title: "Candidate", role: "U.S. Senate candidate, Maine 2026", structure: "CANDIDATE" },
  { name: "Ben Chin", email: "graham@grahamformaine.com", phone: "", department: "OVERALL", title: "Campaign Manager", role: "", structure: "IN HOUSE" },
  { name: "Ben Martello", email: "graham@grahamformaine.com", phone: "", department: "FINANCE", title: "Treasurer", role: "", structure: "IN HOUSE" },
  { name: "Spencer Toth", email: "graham@grahamformaine.com", phone: "", department: "FIELD", title: "Field Director", role: "", structure: "IN HOUSE" },
  { name: "Kelena Spencer", email: "graham@grahamformaine.com", phone: "", department: "FIELD", title: "Deputy Field Director", role: "", structure: "IN HOUSE" },
  { name: "Amy Gertner", email: "graham@grahamformaine.com", phone: "", department: "OPERATIONS", title: "Volunteer Coordinator & Scheduler", role: "", structure: "IN HOUSE" },
  { name: "Morris Katz / The Fight Agency", email: "graham@grahamformaine.com", phone: "", department: "COMMS", title: "Communications Consulting", role: "", structure: "CONSULTANT" },
];

export const STRUCTURES = [...new Set(DIRECTORY.map((d) => d.structure))].sort();
export const DEPARTMENTS = [...new Set(DIRECTORY.map((d) => d.department))].sort();
