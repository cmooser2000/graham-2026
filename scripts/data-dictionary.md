# SWALLWELL 2026 — Data Dictionary

Database tracking the **California 2026 Governor's race**. 9 primary candidates. PostgreSQL.

---

## CANDIDATES (core lookup)

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Candidate ID (FK everywhere) |
| name | TEXT UNIQUE | Full name (e.g., "Eric Swalwell", "Katie Porter") |
| filer_id | INTEGER | CAL-ACCESS filer ID |
| party | TEXT | "D" (Democrat) or "R" (Republican) |
| has_form_460 | BOOLEAN | Whether they have filed Form 460 (official campaign finance) |
| is_primary | BOOLEAN | Primary candidate (true for the 9 tracked candidates) |

**Candidate names**: Eric Swalwell, Katie Porter, Rob Bonta, Toni Atkins, Robert Garcia, Matt Mahan, Mark Meuser, Rick Caruso, Nathan Hochman

---

## CAMPAIGN FINANCE

### campaign_summary (one row per candidate)
Overall financial snapshot from Form 460 + S497 filings.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| cash_on_hand | NUMERIC | Current cash balance |
| total_receipts | NUMERIC | Total money raised (Form 460) |
| total_expenditures | NUMERIC | Total money spent |
| accrued_expenses | NUMERIC | Outstanding obligations |
| burn_rate | NUMERIC | Monthly spending rate as a fraction (e.g., 0.15 = 15%) |
| runway_months | NUMERIC | Months until cash depleted at current burn rate |
| s497_total_raised | NUMERIC | Late contributions (S497 filings, within 24hrs of election) |

### contributions (one row per candidate)
Donor aggregates from Form 460 RCPT_CD schedule.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| total_raised | NUMERIC | Total raised from itemized contributions |
| contribution_count | INTEGER | Number of contributions |
| unique_donors | INTEGER | Number of distinct donors |
| avg_contribution | NUMERIC | Average donation amount |
| repeat_donor_amount | NUMERIC | Total from repeat donors |
| repeat_donor_count | INTEGER | Number of repeat donors |
| repeat_donor_rate | NUMERIC | repeat_donor_count / unique_donors (0-1 scale) |

### contributions_by_size (one row per candidate × bucket)
Donor segmentation by donation size.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| size_bucket | TEXT | **Values: "small", "medium", "large", "major"** |
| amount | NUMERIC | Total raised in this bucket |
| count | INTEGER | Number of contributions in this bucket |

**Size buckets**: small (<$100, grassroots), medium ($100-499), large ($500-999), major ($1,000+)

### contributions_by_type (one row per candidate × type)
Donor segmentation by donor entity type.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| donor_type | TEXT | **Values: "Individual", "Committee", "Other", "Small Contributor Committee"** |
| amount | NUMERIC | Total raised from this type |
| count | INTEGER | Number of contributions from this type |

### contributions_monthly (time series, one row per candidate × month)
Monthly fundraising totals.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| month | TEXT | Format "YYYY-MM" (e.g., "2025-06") |
| amount | NUMERIC | Total raised that month |

### top_donors (multiple rows per candidate)
Largest individual donors ranked by amount.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| source | TEXT | **Values: "form460", "s497"** — which filing the donation came from |
| donor_name | TEXT | Name of the donor |
| amount | NUMERIC | Total donated |
| donations | INTEGER | Number of separate donations |
| employer | TEXT | Donor's employer (nullable) |
| occupation | TEXT | Donor's occupation (nullable) |
| city | TEXT | Donor's city (nullable) |
| state | TEXT | Donor's state (nullable) |

---

## SPENDING

### spending (one row per candidate)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| total_spending | NUMERIC | Total expenditures |
| expenditure_count | INTEGER | Number of expenditure records |

### spending_by_category (one row per candidate × category)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| category | TEXT | **Values: "Media/Ads", "Consultants", "Staff", "Events", "Travel", "Overhead", "Legal", "Other"** |
| amount | NUMERIC | Total spent in category |

### top_vendors (multiple rows per candidate)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| vendor_name | TEXT | Vendor/payee name |
| amount | NUMERIC | Total paid to vendor |

---

## DEBT & LOANS

### debts (one row per candidate)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| total_debt | NUMERIC | Outstanding debt |
| total_loans | NUMERIC | Total loans received |
| self_loans | NUMERIC | Loans from the candidate themselves |

### top_creditors / top_lenders (multiple rows per candidate)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| name | TEXT | Creditor or lender name |
| amount | NUMERIC | Amount owed or lent |

---

## GEOGRAPHY

### geography (one row per candidate)
In-state vs out-of-state fundraising breakdown.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| in_state_amount | NUMERIC | Raised from California donors |
| out_of_state_amount | NUMERIC | Raised from out-of-state donors |
| in_state_pct | NUMERIC | Fraction from in-state (0-1 scale, e.g., 0.85 = 85%) |
| diversity_score | INTEGER | Geographic diversity metric |

### geography_by_region (one row per candidate × region)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| region | TEXT | California region name |
| amount | NUMERIC | Raised from that region |

### geography_top_cities (multiple rows per candidate)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| city | TEXT | City name |
| amount | NUMERIC | Raised from that city |

### geography_top_states (multiple rows per candidate)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| state | TEXT | US state abbreviation |
| amount | NUMERIC | Raised from that state |

---

## CAMPAIGN TIMELINE

### campaign_timeline (one row per candidate × month)
Monthly financial snapshots with derived analytics.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| month | TEXT | Format "YYYY-MM" |
| contributions | NUMERIC | Raised that month |
| spending | NUMERIC | Spent that month |
| net | NUMERIC | contributions - spending |
| cumulative_raised | NUMERIC | Running total raised |
| cumulative_spent | NUMERIC | Running total spent |
| mom_growth | NUMERIC | Month-over-month contribution growth rate |
| trail_3m_contrib | NUMERIC | Rolling 3-month average contributions |

---

## CAMPAIGN FILINGS

### campaign_filings (multiple rows per candidate)
Official filing records from CAL-ACCESS.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| filing_id | INTEGER | Unique filing identifier |
| form_type | TEXT | **Values: "460", "497"** (Form 460 = standard, S497 = late) |
| thru_date | TEXT | Period end date |
| rpt_date | TEXT | Report filing date |
| cash_on_hand | NUMERIC | Cash at period end |
| receipts | NUMERIC | Receipts for that period |
| expenditures | NUMERIC | Expenditures for that period |

---

## LATE CONTRIBUTIONS (S497)

### late_contributions (one row per candidate)
Summary of S497 late-filed contributions.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| total_raised | NUMERIC | Total late contributions |
| donor_count | INTEGER | Number of late donors |
| avg_donation | NUMERIC | Average late donation |

### late_contribution_by_state (one row per candidate × state)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| state | TEXT | US state abbreviation |
| amount | NUMERIC | Late contributions from that state |

### late_contribution_by_occupation (one row per candidate × occupation)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| occupation | TEXT | Donor occupation |
| count | INTEGER | Number of donors |
| amount | NUMERIC | Total amount |

---

## YOUTUBE

### youtube_channels (one row per candidate)
YouTube channel metadata.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| channel_id | TEXT | YouTube channel ID |
| handle | TEXT | YouTube handle (e.g., "@ericswalwell") |
| url | TEXT | Channel URL |
| bio | TEXT | Channel description |
| verified | BOOLEAN | Is channel verified |
| avatar | TEXT | Avatar image URL |
| subscribers | INTEGER | Current subscriber count |
| total_videos | INTEGER | Total published videos |

### youtube_videos (multiple rows per candidate)
Individual video performance.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| video_id | TEXT | YouTube video ID |
| url | TEXT | Video URL |
| title | TEXT | Video title |
| description | TEXT | Video description |
| thumbnail | TEXT | Thumbnail URL |
| published_at | TIMESTAMPTZ | Publish date |
| views | INTEGER | View count |
| likes | INTEGER | Like count |
| comments | INTEGER | Comment count |
| engagement | INTEGER | Total engagement (likes + comments) |
| engagement_rate | NUMERIC | engagement / views (0-1 scale) |

### youtube_subscriber_history (daily time series)
Daily subscriber snapshots for growth tracking.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| date | DATE | Snapshot date |
| subscribers | INTEGER | Subscriber count on that date |
| total_videos | INTEGER | Video count on that date |

### youtube_video_history (daily time series per video)
Daily video stat snapshots for view velocity tracking.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| video_id | TEXT | YouTube video ID |
| date | DATE | Snapshot date |
| views | INTEGER | View count on that date |
| likes | INTEGER | Like count on that date |
| comments | INTEGER | Comment count on that date |

---

## GOOGLE TRENDS

### google_trends (daily time series)
Google search interest over time. **Values are relative (0-100 scale)**, not absolute search counts. 100 = peak interest in the time range.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| date | DATE | Date of measurement |
| search_interest | INTEGER | Relative search interest (0-100) |

---

## WIKIPEDIA

### wiki_pageviews (daily time series)
Daily Wikipedia article pageview counts. **Values are absolute counts** (not relative).

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| date | DATE | Date |
| views | INTEGER | Number of pageviews that day |

**Spike detection**: a spike is when daily views > 3× the rolling 30-day median (indicates news events).

---

## SOCIAL ACCOUNTS & HISTORY

### social_accounts (one row per candidate × platform)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| platform | TEXT | Platform name (e.g., "youtube", "twitter") |
| handle | TEXT | Account handle |
| url | TEXT | Profile URL |

### social_follower_history (daily time series)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| platform | TEXT | Platform name |
| date | DATE | Snapshot date |
| followers | INTEGER | Follower count on that date |

---

## INTEL (composite/analytical)

### intel_snapshots (one row per candidate)
Denormalized composite metrics for quick overview.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| has_form_460 | BOOLEAN | Has official filings |
| cash_on_hand | NUMERIC | Current cash |
| total_raised_460, total_spent_460 | NUMERIC | Form 460 totals |
| s497_raised | NUMERIC | Late contributions |
| s497_donors | INTEGER | Late contribution donor count |
| s497_pac_pct | NUMERIC | % of S497 from PACs |
| rcpt_total | NUMERIC | Total receipts |
| unique_donors, repeat_rate | | Donor metrics |
| small_dollar_pct | NUMERIC | Fraction from donations <$100 |
| committee_transfers | NUMERIC | Transfers from committees |
| ca_pct | NUMERIC | California donor percentage |
| total_debt, burn_rate | NUMERIC | Debt & spending rate |

### intel_observations (standalone text)
Analyst observations about the race.

| Column | Type | Description |
|--------|------|-------------|
| category | TEXT | **Values: "observation", "regional_note"** |
| text | TEXT | The observation text |

---

## VIEWS (pre-joined for convenience)

### candidate_overview
Flattened view joining candidates + campaign_summary + contributions + debts + geography + late_contributions. **Only primary candidates** (is_primary = true).

Key columns: id, name, party, has_form_460, cash_on_hand, total_receipts, total_expenditures, burn_rate, runway_months, s497_total_raised, rcpt_total_raised, contribution_count, unique_donors, avg_contribution, repeat_donor_rate, total_debt, total_loans, self_loans, in_state_amount, out_of_state_amount, in_state_pct, diversity_score, late_total_raised, late_donor_count

### candidate_social_reach
Latest follower counts per platform.

Key columns: id, name, party, platform, handle, latest_followers

---

## INDEPENDENT EXPENDITURES (Form 496)

Outside money spent by IE committees to support or oppose candidates. This is NOT money raised by the candidate — it's third-party spending.

### ie_summary (one row per candidate)
| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| total_support | NUMERIC | Total IE spending TO SUPPORT this candidate |
| total_oppose | NUMERIC | Total IE spending TO OPPOSE this candidate |
| net_support | NUMERIC | total_support - total_oppose |
| committee_count | INTEGER | Number of distinct IE committees targeting this candidate |

### ie_committees (multiple rows per candidate)
Top committees making independent expenditures for/against each candidate.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| committee_name | TEXT | IE committee name |
| support | NUMERIC | Amount spent supporting |
| oppose | NUMERIC | Amount spent opposing |
| total | NUMERIC | Total spent (support + oppose) |

### independent_expenditures (detail rows)
Individual independent expenditure records.

| Column | Type | Description |
|--------|------|-------------|
| candidate_id | FK → candidates | |
| committee_name | TEXT | IE committee that made the expenditure |
| support_oppose | TEXT | **Values: "S" (support), "O" (oppose)** |
| amount | NUMERIC | Dollar amount |
| date | TEXT | Date of expenditure |
| description | TEXT | Description of expenditure |

---

## POLLING

### polls (one row per poll)
Polling data from aggregators (RealClearPolitics, VoteHub).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Poll ID |
| pollster | TEXT | Polling firm name |
| start_date | DATE | Field dates start |
| end_date | DATE | Field dates end |
| sample_size | INTEGER | Number of respondents (nullable) |
| population | TEXT | **Values: "LV" (likely voters), "RV" (registered voters), "A" (adults)** |
| margin_of_error | NUMERIC | ± margin of error (nullable) |
| source_url | TEXT | URL of source |
| source | TEXT | **Values: "rcp", "votehub", "manual"** |

### poll_results (one row per candidate per poll)
| Column | Type | Description |
|--------|------|-------------|
| poll_id | FK → polls | |
| candidate_id | FK → candidates | (nullable — not all polled candidates are tracked) |
| candidate_name | TEXT | Candidate name as it appeared in poll |
| percentage | NUMERIC | Poll percentage (e.g., 23.5) |
| party | TEXT | "D" or "R" |

**Note**: Early in the race, very few polls exist. The primary is June 2026.

---

## DATA NOT IN DATABASE

**Prediction markets** (Polymarket, Kalshi) are fetched live from external APIs and are NOT stored in the database. You cannot query market odds via SQL.

---

## RELATIONSHIP MAP

All tables with `candidate_id` join to `candidates.id`. Common pattern:

```sql
SELECT c.name, ... FROM some_table t JOIN candidates c ON c.id = t.candidate_id
```

**Time series tables** (for trend/history queries): google_trends, wiki_pageviews, youtube_subscriber_history, youtube_video_history, social_follower_history, contributions_monthly, campaign_timeline

**Per-candidate aggregates** (one row each): campaign_summary, contributions, spending, debts, geography, late_contributions, intel_snapshots, youtube_channels, ie_summary

**Breakdowns** (multiple rows per candidate): contributions_by_size, contributions_by_type, spending_by_category, geography_by_region, geography_top_cities, geography_top_states, late_contribution_by_state, late_contribution_by_occupation, ie_committees

**Detail rows** (many per candidate): top_donors, top_vendors, top_creditors, top_lenders, youtube_videos, campaign_filings, campaign_timeline, contributions_monthly, independent_expenditures

**Polling tables** (not per-candidate FK): polls → poll_results (JOIN via poll_id; poll_results.candidate_id is nullable)
