/**
 * Update Intel Analysis
 * 
 * Aggregates campaign finance, social, and polling data
 * to generate strategic intelligence briefings.
 * 
 * Usage: npx tsx scripts/update-intel.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

// Candidate info
const CANDIDATES = [
  { name: "Eric Swalwell", party: "D" },
  { name: "Antonio Villaraigosa", party: "D" },
  { name: "Katie Porter", party: "D" },
  { name: "Tony Thurmond", party: "D" },
  { name: "Xavier Becerra", party: "D" },
  { name: "Tom Steyer", party: "D" },
  { name: "Betty Yee", party: "D" },
  { name: "Chad Bianco", party: "R" },
  { name: "Steve Hilton", party: "R" },
  { name: "Matt Mahan", party: "D" },
];

interface CandidateSnapshot {
  has_form_460: boolean;
  cash_on_hand: number;
  total_raised_460: number;
  total_spent_460: number;
  s497_raised: number;
  s497_donors: number;
  s497_pac_pct: number;
  rcpt_total: number;
  unique_donors: number;
  repeat_rate: number;
  small_dollar_pct: number;
  committee_transfers: number;
  ca_pct: number;
  total_debt: number;
  burn_rate: number;
  // Social metrics
  x_followers?: number;
  ig_followers?: number;
  tiktok_followers?: number;
  youtube_subs?: number;
  total_social?: number;
}

function readJson(filename: string): any {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, filename), "utf8"));
  } catch {
    console.warn(`Warning: Could not read ${filename}`);
    return null;
  }
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function generateObservations(snapshots: Record<string, CandidateSnapshot>): string[] {
  const observations: string[] = [];
  const entries = Object.entries(snapshots);

  // Sort by various metrics
  const byCash = entries.filter(([, s]) => s.cash_on_hand > 0).sort((a, b) => b[1].cash_on_hand - a[1].cash_on_hand);
  const byDonors = entries.filter(([, s]) => s.unique_donors > 0).sort((a, b) => b[1].unique_donors - a[1].unique_donors);
  const byS497 = entries.filter(([, s]) => s.s497_raised > 0).sort((a, b) => b[1].s497_raised - a[1].s497_raised);
  const byRepeatRate = entries.filter(([, s]) => s.repeat_rate > 0).sort((a, b) => b[1].repeat_rate - a[1].repeat_rate);
  const bySocial = entries.filter(([, s]) => (s.total_social || 0) > 0).sort((a, b) => (b[1].total_social || 0) - (a[1].total_social || 0));

  // Cash leader
  if (byCash.length > 0) {
    const [name, data] = byCash[0];
    if (data.has_form_460) {
      observations.push(`${name} leads Form 460 filers with ${formatMoney(data.cash_on_hand)} cash on hand.`);
    }
  }

  // S497 fundraising
  const s497Only = byS497.filter(([, s]) => !s.has_form_460);
  if (s497Only.length > 0) {
    const [name, data] = s497Only[0];
    observations.push(`${name} has raised ${formatMoney(data.s497_raised)} from ${data.s497_donors} S497 donors. No Form 460 filed yet.`);
  }

  // Self-funding detection
  for (const [name, data] of entries) {
    if (data.s497_donors > 0 && data.s497_donors <= 10 && data.s497_raised > 5_000_000) {
      observations.push(`${name} self-funding: ${formatMoney(data.s497_raised)} from ${data.s497_donors} donors (mostly self).`);
    }
  }

  // Grassroots leader
  if (byDonors.length > 0) {
    const [name, data] = byDonors[0];
    if (data.unique_donors > 1000) {
      observations.push(`${name} has strongest grassroots base: ${formatNumber(data.unique_donors)} donors, ${Math.round(data.repeat_rate * 100)}% repeat rate.`);
    }
  }

  // California-focused
  const caFocused = entries.filter(([, s]) => s.ca_pct > 0.9 && s.cash_on_hand > 100000);
  if (caFocused.length > 0) {
    const [name, data] = caFocused.sort((a, b) => b[1].ca_pct - a[1].ca_pct)[0];
    observations.push(`${name} most California-focused: ${Math.round(data.ca_pct * 100)}% in-state money.`);
  }

  // Debt concerns
  for (const [name, data] of entries) {
    if (data.total_debt > 0 && data.cash_on_hand > 0) {
      const debtRatio = data.total_debt / data.cash_on_hand;
      if (debtRatio > 0.5) {
        observations.push(`${name} has debt concerns: ${formatMoney(data.total_debt)} outstanding (${Math.round(debtRatio * 100)}% of cash).`);
      }
    }
  }

  // Burn rate warnings
  for (const [name, data] of entries) {
    if (data.burn_rate > 0.6 && data.total_spent_460 > 500000) {
      observations.push(`${name} spending aggressively: ${Math.round(data.burn_rate * 100)}% burn rate.`);
    }
  }

  // PAC reliance
  const pacReliant = entries.filter(([, s]) => s.s497_pac_pct > 0.5 && s.s497_raised > 500000);
  if (pacReliant.length > 0) {
    const [name, data] = pacReliant.sort((a, b) => b[1].s497_pac_pct - a[1].s497_pac_pct)[0];
    observations.push(`${name} relies heavily on PACs/committees: ${Math.round(data.s497_pac_pct * 100)}% of S497 from non-individual donors.`);
  }

  // Individual donor focus
  const individualFocused = entries.filter(([, s]) => s.s497_pac_pct < 0.15 && s.s497_donors > 100);
  if (individualFocused.length > 0) {
    const [name, data] = individualFocused.sort((a, b) => a[1].s497_pac_pct - b[1].s497_pac_pct)[0];
    observations.push(`${name} mostly individual donors: ${Math.round((1 - data.s497_pac_pct) * 100)}% from individuals (${data.s497_donors} S497 donors).`);
  }

  // Small dollar leader
  const smallDollar = entries.filter(([, s]) => s.small_dollar_pct > 0.3);
  if (smallDollar.length > 0) {
    const [name, data] = smallDollar.sort((a, b) => b[1].small_dollar_pct - a[1].small_dollar_pct)[0];
    const smallDollarAmount = data.rcpt_total * data.small_dollar_pct;
    observations.push(`${name} leads small-dollar fundraising: ${Math.round(data.small_dollar_pct * 100)}% of contributions under $500 (${formatMoney(smallDollarAmount)}).`);
  }

  // Social media leader
  if (bySocial.length > 0) {
    const [name, data] = bySocial[0];
    observations.push(`${name} leads social media reach: ${formatNumber(data.total_social || 0)} total followers across platforms.`);
  }

  return observations;
}

function generateNarrative(
  snapshots: Record<string, CandidateSnapshot>,
  observations: string[],
  dataPullDate: string
): string {
  const entries = Object.entries(snapshots);
  const withCash = entries.filter(([, s]) => s.cash_on_hand > 0 || s.unique_donors > 0)
    .sort((a, b) => b[1].cash_on_hand - a[1].cash_on_hand);

  let md = `# Campaign Intel Brief
**${dataPullDate}** | CAL-ACCESS Data Pull

---

## Competitive Position

| Candidate | Cash | Donors | Repeat Rate | CA % |
|-----------|------|--------|-------------|------|
`;

  for (const [name, data] of withCash) {
    const cash = data.cash_on_hand > 0 ? formatMoney(data.cash_on_hand) : "—";
    const donors = data.unique_donors > 0 ? formatNumber(data.unique_donors) : "—";
    const repeat = data.repeat_rate > 0 ? `${Math.round(data.repeat_rate * 100)}%` : "—";
    const ca = data.ca_pct > 0 ? `${Math.round(data.ca_pct * 100)}%` : "—";
    md += `| ${name} | ${cash} | ${donors} | ${repeat} | ${ca} |\n`;
  }

  md += `
---

## Strategic Observations

`;

  observations.forEach((obs, i) => {
    md += `${i + 1}. ${obs}\n\n`;
  });

  md += `---

## S497 Late Contributions

| Candidate | S497 Raised | Donors | PAC % |
|-----------|-------------|--------|-------|
`;

  const byS497 = entries.filter(([, s]) => s.s497_raised > 0)
    .sort((a, b) => b[1].s497_raised - a[1].s497_raised);

  for (const [name, data] of byS497) {
    md += `| ${name} | ${formatMoney(data.s497_raised)} | ${data.s497_donors} | ${Math.round(data.s497_pac_pct * 100)}% |\n`;
  }

  md += `
---

*Generated ${new Date().toISOString()}*
`;

  return md;
}

async function main() {
  console.log("📊 Updating Intel Analysis...\n");

  // Load data files
  const summary = readJson("campaign-summary.json");
  const contributions = readJson("campaign-contributions.json");
  const debts = readJson("campaign-debts.json");
  const geography = readJson("campaign-geography.json");
  const socialStats = readJson("social-stats.json");

  const snapshots: Record<string, CandidateSnapshot> = {};
  const dataPullDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });

  // Build snapshots for each candidate
  for (const candidate of CANDIDATES) {
    const name = candidate.name;
    
    // Get summary data (uses total_receipts, total_expenditures)
    const summaryData = summary?.candidates?.[name] || {};
    
    // Get contribution data (uses total_raised, repeat_donor_rate, by_size)
    const contribData = contributions?.candidates?.[name] || {};
    
    // Get debt data
    const debtData = debts?.candidates?.[name] || {};
    
    // Get geography data
    const geoData = geography?.candidates?.[name] || {};
    
    // Get social data
    const socialData = socialStats?.candidates?.[name];
    const latestSocial = socialData?.history?.[socialData?.history?.length - 1];

    // Calculate small dollar percentage from contribution size breakdown
    const totalContrib = contribData.total_raised || 0;
    const smallDollar = contribData.by_size?.small || 0;
    const smallDollarPct = totalContrib > 0 ? smallDollar / totalContrib : 0;

    // S497 data from campaign-finance.json (late contributions)
    const financeData = readJson("campaign-finance.json")?.candidates?.[name] || {};
    
    const snapshot: CandidateSnapshot = {
      has_form_460: summaryData.has_form_460 || false,
      cash_on_hand: summaryData.cash_on_hand || 0,
      total_raised_460: summaryData.total_receipts || 0,
      total_spent_460: summaryData.total_expenditures || 0,
      s497_raised: summaryData.s497_total_raised || financeData.total_raised || 0,
      s497_donors: financeData.donor_count || 0,
      s497_pac_pct: 0, // Would need to calculate from donor types
      rcpt_total: contribData.total_raised || 0,
      unique_donors: contribData.unique_donors || 0,
      repeat_rate: contribData.repeat_donor_rate || 0,
      small_dollar_pct: smallDollarPct,
      committee_transfers: contribData.by_type?.Committee || 0,
      ca_pct: geoData.in_state_pct || 0,
      total_debt: debtData.total_debt || summaryData.accrued_expenses || 0,
      burn_rate: summaryData.burn_rate || 0,
      // Social metrics
      x_followers: latestSocial?.x || undefined,
      ig_followers: latestSocial?.instagram || undefined,
      tiktok_followers: latestSocial?.tiktok || undefined,
      youtube_subs: latestSocial?.youtube || undefined,
      total_social: (latestSocial?.x || 0) + (latestSocial?.instagram || 0) + 
                    (latestSocial?.tiktok || 0) + (latestSocial?.youtube || 0) || undefined,
    };

    snapshots[name] = snapshot;
  }

  // Generate rankings
  const withCash = Object.entries(snapshots).filter(([, s]) => s.cash_on_hand > 0);
  const withDonors = Object.entries(snapshots).filter(([, s]) => s.unique_donors > 0);
  const withRepeat = Object.entries(snapshots).filter(([, s]) => s.repeat_rate > 0);

  const rankings = {
    by_cash: withCash.sort((a, b) => b[1].cash_on_hand - a[1].cash_on_hand).map(([n]) => n),
    by_donors: withDonors.sort((a, b) => b[1].unique_donors - a[1].unique_donors).map(([n]) => n),
    by_repeat_rate: withRepeat.sort((a, b) => b[1].repeat_rate - a[1].repeat_rate).map(([n]) => n),
  };

  // Generate observations
  const observations = generateObservations(snapshots);

  // Generate regional notes from geography data
  const regionalNotes: string[] = [];
  if (geography?.candidates) {
    for (const [name, data] of Object.entries(geography.candidates) as [string, any][]) {
      // Find top region from by_region object
      if (data.by_region) {
        const regions = Object.entries(data.by_region) as [string, number][];
        const topRegion = regions.sort((a, b) => b[1] - a[1])[0];
        if (topRegion && topRegion[1] > 100000) {
          regionalNotes.push(`${name}: ${formatMoney(topRegion[1])} from ${topRegion[0]}`);
        }
      }
    }
  }

  // Build output
  const output = {
    generated_at: new Date().toISOString(),
    data_pull_date: dataPullDate,
    observations,
    regional_notes: regionalNotes,
    rankings,
    snapshots,
  };

  // Write JSON
  writeFileSync(
    join(DATA_DIR, "intel-analysis.json"),
    JSON.stringify(output, null, 2)
  );
  console.log("✅ Wrote intel-analysis.json");

  // Generate and write narrative
  const narrative = generateNarrative(snapshots, observations, dataPullDate);
  writeFileSync(join(DATA_DIR, "intel-narrative.md"), narrative);
  console.log("✅ Wrote intel-narrative.md");

  console.log(`\n📊 Intel refresh complete!`);
  console.log(`   ${observations.length} observations generated`);
  console.log(`   ${Object.keys(snapshots).length} candidate snapshots`);
}

main().catch(console.error);
