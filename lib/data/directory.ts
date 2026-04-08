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
  { name: "Allie Owen", email: "Alexandriajowen@gmail.com", phone: "(949) 606-6884", department: "FINANCE", title: "Fundraising Advisor", role: "Works with fundraising team to maintain goals and deadlines for cashflow", structure: "FORMAL ADVISOR" },
  { name: "Aurash Gomraki", email: "aurush@ericswalwell.com", phone: "(925) 895-3635", department: "FINANCE", title: "Finance Assistant", role: "", structure: "IN HOUSE" },
  { name: "Aurash Gomraki", email: "shirabeth1@gmail.com", phone: "(562) 252-2505", department: "FINANCE", title: "Research Director", role: "Primarily assists with questionnaires and daily briefings", structure: "IN HOUSE" },
  { name: "Benjamin Seinfeld", email: "benseinfeld@gmail.com", phone: "(818) 441-4430", department: "OVERALL", title: "Deputy Campaign Manager", role: "Special focus on party relationships", structure: "IN HOUSE" },
  { name: "Brent Comstock", email: "brent@bcomonline.com", phone: "(402) 414-1909", department: "COMMS + FINANCE", title: "(BCom) Digital Fundraiser", role: "", structure: "CONSULTANT" },
  { name: "Bret Ladine", email: "bret.ladine@gmail.com", phone: "(415) 531-6994", department: "POLICY", title: "Policy Director", role: "Crafts and organizes policy proposals", structure: "IN HOUSE" },
  { name: "Caitlin Kennedy", email: "caitlinkennedyy18@gmail.com", phone: "(510) 816-2248", department: "OPERATIONS", title: "Candidate Operations Manager", role: "Staffs candidate across the state; acts as on the road liaison to the rest of the team", structure: "IN HOUSE" },
  { name: "Courtni Pugh", email: "cpugh@hilltoppublicsolutions.com", phone: "(213) 453-3455", department: "OUTREACH", title: "Strategic Advisor", role: "", structure: "CONSULTANT" },
  { name: "Dan Kully", email: "dan@kmm-strategies.com", phone: "(206) 683-1138", department: "COMMS", title: "(KMM) General Consultant", role: "", structure: "CONSULTANT" },
  { name: "Darly Meyer", email: "dameyer77@yahoo.com", phone: "(561) 628-2999", department: "OPERATIONS", title: "Security/Driver", role: "", structure: "IN HOUSE" },
  { name: "David Kim", email: "davidisgood@gmail.com", phone: "(917) 664-0076", department: "COMMS", title: "Messaging Advisor", role: "Acts as unofficial speechwriter", structure: "VOLUNTEER ADVISOR" },
  { name: "Drew Persinger", email: "drew@bhstrategiesllc.com", phone: "(443) 613-9994", department: "FINANCE", title: "(BHS) National Fundraiser", role: "", structure: "CONSULTANT" },
  { name: "Emily Kirby Goodman", email: "emily@emcresearch.com", phone: "(817) 501-8157", department: "POLLING", title: "(EMC Research) Pollster - Lead", role: "", structure: "CONSULTANT" },
  { name: "Iris Alonzo", email: "Iris@1000.world", phone: "(213) 305-9450", department: "COMMS", title: "Creative Director", role: "Strategic branding advice & implementation", structure: "VOLUNTEER ADVISOR" },
  { name: "Isabella Nave", email: "sabella@bhstrategiesllc.com", phone: "(267) 416-2562", department: "FINANCE", title: "(BHS) National Fundraiser", role: "", structure: "CONSULTANT" },
  { name: "Joe Pientka", email: "jpientka@me.com", phone: "(202) 733-0774", department: "OPERATIONS", title: "Security - Lead", role: "POC for all security needs", structure: "IN HOUSE" },
  { name: "Joel Miller", email: "swalwellscheduler@gmail.com", phone: "(616) 610-3146", department: "OPERATIONS", title: "Director of Operations (outgoing)", role: "", structure: "IN HOUSE" },
  { name: "Julie Sandino", email: "julie@jsm-strategies.com", phone: "(916) 997-2706", department: "FINANCE", title: "(JSMS) Sacramento Fundraiser - Lead", role: "Sacramento/third house fundraising", structure: "CONSULTANT" },
  { name: "Kate Maeder", email: "kate@kmm-strategies.com", phone: "(310) 989-4299", department: "OVERALL", title: "(KMM) General Consultant - Lead", role: "", structure: "CONSULTANT" },
  { name: "Kristin Mifsud", email: "kristingmifsud@gmail.com", phone: "(925) 765-7358", department: "OPERATIONS", title: "Director of Operations (incoming)", role: "All scheduling and operations for candidate and campaign team", structure: "IN HOUSE" },
  { name: "Maggie Muir", email: "maggie@kmm-strategies.com", phone: "(510) 219-8008", department: "COMMS", title: "(KMM) General Consultant", role: "", structure: "CONSULTANT" },
  { name: "Mary Hodge", email: "hodge.mary@gmail.com", phone: "(330) 990-2500", department: "OVERALL", title: "Senior Advisor", role: "Strategic advice & management of outreach team", structure: "IN HOUSE" },
  { name: "Micah Beasley", email: "micah.brooks.beasley@gmail.com", phone: "(919) 417-9366", department: "COMMS", title: "Communications Director", role: "", structure: "IN HOUSE" },
  { name: "Perry Meade", email: "perrymeade22@gmail.com", phone: "(949) 521-4968", department: "OUTREACH", title: "Political Director", role: "Special focus on labor", structure: "IN HOUSE" },
  { name: "Raphael Liy", email: "r4phaelliy@gmail.com", phone: "(305) 206-7323", department: "COMMS", title: "Digital Director", role: "Films, produces, and edits videos, graphics", structure: "IN HOUSE" },
  { name: "Rebecca Rosenberg", email: "rebecca@bcomonline.com", phone: "(216) 246-7171", department: "COMMS + FINANCE", title: "(BCom) Digital Fundraiser - Lead", role: "", structure: "CONSULTANT" },
  { name: "Redmond Walsh", email: "redwalsh@verizon.net", phone: "(202) 486-8887", department: "OPERATIONS", title: "Advance Director", role: "", structure: "IN HOUSE" },
  { name: "Rep. Adam Gray", email: "adam@adamgrayforcongress.com", phone: "", department: "OVERALL", title: "Campaign Co-Chair", role: "", structure: "VOLUNTEER ADVISOR" },
  { name: "Rep. Jimmy Gomez", email: "JimmyGomez1@gmail.com", phone: "", department: "OVERALL", title: "Campaign Chair", role: "", structure: "VOLUNTEER ADVISOR" },
  { name: "Ryan Raicht", email: "rraicht23@gmail.com", phone: "(917) 941-4191", department: "OPERATIONS", title: "Scheduling Assistant", role: "", structure: "IN HOUSE" },
  { name: "Sean Jones", email: "sean@ericswalwell.com", phone: "(202) 277-3463", department: "OPERATIONS", title: "Comptroller", role: "POC for staff travel, all receipts, signing of documents, etc.", structure: "IN HOUSE" },
  { name: "Sebastian Mercado", email: "Sebastian@jsm-strategies.com", phone: "(916) 505-2783", department: "FINANCE", title: "(JSMS) Sacramento Fundraiser", role: "Sacramento/third house fundraising", structure: "CONSULTANT" },
  { name: "Stephanie Berger", email: "stephanie@bhstrategiesll.com", phone: "(202) 262-9962", department: "FINANCE", title: "(BHS) National Fundraiser - Lead", role: "", structure: "CONSULTANT" },
  { name: "Sunjay Muralitharan", email: "sunjaymuralitharan@gmail.com", phone: "(510) 600-9777", department: "OPERATIONS", title: "Volunteer Coordinator", role: "", structure: "IN HOUSE" },
  { name: "Tino Garcia", email: "cgarcia@ericswalwell.com", phone: "(510) 856-6427", department: "FINANCE", title: "Finance Director", role: "Overall fundraising lead", structure: "IN HOUSE" },
  { name: "Yardena Wolf", email: "yardena.wolf@gmail.com", phone: "(541) 286-0113", department: "OVERALL", title: "Campaign Manager", role: "", structure: "IN HOUSE" },
];

export const STRUCTURES = [...new Set(DIRECTORY.map((d) => d.structure))].sort();
export const DEPARTMENTS = [...new Set(DIRECTORY.map((d) => d.department))].sort();
