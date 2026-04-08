-- SWALLWELL 2026 - CA Governor Race Database Schema

-- Core lookup table
CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  filer_id INTEGER,
  party TEXT,
  has_form_460 BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT true
);

-- Campaign finance summary (Form 460 + S497)
CREATE TABLE IF NOT EXISTS campaign_summary (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  cash_on_hand NUMERIC DEFAULT 0,
  total_receipts NUMERIC DEFAULT 0,
  total_expenditures NUMERIC DEFAULT 0,
  accrued_expenses NUMERIC DEFAULT 0,
  burn_rate NUMERIC DEFAULT 0,
  runway_months NUMERIC,
  s497_total_raised NUMERIC DEFAULT 0,
  UNIQUE(candidate_id)
);

-- Contribution aggregates (Form 460 RCPT_CD)
CREATE TABLE IF NOT EXISTS contributions (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  total_raised NUMERIC DEFAULT 0,
  contribution_count INTEGER DEFAULT 0,
  unique_donors INTEGER DEFAULT 0,
  avg_contribution NUMERIC DEFAULT 0,
  repeat_donor_amount NUMERIC DEFAULT 0,
  repeat_donor_count INTEGER DEFAULT 0,
  repeat_donor_rate NUMERIC DEFAULT 0,
  UNIQUE(candidate_id)
);

-- Contributions by size bucket
CREATE TABLE IF NOT EXISTS contributions_by_size (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  size_bucket TEXT NOT NULL, -- small, medium, large, major
  amount NUMERIC DEFAULT 0,
  count INTEGER DEFAULT 0,
  UNIQUE(candidate_id, size_bucket)
);

-- Contributions by donor type
CREATE TABLE IF NOT EXISTS contributions_by_type (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  donor_type TEXT NOT NULL, -- Individual, Committee, Other, Small Contributor Committee
  amount NUMERIC DEFAULT 0,
  count INTEGER DEFAULT 0,
  UNIQUE(candidate_id, donor_type)
);

-- Monthly contribution time series
CREATE TABLE IF NOT EXISTS contributions_monthly (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  month TEXT NOT NULL, -- YYYY-MM
  amount NUMERIC DEFAULT 0,
  UNIQUE(candidate_id, month)
);

-- Top donors (from Form 460 RCPT_CD)
CREATE TABLE IF NOT EXISTS top_donors (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  source TEXT NOT NULL DEFAULT 'form460', -- form460 or s497
  donor_name TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  donations INTEGER DEFAULT 0,
  employer TEXT,
  occupation TEXT,
  city TEXT,
  state TEXT
);

-- Spending summary
CREATE TABLE IF NOT EXISTS spending (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  total_spending NUMERIC DEFAULT 0,
  expenditure_count INTEGER DEFAULT 0,
  UNIQUE(candidate_id)
);

-- Spending by category
CREATE TABLE IF NOT EXISTS spending_by_category (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  category TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  UNIQUE(candidate_id, category)
);

-- Top vendors
CREATE TABLE IF NOT EXISTS top_vendors (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  vendor_name TEXT NOT NULL,
  amount NUMERIC DEFAULT 0
);

-- Debts and loans
CREATE TABLE IF NOT EXISTS debts (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  total_debt NUMERIC DEFAULT 0,
  total_loans NUMERIC DEFAULT 0,
  self_loans NUMERIC DEFAULT 0,
  UNIQUE(candidate_id)
);

-- Top creditors
CREATE TABLE IF NOT EXISTS top_creditors (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  name TEXT NOT NULL,
  amount NUMERIC DEFAULT 0
);

-- Top lenders
CREATE TABLE IF NOT EXISTS top_lenders (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  name TEXT NOT NULL,
  amount NUMERIC DEFAULT 0
);

-- Geographic breakdown
CREATE TABLE IF NOT EXISTS geography (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  in_state_amount NUMERIC DEFAULT 0,
  out_of_state_amount NUMERIC DEFAULT 0,
  in_state_pct NUMERIC DEFAULT 0,
  diversity_score INTEGER DEFAULT 0,
  UNIQUE(candidate_id)
);

-- Geography by region
CREATE TABLE IF NOT EXISTS geography_by_region (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  region TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  UNIQUE(candidate_id, region)
);

-- Top cities
CREATE TABLE IF NOT EXISTS geography_top_cities (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  city TEXT NOT NULL,
  amount NUMERIC DEFAULT 0
);

-- Top states
CREATE TABLE IF NOT EXISTS geography_top_states (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  state TEXT NOT NULL,
  amount NUMERIC DEFAULT 0
);

-- Campaign timeline (monthly snapshots)
CREATE TABLE IF NOT EXISTS campaign_timeline (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  month TEXT NOT NULL,
  contributions NUMERIC DEFAULT 0,
  spending NUMERIC DEFAULT 0,
  net NUMERIC DEFAULT 0,
  cumulative_raised NUMERIC DEFAULT 0,
  cumulative_spent NUMERIC DEFAULT 0,
  mom_growth NUMERIC,
  trail_3m_contrib NUMERIC,
  UNIQUE(candidate_id, month)
);

-- Filing records
CREATE TABLE IF NOT EXISTS campaign_filings (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  filing_id INTEGER NOT NULL,
  form_type TEXT,
  thru_date TEXT,
  rpt_date TEXT,
  cash_on_hand NUMERIC DEFAULT 0,
  receipts NUMERIC DEFAULT 0,
  expenditures NUMERIC DEFAULT 0
);

-- Late contributions (S497)
CREATE TABLE IF NOT EXISTS late_contributions (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  total_raised NUMERIC DEFAULT 0,
  donor_count INTEGER DEFAULT 0,
  avg_donation NUMERIC DEFAULT 0,
  UNIQUE(candidate_id)
);

-- Late contribution by state
CREATE TABLE IF NOT EXISTS late_contribution_by_state (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  state TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  UNIQUE(candidate_id, state)
);

-- Late contribution by occupation
CREATE TABLE IF NOT EXISTS late_contribution_by_occupation (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  occupation TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  UNIQUE(candidate_id, occupation)
);

-- Independent expenditures (Form 496 - outside money for/against candidates)
CREATE TABLE IF NOT EXISTS independent_expenditures (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  committee_name TEXT NOT NULL,
  support_oppose TEXT NOT NULL,  -- 'S' (support) or 'O' (oppose)
  amount NUMERIC(12,2),
  date TEXT,
  description TEXT
);

-- Independent expenditure summary (one row per candidate)
CREATE TABLE IF NOT EXISTS ie_summary (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  total_support NUMERIC(12,2) DEFAULT 0,
  total_oppose NUMERIC(12,2) DEFAULT 0,
  net_support NUMERIC(12,2) DEFAULT 0,
  committee_count INTEGER DEFAULT 0,
  UNIQUE(candidate_id)
);

-- IE committees (top committees spending for/against each candidate)
CREATE TABLE IF NOT EXISTS ie_committees (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  committee_name TEXT NOT NULL,
  support NUMERIC(12,2) DEFAULT 0,
  oppose NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0
);

-- Polls (polling data from aggregators)
CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  pollster TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  sample_size INTEGER,
  population TEXT,        -- 'RV' (registered voters), 'LV' (likely voters), 'A' (adults)
  margin_of_error NUMERIC(3,1),
  source_url TEXT,
  source TEXT,            -- 'rcp', 'votehub', 'manual'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pollster, end_date)
);

-- Poll results (one row per candidate per poll)
CREATE TABLE IF NOT EXISTS poll_results (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES candidates(id),
  candidate_name TEXT NOT NULL,
  percentage NUMERIC(4,1) NOT NULL,
  party TEXT
);

-- Social media accounts
CREATE TABLE IF NOT EXISTS social_accounts (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  platform TEXT NOT NULL,
  handle TEXT,
  url TEXT,
  UNIQUE(candidate_id, platform)
);

-- Social follower history (time series)
CREATE TABLE IF NOT EXISTS social_follower_history (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  followers INTEGER,
  UNIQUE(candidate_id, platform, date)
);

-- YouTube channels
CREATE TABLE IF NOT EXISTS youtube_channels (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  channel_id TEXT,
  handle TEXT,
  url TEXT,
  bio TEXT,
  verified BOOLEAN DEFAULT false,
  avatar TEXT,
  subscribers INTEGER DEFAULT 0,
  total_videos INTEGER DEFAULT 0,
  UNIQUE(candidate_id)
);

-- YouTube videos
CREATE TABLE IF NOT EXISTS youtube_videos (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  video_id TEXT NOT NULL,
  url TEXT,
  title TEXT,
  description TEXT,
  thumbnail TEXT,
  published_at TIMESTAMPTZ,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  engagement INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  UNIQUE(candidate_id, video_id)
);

-- YouTube subscriber history (daily snapshots for tracking growth)
CREATE TABLE IF NOT EXISTS youtube_subscriber_history (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  date DATE NOT NULL,
  subscribers INTEGER DEFAULT 0,
  total_videos INTEGER DEFAULT 0,
  UNIQUE(candidate_id, date)
);

-- YouTube video stats history (daily snapshots for tracking view velocity)
CREATE TABLE IF NOT EXISTS youtube_video_history (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  video_id TEXT NOT NULL,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  UNIQUE(candidate_id, video_id, date)
);

-- Google Trends
CREATE TABLE IF NOT EXISTS google_trends (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  date DATE NOT NULL,
  search_interest INTEGER DEFAULT 0,
  UNIQUE(candidate_id, date)
);

-- Wikipedia pageviews
CREATE TABLE IF NOT EXISTS wiki_pageviews (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  UNIQUE(candidate_id, date)
);

-- Intel snapshots (composite metrics)
CREATE TABLE IF NOT EXISTS intel_snapshots (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id),
  has_form_460 BOOLEAN,
  cash_on_hand NUMERIC DEFAULT 0,
  total_raised_460 NUMERIC DEFAULT 0,
  total_spent_460 NUMERIC DEFAULT 0,
  s497_raised NUMERIC DEFAULT 0,
  s497_donors INTEGER DEFAULT 0,
  s497_pac_pct NUMERIC DEFAULT 0,
  rcpt_total NUMERIC DEFAULT 0,
  unique_donors INTEGER DEFAULT 0,
  repeat_rate NUMERIC DEFAULT 0,
  small_dollar_pct NUMERIC DEFAULT 0,
  committee_transfers NUMERIC DEFAULT 0,
  ca_pct NUMERIC DEFAULT 0,
  total_debt NUMERIC DEFAULT 0,
  burn_rate NUMERIC DEFAULT 0,
  UNIQUE(candidate_id)
);

-- Intel observations (text analysis)
CREATE TABLE IF NOT EXISTS intel_observations (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL, -- 'observation' or 'regional_note'
  text TEXT NOT NULL
);

-- ============ VIEWS ============

CREATE OR REPLACE VIEW candidate_overview AS
SELECT
  c.id,
  c.name,
  c.party,
  c.filer_id,
  c.has_form_460,
  cs.cash_on_hand,
  cs.total_receipts,
  cs.total_expenditures,
  cs.burn_rate,
  cs.runway_months,
  cs.s497_total_raised,
  co.total_raised AS rcpt_total_raised,
  co.contribution_count,
  co.unique_donors,
  co.avg_contribution,
  co.repeat_donor_rate,
  d.total_debt,
  d.total_loans,
  d.self_loans,
  g.in_state_amount,
  g.out_of_state_amount,
  g.in_state_pct,
  g.diversity_score,
  lc.total_raised AS late_total_raised,
  lc.donor_count AS late_donor_count,
  ie.total_support AS ie_support,
  ie.total_oppose AS ie_oppose,
  ie.net_support AS ie_net,
  ie.committee_count AS ie_committees
FROM candidates c
LEFT JOIN campaign_summary cs ON cs.candidate_id = c.id
LEFT JOIN contributions co ON co.candidate_id = c.id
LEFT JOIN debts d ON d.candidate_id = c.id
LEFT JOIN geography g ON g.candidate_id = c.id
LEFT JOIN late_contributions lc ON lc.candidate_id = c.id
LEFT JOIN ie_summary ie ON ie.candidate_id = c.id
WHERE c.is_primary = true;

CREATE OR REPLACE VIEW candidate_social_reach AS
SELECT
  c.id,
  c.name,
  c.party,
  sa.platform,
  sa.handle,
  (SELECT sfh.followers FROM social_follower_history sfh
   WHERE sfh.candidate_id = c.id AND sfh.platform = sa.platform
   ORDER BY sfh.date DESC LIMIT 1) AS latest_followers
FROM candidates c
JOIN social_accounts sa ON sa.candidate_id = c.id;

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_contributions_monthly_date ON contributions_monthly(month);
CREATE INDEX IF NOT EXISTS idx_campaign_timeline_month ON campaign_timeline(month);
CREATE INDEX IF NOT EXISTS idx_social_follower_date ON social_follower_history(date);
CREATE INDEX IF NOT EXISTS idx_google_trends_date ON google_trends(date);
CREATE INDEX IF NOT EXISTS idx_wiki_pageviews_date ON wiki_pageviews(date);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_views ON youtube_videos(views DESC);
CREATE INDEX IF NOT EXISTS idx_top_donors_amount ON top_donors(amount DESC);
CREATE INDEX IF NOT EXISTS idx_top_vendors_amount ON top_vendors(amount DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_filings_form ON campaign_filings(form_type);
CREATE INDEX IF NOT EXISTS idx_campaign_filings_candidate ON campaign_filings(candidate_id);
CREATE INDEX IF NOT EXISTS idx_late_contribution_state ON late_contribution_by_state(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ie_candidate ON independent_expenditures(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ie_summary_candidate ON ie_summary(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ie_committees_candidate ON ie_committees(candidate_id);
CREATE INDEX IF NOT EXISTS idx_polls_end_date ON polls(end_date DESC);
CREATE INDEX IF NOT EXISTS idx_poll_results_poll ON poll_results(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_results_candidate ON poll_results(candidate_id);
