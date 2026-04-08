#!/usr/bin/env python3
"""
Polling Data Scraper for 2026 CA Governor Race

Multi-source scraper that collects polling data from:
  1. RealClearPolitics (HTML table scrape)
  2. VoteHub API (JSON, CC BY 4.0)

Deduplicates across sources by (pollster, end_date).
Validates: every poll MUST have pollster, start_date, end_date, and ≥2 candidate results.
No fabrication — missing required fields → skip entire poll.

Output: data/polls.json
"""

import json
import re
import sys
from datetime import datetime, date
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from html.parser import HTMLParser

BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"

# Candidate name normalization: various spellings → canonical name
CANDIDATE_ALIASES = {
    "swalwell": "Eric Swalwell",
    "eric swalwell": "Eric Swalwell",
    "e. swalwell": "Eric Swalwell",
    "porter": "Katie Porter",
    "katie porter": "Katie Porter",
    "k. porter": "Katie Porter",
    "villaraigosa": "Antonio Villaraigosa",
    "antonio villaraigosa": "Antonio Villaraigosa",
    "a. villaraigosa": "Antonio Villaraigosa",
    "thurmond": "Tony Thurmond",
    "tony thurmond": "Tony Thurmond",
    "t. thurmond": "Tony Thurmond",
    "becerra": "Xavier Becerra",
    "xavier becerra": "Xavier Becerra",
    "x. becerra": "Xavier Becerra",
    "steyer": "Tom Steyer",
    "tom steyer": "Tom Steyer",
    "t. steyer": "Tom Steyer",
    "yee": "Betty Yee",
    "betty yee": "Betty Yee",
    "b. yee": "Betty Yee",
    "bianco": "Chad Bianco",
    "chad bianco": "Chad Bianco",
    "c. bianco": "Chad Bianco",
    "hilton": "Steve Hilton",
    "steve hilton": "Steve Hilton",
    "s. hilton": "Steve Hilton",
    "mahan": "Matt Mahan",
    "matt mahan": "Matt Mahan",
    "m. mahan": "Matt Mahan",
}

# Party lookup for known candidates
CANDIDATE_PARTIES = {
    "Eric Swalwell": "D",
    "Katie Porter": "D",
    "Antonio Villaraigosa": "D",
    "Tony Thurmond": "D",
    "Xavier Becerra": "D",
    "Tom Steyer": "D",
    "Betty Yee": "D",
    "Chad Bianco": "R",
    "Steve Hilton": "R",
    "Matt Mahan": "R",
}


def normalize_candidate_name(raw: str) -> str:
    """Normalize candidate name to canonical form."""
    clean = raw.strip().lower()
    # Remove party indicators like (D), (R)
    clean = re.sub(r'\s*\([DR]\)\s*', '', clean).strip()
    if clean in CANDIDATE_ALIASES:
        return CANDIDATE_ALIASES[clean]
    # Try last name only
    parts = clean.split()
    if parts:
        last = parts[-1]
        if last in CANDIDATE_ALIASES:
            return CANDIDATE_ALIASES[last]
    # Return title-cased original if no match
    return raw.strip().title()


def parse_date(date_str: str) -> str | None:
    """Parse various date formats to YYYY-MM-DD."""
    if not date_str:
        return None

    date_str = date_str.strip()

    # Try common formats
    for fmt in ["%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%m-%d-%Y"]:
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try date range format "1/15 - 1/18" (assume current year)
    range_match = re.match(r'(\d{1,2})/(\d{1,2})\s*-\s*(\d{1,2})/(\d{1,2})', date_str)
    if range_match:
        year = datetime.now().year
        try:
            m, d = int(range_match.group(3)), int(range_match.group(4))
            return f"{year}-{m:02d}-{d:02d}"
        except ValueError:
            pass

    return None


class RCPTableParser(HTMLParser):
    """Parse RealClearPolitics polling tables from HTML."""

    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_thead = False
        self.in_tbody = False
        self.in_tr = False
        self.in_td = False
        self.in_th = False
        self.current_text = ""
        self.headers = []
        self.rows = []
        self.current_row = []
        self.table_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "table":
            self.table_depth += 1
            cls = attrs_dict.get("class", "")
            if "data" in cls or "poll" in cls or self.table_depth == 1:
                self.in_table = True
        elif self.in_table:
            if tag == "thead":
                self.in_thead = True
            elif tag == "tbody":
                self.in_tbody = True
            elif tag == "tr":
                self.in_tr = True
                self.current_row = []
            elif tag in ("td", "th"):
                self.in_td = tag == "td"
                self.in_th = tag == "th"
                self.current_text = ""

    def handle_endtag(self, tag):
        if tag == "table":
            self.table_depth -= 1
            if self.table_depth == 0:
                self.in_table = False
        elif self.in_table:
            if tag == "thead":
                self.in_thead = False
            elif tag == "tbody":
                self.in_tbody = False
            elif tag == "tr":
                self.in_tr = False
                if self.in_thead and self.current_row:
                    self.headers = self.current_row
                elif self.in_tbody and self.current_row:
                    self.rows.append(self.current_row)
            elif tag in ("td", "th"):
                text = self.current_text.strip()
                self.current_row.append(text)
                self.in_td = False
                self.in_th = False

    def handle_data(self, data):
        if self.in_td or self.in_th:
            self.current_text += data


def fetch_rcp_polls() -> list[dict]:
    """Scrape polling data from RealClearPolitics."""
    polls = []

    # RCP URLs for CA Governor 2026
    urls = [
        "https://www.realclearpolling.com/polls/governor/2026/california/california-governor-primary",
        "https://www.realclearpolitics.com/epolls/2026/governor/ca/california_governor_primary-8420.html",
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
    }

    for url in urls:
        print(f"  Trying RCP: {url}")
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="replace")

            parser = RCPTableParser()
            parser.feed(html)

            if not parser.headers or not parser.rows:
                print(f"    No table data found")
                continue

            print(f"    Found {len(parser.rows)} rows with headers: {parser.headers[:8]}")

            # Parse headers to identify candidate columns
            # Typical RCP format: Poll, Date, Sample, MoE, Candidate1, Candidate2, ...
            header_lower = [h.lower().strip() for h in parser.headers]

            # Find key column indexes
            poll_idx = next((i for i, h in enumerate(header_lower) if h in ("poll", "pollster")), 0)
            date_idx = next((i for i, h in enumerate(header_lower) if h in ("date", "dates")), 1)
            sample_idx = next((i for i, h in enumerate(header_lower) if h in ("sample", "sample size", "n")), None)
            moe_idx = next((i for i, h in enumerate(header_lower) if "moe" in h or "margin" in h), None)

            # Everything after the metadata columns is a candidate
            meta_end = max(poll_idx, date_idx, sample_idx or 0, moe_idx or 0) + 1
            candidate_headers = parser.headers[meta_end:]

            for row in parser.rows:
                if len(row) < meta_end + 2:
                    continue

                pollster = row[poll_idx].strip() if poll_idx < len(row) else ""
                date_raw = row[date_idx].strip() if date_idx < len(row) else ""

                if not pollster or pollster.lower() in ("rcp average", "final results", "average"):
                    continue

                # Parse date range
                start_date = None
                end_date = None
                if " - " in date_raw:
                    parts = date_raw.split(" - ")
                    start_date = parse_date(parts[0].strip())
                    end_date = parse_date(parts[1].strip())
                else:
                    end_date = parse_date(date_raw)
                    start_date = end_date

                if not start_date or not end_date:
                    continue

                # Sample size
                sample_size = None
                if sample_idx is not None and sample_idx < len(row):
                    sample_raw = row[sample_idx].strip()
                    # Parse "1000 LV" or "800 RV" or just "1000"
                    sample_match = re.match(r'(\d+)', sample_raw.replace(",", ""))
                    if sample_match:
                        sample_size = int(sample_match.group(1))

                # Population type
                population = None
                if sample_idx is not None and sample_idx < len(row):
                    sample_raw = row[sample_idx].strip().upper()
                    if "LV" in sample_raw:
                        population = "LV"
                    elif "RV" in sample_raw:
                        population = "RV"
                    elif "A" in sample_raw:
                        population = "A"

                # MoE
                moe = None
                if moe_idx is not None and moe_idx < len(row):
                    moe_raw = row[moe_idx].strip().replace("±", "").replace("%", "")
                    try:
                        moe = float(moe_raw)
                    except ValueError:
                        pass

                # Candidate results
                results = []
                for i, cand_header in enumerate(candidate_headers):
                    val_idx = meta_end + i
                    if val_idx >= len(row):
                        break
                    val_raw = row[val_idx].strip().replace("%", "")
                    try:
                        pct = float(val_raw)
                    except ValueError:
                        continue

                    cand_name = normalize_candidate_name(cand_header)
                    party = CANDIDATE_PARTIES.get(cand_name)
                    results.append({
                        "candidate_name": cand_name,
                        "percentage": pct,
                        "party": party,
                    })

                # Validation: must have pollster, dates, and at least 2 results
                if not pollster or not start_date or not end_date or len(results) < 2:
                    continue

                polls.append({
                    "pollster": pollster,
                    "start_date": start_date,
                    "end_date": end_date,
                    "sample_size": sample_size,
                    "population": population,
                    "margin_of_error": moe,
                    "source_url": url,
                    "source": "rcp",
                    "results": results,
                })

            if polls:
                print(f"    Extracted {len(polls)} polls from RCP")
                break  # Got data, no need to try other URLs

        except (URLError, HTTPError) as e:
            print(f"    Failed: {e}")
            continue
        except Exception as e:
            print(f"    Error parsing: {e}")
            continue

    return polls


def fetch_votehub_polls() -> list[dict]:
    """Fetch polling data from VoteHub API (CC BY 4.0)."""
    polls = []

    urls = [
        "https://api.votehub.com/v1/polls?subject=california-governor-2026&poll_type=governor",
        "https://api.votehub.com/v1/polls?state=CA&office=governor&year=2026",
    ]

    headers = {
        "User-Agent": "Swallwell2026/1.0 (CA Governor Race Tracker)",
        "Accept": "application/json",
    }

    for url in urls:
        print(f"  Trying VoteHub: {url}")
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            if not data or not isinstance(data, (list, dict)):
                print(f"    Empty or invalid response")
                continue

            # Handle both array and object responses
            poll_list = data if isinstance(data, list) else data.get("polls", data.get("data", []))

            for poll_data in poll_list:
                pollster = poll_data.get("pollster", "").strip()
                start_date = parse_date(poll_data.get("start_date", ""))
                end_date = parse_date(poll_data.get("end_date", ""))

                if not pollster or not start_date or not end_date:
                    continue

                sample_size = poll_data.get("sample_size")
                population = poll_data.get("population")
                moe = poll_data.get("margin_of_error")

                # Parse results
                results = []
                for r in poll_data.get("results", poll_data.get("candidates", [])):
                    cand_name = r.get("name", r.get("candidate_name", "")).strip()
                    pct = r.get("percentage", r.get("value", r.get("pct")))
                    if not cand_name or pct is None:
                        continue
                    try:
                        pct = float(pct)
                    except (ValueError, TypeError):
                        continue

                    canonical = normalize_candidate_name(cand_name)
                    party = CANDIDATE_PARTIES.get(canonical) or r.get("party")
                    results.append({
                        "candidate_name": canonical,
                        "percentage": pct,
                        "party": party,
                    })

                if len(results) < 2:
                    continue

                polls.append({
                    "pollster": pollster,
                    "start_date": start_date,
                    "end_date": end_date,
                    "sample_size": int(sample_size) if sample_size else None,
                    "population": population,
                    "margin_of_error": float(moe) if moe else None,
                    "source_url": url,
                    "source": "votehub",
                    "results": results,
                })

            if polls:
                print(f"    Extracted {len(polls)} polls from VoteHub")

        except (URLError, HTTPError) as e:
            print(f"    Failed: {e}")
            continue
        except Exception as e:
            print(f"    Error: {e}")
            continue

    return polls


def deduplicate_polls(all_polls: list[dict]) -> list[dict]:
    """Deduplicate polls by (pollster, end_date).

    If same poll appears in multiple sources, prefer the one with more complete data.
    """
    seen = {}  # (pollster_lower, end_date) -> poll

    for poll in all_polls:
        key = (poll["pollster"].lower(), poll["end_date"])
        if key in seen:
            existing = seen[key]
            # Keep the one with more results or more metadata
            existing_score = len(existing.get("results", [])) + (1 if existing.get("sample_size") else 0) + (1 if existing.get("margin_of_error") else 0)
            new_score = len(poll.get("results", [])) + (1 if poll.get("sample_size") else 0) + (1 if poll.get("margin_of_error") else 0)
            if new_score > existing_score:
                seen[key] = poll
        else:
            seen[key] = poll

    return sorted(seen.values(), key=lambda p: p["end_date"], reverse=True)


def main():
    print("=" * 60)
    print("Polling Data Scraper for 2026 CA Governor Race")
    print("=" * 60)
    print()

    all_polls = []

    # Source 1: RealClearPolitics
    print("[1/2] Scraping RealClearPolitics...")
    rcp_polls = fetch_rcp_polls()
    all_polls.extend(rcp_polls)
    print(f"  RCP: {len(rcp_polls)} polls")
    print()

    # Source 2: VoteHub API
    print("[2/2] Fetching VoteHub API...")
    vh_polls = fetch_votehub_polls()
    all_polls.extend(vh_polls)
    print(f"  VoteHub: {len(vh_polls)} polls")
    print()

    # Deduplicate
    print("Deduplicating...")
    deduped = deduplicate_polls(all_polls)
    print(f"  {len(all_polls)} raw → {len(deduped)} unique polls")
    print()

    # Write output
    output = {
        "generated_at": datetime.now().isoformat(),
        "source_count": {
            "rcp": len(rcp_polls),
            "votehub": len(vh_polls),
        },
        "poll_count": len(deduped),
        "polls": deduped,
    }

    output_path = DATA_DIR / "polls.json"
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"Wrote {output_path}")

    # Print summary
    if deduped:
        print("\nPolling Summary:")
        print("-" * 60)
        for poll in deduped[:10]:
            print(f"\n  {poll['pollster']} ({poll['end_date']}):")
            for r in sorted(poll['results'], key=lambda x: x['percentage'], reverse=True):
                party = f" ({r['party']})" if r.get('party') else ""
                print(f"    {r['candidate_name']}{party}: {r['percentage']}%")
    else:
        print("\nNo polls found. This is expected early in the race (primary is June 2026).")
        print("The scraper will pick up polls as they become available.")

        # Write empty but valid output
        output["polls"] = []
        with open(output_path, 'w') as f:
            json.dump(output, f, indent=2)

    print("\nDone!")


if __name__ == "__main__":
    main()
