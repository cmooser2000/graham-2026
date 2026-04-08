#!/usr/bin/env python3
"""
CAL-ACCESS Data Processor for 2026 Governor Race Analytics

Extracts and processes campaign finance data from CAL-ACCESS:
- SMRY_CD: Summary totals (cash on hand, total receipts/expenses)
- EXPN_CD: Itemized expenditures (spending breakdown)
- DEBT_CD: Campaign debts
- LOAN_CD: Campaign loans

Output: JSON files for the dashboard
"""

import json
import csv
import zipfile
import os
import sys
import math
from datetime import datetime
from collections import defaultdict
from pathlib import Path
import urllib.request
import shutil
import re


class SafeJSONEncoder(json.JSONEncoder):
    """JSON encoder that handles infinity values."""
    def default(self, obj):
        if isinstance(obj, float):
            if math.isinf(obj) or math.isnan(obj):
                return None
        return super().default(obj)

    def encode(self, obj):
        return super().encode(self._sanitize(obj))

    def _sanitize(self, obj):
        if isinstance(obj, float):
            if math.isinf(obj) or math.isnan(obj):
                return None
        elif isinstance(obj, dict):
            return {k: self._sanitize(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._sanitize(v) for v in obj]
        return obj

# Key filer IDs for 2026 Governor candidates
# Note: Candidates removed when they drop out of the race
FILER_IDS = {
    1485146: "Eric Swalwell",
    1471635: "Antonio Villaraigosa",
    # 1460033: "Eleni Kounalakis",  # Dropped out Jan 2026
    1479597: "Katie Porter",
    1461509: "Tony Thurmond",
    # 1466114: "Toni Atkins",  # Dropped out Sep 2025
    1480025: "Xavier Becerra",
    1485077: "Tom Steyer",
    1465732: "Betty Yee",
    1479095: "Chad Bianco",
    1480425: "Steve Hilton",
    # Matt Mahan: announced Jan 29, 2026 - no CAL-ACCESS committee yet
}

# Reverse lookup
NAME_TO_FILER_ID = {v: k for k, v in FILER_IDS.items()}

# Paths
BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"
CALACCESS_DIR = DATA_DIR / "CalAccess" / "DATA"
CALACCESS_ZIP_URL = "https://campaignfinance.cdn.sos.ca.gov/dbwebexport.zip"
CALACCESS_ZIP_PATH = DATA_DIR / "CalAccess" / "dbwebexport.zip"

# Tables we need
REQUIRED_TABLES = ["EXPN_CD", "DEBT_CD", "LOAN_CD", "SMRY_CD", "CVR_CAMPAIGN_DISCLOSURE_CD", "S497_CD", "S496_CD", "RCPT_CD"]

# California regions for geographic analysis
CA_REGIONS = {
    'Bay Area': ['San Francisco', 'San Jose', 'Oakland', 'Fremont', 'Santa Clara', 'Hayward',
                 'Sunnyvale', 'Santa Rosa', 'Concord', 'Berkeley', 'Richmond', 'Daly City',
                 'San Mateo', 'Alameda', 'Palo Alto', 'Mountain View', 'Redwood City',
                 'Walnut Creek', 'San Rafael', 'Pleasanton', 'Livermore', 'Vallejo', 'Napa',
                 'Menlo Park', 'Los Gatos', 'Burlingame', 'Foster City', 'Saratoga', 'Cupertino',
                 'Millbrae', 'San Bruno', 'Pacifica', 'Atherton', 'Hillsborough', 'Woodside',
                 'Portola Valley', 'Los Altos', 'Los Altos Hills', 'Tiburon', 'Mill Valley',
                 'Sausalito', 'Larkspur', 'San Anselmo', 'Corte Madera', 'Fairfax', 'Novato',
                 'Danville', 'San Ramon', 'Dublin', 'Lafayette', 'Orinda', 'Moraga', 'Piedmont',
                 'Emeryville', 'Albany', 'El Cerrito', 'Hercules', 'Pinole', 'Martinez'],
    'Los Angeles': ['Los Angeles', 'Long Beach', 'Santa Monica', 'Pasadena', 'Glendale',
                    'Burbank', 'Beverly Hills', 'Culver City', 'West Hollywood', 'Malibu',
                    'Manhattan Beach', 'Redondo Beach', 'Hermosa Beach', 'Torrance', 'Carson',
                    'Inglewood', 'Hawthorne', 'El Segundo', 'Compton', 'Downey', 'Norwalk',
                    'Whittier', 'La Mirada', 'Cerritos', 'Lakewood', 'Bellflower', 'Paramount',
                    'South Gate', 'Huntington Park', 'Bell Gardens', 'Pico Rivera', 'Montebello',
                    'Alhambra', 'San Gabriel', 'Arcadia', 'Monrovia', 'Azusa', 'Glendora',
                    'West Covina', 'Covina', 'Pomona', 'Claremont', 'La Verne', 'San Dimas',
                    'Diamond Bar', 'Walnut', 'Rowland Heights', 'Hacienda Heights', 'Industry',
                    'Santa Clarita', 'Palmdale', 'Lancaster', 'Calabasas', 'Agoura Hills',
                    'Westlake Village', 'Thousand Oaks', 'Simi Valley', 'Moorpark', 'Camarillo',
                    'Oxnard', 'Ventura', 'San Fernando', 'Northridge', 'Encino', 'Sherman Oaks',
                    'Studio City', 'Brentwood', 'Pacific Palisades', 'Venice', 'Marina Del Rey'],
    'Orange County': ['Anaheim', 'Santa Ana', 'Irvine', 'Huntington Beach', 'Garden Grove',
                      'Orange', 'Fullerton', 'Costa Mesa', 'Mission Viejo', 'Newport Beach',
                      'Westminster', 'Buena Park', 'Lake Forest', 'Tustin', 'Yorba Linda',
                      'San Clemente', 'Laguna Niguel', 'La Habra', 'Fountain Valley', 'Placentia',
                      'Rancho Santa Margarita', 'Aliso Viejo', 'Cypress', 'Brea', 'Stanton',
                      'San Juan Capistrano', 'Dana Point', 'Laguna Hills', 'Laguna Beach',
                      'Laguna Woods', 'Los Alamitos', 'Seal Beach', 'Villa Park', 'La Palma'],
    'San Diego': ['San Diego', 'Chula Vista', 'Oceanside', 'Escondido', 'Carlsbad', 'El Cajon',
                  'Vista', 'San Marcos', 'Encinitas', 'National City', 'La Mesa', 'Santee',
                  'Poway', 'La Jolla', 'Del Mar', 'Solana Beach', 'Coronado', 'Imperial Beach'],
    'Inland Empire': ['Riverside', 'San Bernardino', 'Fontana', 'Moreno Valley', 'Rancho Cucamonga',
                      'Ontario', 'Corona', 'Victorville', 'Murrieta', 'Temecula', 'Pomona',
                      'Rialto', 'Hesperia', 'Chino', 'Chino Hills', 'Indio', 'Upland', 'Redlands',
                      'Lake Elsinore', 'Eastvale', 'Hemet', 'Menifee', 'Perris', 'Palm Desert',
                      'Palm Springs', 'Beaumont', 'Colton', 'Cathedral City', 'Apple Valley',
                      'San Jacinto', 'Highland', 'Yucaipa', 'Banning', 'La Quinta', 'Norco'],
    'Central Valley': ['Fresno', 'Bakersfield', 'Stockton', 'Modesto', 'Visalia', 'Clovis',
                       'Merced', 'Hanford', 'Tulare', 'Madera', 'Turlock', 'Manteca', 'Tracy',
                       'Lodi', 'Porterville', 'Delano', 'Los Banos', 'Coalinga', 'Selma',
                       'Dinuba', 'Reedley', 'Kerman', 'Sanger', 'Shafter', 'Wasco', 'Arvin',
                       'McFarland', 'Taft', 'Ridgecrest', 'Tehachapi', 'Atwater', 'Livingston'],
    'Sacramento': ['Sacramento', 'Elk Grove', 'Roseville', 'Folsom', 'Citrus Heights', 'Rancho Cordova',
                   'Davis', 'Woodland', 'West Sacramento', 'Rocklin', 'Lincoln', 'Auburn',
                   'Placerville', 'Grass Valley', 'Nevada City', 'Yuba City', 'Marysville'],
}

# Entity type mappings
ENTITY_TYPES = {
    'IND': 'Individual',
    'COM': 'Committee',
    'OTH': 'Other',
    'PTY': 'Political Party',
    'SCC': 'Small Contributor Committee',
    'RCP': 'Recipient Committee',
    'CAO': 'Candidate/Officeholder',
}

# Occupation normalization mappings
OCCUPATION_MAPPINGS = {
    # Executive variations
    'ceo': 'CEO',
    'c.e.o.': 'CEO',
    'chief executive officer': 'CEO',
    'chief exec officer': 'CEO',
    'chief executive': 'CEO',
    'cfo': 'CFO',
    'c.f.o.': 'CFO',
    'chief financial officer': 'CFO',
    'coo': 'COO',
    'c.o.o.': 'COO',
    'chief operating officer': 'COO',
    'cto': 'CTO',
    'chief technology officer': 'CTO',

    # Legal variations
    'attorney': 'Attorney',
    'lawyer': 'Attorney',
    'attorney at law': 'Attorney',
    'atty': 'Attorney',
    'lawyer/partner': 'Attorney',
    'attorney/partner': 'Attorney',
    'legal counsel': 'Attorney',

    # Retired variations
    'retired': 'Retired',
    'retiree': 'Retired',
    'ret.': 'Retired',
    'ret': 'Retired',

    # Not employed variations
    'not employed': 'Not Employed',
    'unemployed': 'Not Employed',
    'none': 'Not Employed',
    'homemaker': 'Homemaker',
    'home maker': 'Homemaker',
    'stay at home': 'Homemaker',

    # Business owner variations
    'business owner': 'Business Owner',
    'owner': 'Business Owner',
    'self employed': 'Self-Employed',
    'self-employed': 'Self-Employed',
    'selfemployed': 'Self-Employed',

    # Real estate variations
    'real estate': 'Real Estate',
    'realtor': 'Real Estate',
    'real estate agent': 'Real Estate',
    'real estate broker': 'Real Estate',
    'real estate investor': 'Real Estate Investor',

    # Executive titles
    'president': 'President',
    'vice president': 'Vice President',
    'vp': 'Vice President',
    'chairman': 'Chairman',
    'chairwoman': 'Chairman',
    'chair': 'Chairman',
    'executive': 'Executive',
    'exec': 'Executive',
    'managing director': 'Managing Director',
    'director': 'Director',
    'partner': 'Partner',
    'managing partner': 'Managing Partner',
    'founder': 'Founder',
    'co-founder': 'Founder',
    'cofounder': 'Founder',

    # Healthcare
    'physician': 'Physician',
    'doctor': 'Physician',
    'md': 'Physician',
    'm.d.': 'Physician',
    'dr': 'Physician',
    'dr.': 'Physician',
    'nurse': 'Nurse',
    'rn': 'Nurse',
    'dentist': 'Dentist',
    'dds': 'Dentist',

    # Finance
    'investor': 'Investor',
    'investment': 'Investor',
    'venture capital': 'Venture Capitalist',
    'vc': 'Venture Capitalist',
    'venture capitalist': 'Venture Capitalist',
    'banker': 'Banker',
    'investment banker': 'Investment Banker',
    'financial advisor': 'Financial Advisor',
    'finance': 'Finance',

    # Tech
    'software engineer': 'Software Engineer',
    'engineer': 'Engineer',
    'developer': 'Developer',
    'programmer': 'Developer',
    'consultant': 'Consultant',
    'consulting': 'Consultant',
}

# Values that should be treated as "Unknown"
UNKNOWN_OCCUPATIONS = {
    '', 'n/a', 'na', 'none', 'unknown', 'information requested',
    'requested', 'info requested', 'pending', 'see above',
    'see attached', '-', '--', '---', 'n', 'x', 'xx', 'xxx',
    'decline to state', 'declined', 'refused', 'other'
}


def normalize_occupation(occupation: str, employer: str = '', entity_cd: str = '') -> str:
    """Normalize occupation string to canonical form.

    - For non-individual entities (COM, SCC, OTH), returns "N/A (entity type)"
    - Strips whitespace, converts to title case
    - Maps common variations to canonical forms
    - Falls back to employer-based inference if occupation is unknown
    - Treats various null-like values as 'Unknown'

    Args:
        occupation: Raw occupation string
        employer: Employer name (for inference when occupation is blank)
        entity_cd: Entity code from CAL-ACCESS (IND, COM, SCC, OTH, etc.)
    """
    # Handle non-individual entities - they don't have personal occupations
    if entity_cd:
        entity_upper = entity_cd.upper().strip()
        if entity_upper == 'COM':
            return 'N/A (Committee)'
        elif entity_upper == 'SCC':
            return 'N/A (Small Contributor Committee)'
        elif entity_upper == 'OTH':
            return 'N/A (Organization)'
        elif entity_upper == 'PTY':
            return 'N/A (Political Party)'
        elif entity_upper == 'RCP':
            return 'N/A (Recipient Committee)'
        elif entity_upper == 'CAO':
            return 'N/A (Candidate/Officeholder)'
        # IND and empty entity_cd fall through to normal processing

    if not occupation:
        occupation = ''

    # Clean and lowercase for comparison
    clean_occ = occupation.strip().lower()

    # Check if it's an unknown value
    if clean_occ in UNKNOWN_OCCUPATIONS:
        # Try to infer from employer
        if employer:
            clean_emp = employer.strip().lower()
            if any(kw in clean_emp for kw in ['law firm', 'llp', 'attorneys', 'law office']):
                return 'Attorney'
            if any(kw in clean_emp for kw in ['hospital', 'medical', 'health']):
                return 'Healthcare'
            if any(kw in clean_emp for kw in ['university', 'college', 'school']):
                return 'Education'
            if any(kw in clean_emp for kw in ['bank', 'financial', 'capital', 'investment']):
                return 'Finance'
        return 'Unknown'

    # Check for exact match in mappings
    if clean_occ in OCCUPATION_MAPPINGS:
        return OCCUPATION_MAPPINGS[clean_occ]

    # Check for partial matches (for compound occupations)
    for pattern, canonical in OCCUPATION_MAPPINGS.items():
        if pattern in clean_occ:
            return canonical

    # Return title case version of original
    return occupation.strip().title()


def aggregate_by_name(items: list, name_key: str, amount_key: str = 'amount') -> list:
    """Aggregate list of dicts by name, summing amounts.

    Args:
        items: List of dicts with name and amount fields
        name_key: Key for the name field (e.g., 'creditor', 'vendor', 'name')
        amount_key: Key for the amount field

    Returns:
        Aggregated and sorted list
    """
    aggregated = {}
    for item in items:
        name = item.get(name_key, '').strip()
        if not name:
            continue
        amount = item.get(amount_key, 0)
        if name in aggregated:
            aggregated[name] += amount
        else:
            aggregated[name] = amount

    # Sort by amount descending and return as list of dicts
    sorted_items = sorted(aggregated.items(), key=lambda x: x[1], reverse=True)
    return [{name_key: name, amount_key: amount} for name, amount in sorted_items]


def download_calaccess_if_needed():
    """Download CAL-ACCESS zip if not present or older than 24 hours."""
    if CALACCESS_ZIP_PATH.exists():
        age_hours = (datetime.now().timestamp() - CALACCESS_ZIP_PATH.stat().st_mtime) / 3600
        if age_hours < 24:
            print(f"Using cached CAL-ACCESS data (age: {age_hours:.1f} hours)")
            return
        print(f"CAL-ACCESS data is {age_hours:.1f} hours old, re-downloading...")

    print(f"Downloading CAL-ACCESS data from {CALACCESS_ZIP_URL}...")
    print("This is ~1.4GB and may take a few minutes...")

    CALACCESS_ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)

    with urllib.request.urlopen(CALACCESS_ZIP_URL) as response:
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        chunk_size = 8192 * 16  # 128KB chunks

        with open(CALACCESS_ZIP_PATH, 'wb') as f:
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    pct = (downloaded / total_size) * 100
                    mb_done = downloaded / (1024*1024)
                    mb_total = total_size / (1024*1024)
                    print(f"\r  {mb_done:.1f}MB / {mb_total:.1f}MB ({pct:.1f}%)", end="", flush=True)
        print("\n  Download complete!")


def extract_table(table_name: str, force: bool = False):
    """Extract a specific table from the CAL-ACCESS zip."""
    tsv_path = CALACCESS_DIR / f"{table_name}.TSV"

    if tsv_path.exists() and not force:
        print(f"  {table_name}.TSV already exists, skipping extraction")
        return tsv_path

    print(f"  Extracting {table_name}.TSV...")

    with zipfile.ZipFile(CALACCESS_ZIP_PATH, 'r') as zf:
        # Find the file in the zip
        target_file = None
        for name in zf.namelist():
            if name.endswith(f"{table_name}.TSV"):
                target_file = name
                break

        if not target_file:
            print(f"  WARNING: {table_name}.TSV not found in zip")
            return None

        # Extract to DATA directory
        CALACCESS_DIR.mkdir(parents=True, exist_ok=True)

        with zf.open(target_file) as src:
            with open(tsv_path, 'wb') as dst:
                shutil.copyfileobj(src, dst)

        size_mb = tsv_path.stat().st_size / (1024*1024)
        print(f"    Extracted: {size_mb:.1f}MB")

    return tsv_path


def get_candidate_filing_ids() -> dict:
    """Get all filing IDs associated with each candidate's filer_id.

    Returns dict: {filer_id: [list of filing_ids]}
    """
    cvr_path = CALACCESS_DIR / "CVR_CAMPAIGN_DISCLOSURE_CD.TSV"
    if not cvr_path.exists():
        extract_table("CVR_CAMPAIGN_DISCLOSURE_CD")

    filing_ids = defaultdict(set)

    print("  Scanning CVR_CAMPAIGN_DISCLOSURE_CD for candidate filing IDs...")
    with open(cvr_path, 'r', encoding='latin-1', errors='replace') as f:
        # Filter out NUL bytes that can appear in CAL-ACCESS data
        clean_lines = (line.replace('\x00', '') for line in f)
        reader = csv.DictReader(clean_lines, delimiter='\t')
        for row in reader:
            try:
                filer_id = int(row.get('FILER_ID', 0))
                filing_id = int(row.get('FILING_ID', 0))
                if filer_id in FILER_IDS:
                    filing_ids[filer_id].add(filing_id)
            except (ValueError, KeyError):
                continue

    for filer_id, fids in filing_ids.items():
        print(f"    {FILER_IDS[filer_id]}: {len(fids)} filings")

    return {k: list(v) for k, v in filing_ids.items()}


def process_smry_cd(filing_ids_by_filer: dict) -> dict:
    """Process SMRY_CD for financial summaries.

    Key line items from Form 460:
    - Line 1: Total monetary contributions (AMOUNT_A=period, AMOUNT_B=to date, AMOUNT_C=candidate portion)
    - Line 5: Total contributions (monetary + nonmonetary)
    - Line 11: Expenditures made
    - Line 16: Ending cash balance
    - Line 19: Accrued expenses (unpaid bills)

    Form types: F460 = main campaign form
    """
    smry_path = CALACCESS_DIR / "SMRY_CD.TSV"
    if not smry_path.exists():
        extract_table("SMRY_CD")

    # Create lookup: filing_id -> filer_id
    filing_to_filer = {}
    for filer_id, filing_ids in filing_ids_by_filer.items():
        for fid in filing_ids:
            filing_to_filer[fid] = filer_id

    # Aggregate by candidate
    summaries = {filer_id: {
        "cash_on_hand": 0,
        "total_receipts": 0,
        "total_expenditures": 0,
        "accrued_expenses": 0,
        "filings_processed": 0,
        "latest_filing_id": None,
        "by_line_item": defaultdict(float),
    } for filer_id in FILER_IDS}

    # Track latest amendment per filing
    latest_amendments = {}  # (filing_id) -> (amend_id, data)

    print("  Processing SMRY_CD...")
    row_count = 0
    matched_count = 0

    with open(smry_path, 'r', encoding='latin-1', errors='replace') as f:
        clean_lines = (line.replace('\x00', '') for line in f)
        reader = csv.DictReader(clean_lines, delimiter='\t')
        for row in reader:
            row_count += 1
            if row_count % 1000000 == 0:
                print(f"    Processed {row_count/1000000:.1f}M rows...")

            try:
                filing_id = int(row.get('FILING_ID', 0))
                if filing_id not in filing_to_filer:
                    continue

                filer_id = filing_to_filer[filing_id]
                amend_id = int(row.get('AMEND_ID', 0))
                form_type = row.get('FORM_TYPE', '').strip()
                line_item = row.get('LINE_ITEM', '').strip()

                # Only process F460 main form summaries
                if form_type != 'F460':
                    continue

                matched_count += 1

                # Get amounts (handle empty strings)
                amount_a = float(row.get('AMOUNT_A', 0) or 0)
                amount_b = float(row.get('AMOUNT_B', 0) or 0)

                # Store by filing/amend to track latest
                key = (filing_id, line_item)
                if key not in latest_amendments or amend_id > latest_amendments[key][0]:
                    latest_amendments[key] = (amend_id, {
                        'filer_id': filer_id,
                        'amount_a': amount_a,
                        'amount_b': amount_b,
                    })

            except (ValueError, KeyError) as e:
                continue

    print(f"    Scanned {row_count} rows, matched {matched_count}")

    # Aggregate latest amendments by candidate
    for (filing_id, line_item), (amend_id, data) in latest_amendments.items():
        filer_id = data['filer_id']
        amount_a = data['amount_a']
        amount_b = data['amount_b']

        # Key F460 line items:
        if line_item == '1':
            summaries[filer_id]['total_receipts'] += amount_a
        elif line_item == '11':
            summaries[filer_id]['total_expenditures'] += amount_a
        elif line_item == '16':
            # Cash on hand - use latest/max
            if amount_a > summaries[filer_id]['cash_on_hand']:
                summaries[filer_id]['cash_on_hand'] = amount_a
                summaries[filer_id]['latest_filing_id'] = filing_id
        elif line_item == '19':
            summaries[filer_id]['accrued_expenses'] += amount_a

        summaries[filer_id]['by_line_item'][line_item] += amount_a

    # Convert to output format
    result = {}
    for filer_id, data in summaries.items():
        name = FILER_IDS[filer_id]
        result[name] = {
            "filer_id": filer_id,
            "cash_on_hand": data['cash_on_hand'],
            "total_receipts": data['total_receipts'],
            "total_expenditures": data['total_expenditures'],
            "accrued_expenses": data['accrued_expenses'],
            "burn_rate": data['total_expenditures'] / max(data['total_receipts'], 1) if data['total_receipts'] > 0 else 0,
            "runway_months": data['cash_on_hand'] / (data['total_expenditures'] / 12) if data['total_expenditures'] > 0 else None,
        }

    return result


def process_expn_cd(filing_ids_by_filer: dict) -> dict:
    """Process EXPN_CD for itemized expenditures.

    Categorizes spending into:
    - Media/Advertising (TV, radio, digital ads, mailers)
    - Consultants (campaign consultants, strategists)
    - Staff/Payroll (salaries, wages)
    - Events (fundraising events, rallies)
    - Travel (transportation, lodging)
    - Overhead (office, supplies, rent)
    - Other
    """
    expn_path = CALACCESS_DIR / "EXPN_CD.TSV"
    if not expn_path.exists():
        extract_table("EXPN_CD")

    # Filing lookup
    filing_to_filer = {}
    for filer_id, filing_ids in filing_ids_by_filer.items():
        for fid in filing_ids:
            filing_to_filer[fid] = filer_id

    # Category keywords
    MEDIA_KEYWORDS = ['media', 'advertising', 'ad ', 'ads', 'tv', 'television', 'radio', 'digital', 'mailer', 'mail', 'print', 'billboard', 'social media', 'facebook', 'google', 'youtube']
    CONSULTANT_KEYWORDS = ['consultant', 'consulting', 'strategist', 'strategy', 'advisor', 'advisory', 'campaign services', 'political']
    STAFF_KEYWORDS = ['salary', 'salaries', 'payroll', 'wages', 'staff', 'employee', 'compensation', 'bonus']
    EVENT_KEYWORDS = ['event', 'fundraising', 'fundraiser', 'reception', 'dinner', 'breakfast', 'lunch', 'rally', 'catering', 'venue', 'hall rental']
    TRAVEL_KEYWORDS = ['travel', 'airfare', 'airline', 'flight', 'hotel', 'lodging', 'mileage', 'transportation', 'uber', 'lyft', 'car rental']
    OVERHEAD_KEYWORDS = ['office', 'rent', 'utilities', 'phone', 'internet', 'supplies', 'equipment', 'postage', 'shipping', 'software', 'subscription']
    LEGAL_KEYWORDS = ['legal', 'attorney', 'lawyer', 'compliance', 'filing fee', 'audit']

    def categorize(description: str, payee: str) -> str:
        """Categorize an expenditure based on description and payee."""
        text = (description + ' ' + payee).lower()

        if any(kw in text for kw in MEDIA_KEYWORDS):
            return 'Media/Ads'
        if any(kw in text for kw in CONSULTANT_KEYWORDS):
            return 'Consultants'
        if any(kw in text for kw in STAFF_KEYWORDS):
            return 'Staff/Payroll'
        if any(kw in text for kw in EVENT_KEYWORDS):
            return 'Events'
        if any(kw in text for kw in TRAVEL_KEYWORDS):
            return 'Travel'
        if any(kw in text for kw in OVERHEAD_KEYWORDS):
            return 'Overhead'
        if any(kw in text for kw in LEGAL_KEYWORDS):
            return 'Legal/Compliance'
        return 'Other'

    # Initialize data structures
    spending = {filer_id: {
        'by_category': defaultdict(float),
        'by_vendor': defaultdict(float),
        'total': 0,
        'expenditure_count': 0,
    } for filer_id in FILER_IDS}

    # Track amendments
    latest_expn = {}  # (filing_id, line_item) -> (amend_id, data)

    print("  Processing EXPN_CD (this is the large file, ~2.6GB)...")
    row_count = 0
    matched_count = 0

    with open(expn_path, 'r', encoding='latin-1', errors='replace') as f:
        clean_lines = (line.replace('\x00', '') for line in f)
        reader = csv.DictReader(clean_lines, delimiter='\t')
        for row in reader:
            row_count += 1
            if row_count % 2000000 == 0:
                print(f"    Processed {row_count/1000000:.1f}M rows...")

            try:
                filing_id = int(row.get('FILING_ID', 0))
                if filing_id not in filing_to_filer:
                    continue

                filer_id = filing_to_filer[filing_id]
                amend_id = int(row.get('AMEND_ID', 0))
                line_item = row.get('LINE_ITEM', '')

                amount = float(row.get('AMOUNT', 0) or 0)
                if amount <= 0:
                    continue

                payee = row.get('PAYEE_NAML', '') or ''
                payee_first = row.get('PAYEE_NAMF', '') or ''
                full_payee = f"{payee_first} {payee}".strip()

                description = row.get('EXPN_DSCR', '') or ''
                expn_code = row.get('EXPN_CODE', '') or ''

                matched_count += 1

                key = (filing_id, line_item)
                if key not in latest_expn or amend_id > latest_expn[key][0]:
                    latest_expn[key] = (amend_id, {
                        'filer_id': filer_id,
                        'amount': amount,
                        'payee': full_payee,
                        'description': description,
                        'expn_code': expn_code,
                    })

            except (ValueError, KeyError):
                continue

    print(f"    Scanned {row_count} rows, matched {matched_count}")

    # Aggregate
    for (filing_id, line_item), (amend_id, data) in latest_expn.items():
        filer_id = data['filer_id']
        amount = data['amount']
        payee = data['payee']
        description = data['description']

        category = categorize(description, payee)

        spending[filer_id]['by_category'][category] += amount
        spending[filer_id]['by_vendor'][payee] += amount
        spending[filer_id]['total'] += amount
        spending[filer_id]['expenditure_count'] += 1

    # Convert to output format
    result = {}
    for filer_id, data in spending.items():
        name = FILER_IDS[filer_id]

        # Vendors are already aggregated in the by_vendor dict, just sort
        top_vendors = sorted(data['by_vendor'].items(), key=lambda x: x[1], reverse=True)[:20]

        # Sort categories
        categories = dict(sorted(data['by_category'].items(), key=lambda x: x[1], reverse=True))

        result[name] = {
            "filer_id": filer_id,
            "total_spending": data['total'],
            "expenditure_count": data['expenditure_count'],
            "by_category": categories,
            "top_vendors": [{"name": v[0], "amount": v[1]} for v in top_vendors],
        }

    return result


def process_debt_loan(filing_ids_by_filer: dict) -> dict:
    """Process DEBT_CD and LOAN_CD for campaign debts and loans."""

    # Filing lookup
    filing_to_filer = {}
    for filer_id, filing_ids in filing_ids_by_filer.items():
        for fid in filing_ids:
            filing_to_filer[fid] = filer_id

    debts = {filer_id: {
        'total_debt': 0,
        'outstanding_debts': [],
        'total_loans': 0,
        'self_loans': 0,
        'loans': [],
    } for filer_id in FILER_IDS}

    # Process DEBT_CD
    debt_path = CALACCESS_DIR / "DEBT_CD.TSV"
    if debt_path.exists() or extract_table("DEBT_CD"):
        if debt_path.exists():
            print("  Processing DEBT_CD...")
            row_count = 0

            with open(debt_path, 'r', encoding='latin-1', errors='replace') as f:
                clean_lines = (line.replace('\x00', '') for line in f)
                reader = csv.DictReader(clean_lines, delimiter='\t')
                for row in reader:
                    row_count += 1
                    try:
                        filing_id = int(row.get('FILING_ID', 0))
                        if filing_id not in filing_to_filer:
                            continue

                        filer_id = filing_to_filer[filing_id]
                        amount = float(row.get('AMT_INCUR', 0) or 0)
                        payee = row.get('PAYEE_NAML', '') or ''

                        if amount > 0:
                            debts[filer_id]['total_debt'] += amount
                            debts[filer_id]['outstanding_debts'].append({
                                'creditor': payee,
                                'amount': amount,
                            })
                    except (ValueError, KeyError):
                        continue

            print(f"    Processed {row_count} debt rows")

    # Process LOAN_CD
    loan_path = CALACCESS_DIR / "LOAN_CD.TSV"
    if loan_path.exists() or extract_table("LOAN_CD"):
        if loan_path.exists():
            print("  Processing LOAN_CD...")
            row_count = 0

            with open(loan_path, 'r', encoding='latin-1', errors='replace') as f:
                clean_lines = (line.replace('\x00', '') for line in f)
                reader = csv.DictReader(clean_lines, delimiter='\t')
                for row in reader:
                    row_count += 1
                    try:
                        filing_id = int(row.get('FILING_ID', 0))
                        if filing_id not in filing_to_filer:
                            continue

                        filer_id = filing_to_filer[filing_id]
                        amount = float(row.get('LOAN_AMT1', 0) or row.get('LOAN_AMT', 0) or 0)
                        lender = row.get('LNDR_NAML', '') or ''

                        # Check if self-loan (candidate name appears in lender)
                        candidate_name = FILER_IDS[filer_id]
                        is_self_loan = any(part.lower() in lender.lower() for part in candidate_name.split() if len(part) > 2)

                        if amount > 0:
                            debts[filer_id]['total_loans'] += amount
                            if is_self_loan:
                                debts[filer_id]['self_loans'] += amount
                            debts[filer_id]['loans'].append({
                                'lender': lender,
                                'amount': amount,
                                'is_self_loan': is_self_loan,
                            })
                    except (ValueError, KeyError):
                        continue

            print(f"    Processed {row_count} loan rows")

    # Convert to output format
    result = {}
    for filer_id, data in debts.items():
        name = FILER_IDS[filer_id]

        # Aggregate creditors by name (fixes duplicate entries issue)
        aggregated_debts = aggregate_by_name(data['outstanding_debts'], 'creditor', 'amount')
        top_debts = aggregated_debts[:10]

        # Aggregate lenders by name
        aggregated_loans = aggregate_by_name(data['loans'], 'lender', 'amount')
        top_loans = aggregated_loans[:10]

        result[name] = {
            "filer_id": filer_id,
            "total_debt": data['total_debt'],
            "total_loans": data['total_loans'],
            "self_loans": data['self_loans'],
            "top_creditors": top_debts,
            "top_lenders": top_loans,
        }

    return result


def process_s497(filing_ids_by_filer: dict) -> dict:
    """Process S497_CD for late contribution data.

    S497 forms report contributions received within 90 days of an election
    that weren't included in a regular Form 460 filing.

    Returns donor-level data including:
    - Total raised from late contributions
    - Top donors with normalized occupations
    - Breakdown by state and occupation
    """
    s497_path = CALACCESS_DIR / "S497_CD.TSV"
    if not s497_path.exists():
        extracted = extract_table("S497_CD")
        if not extracted or not s497_path.exists():
            print("  WARNING: S497_CD.TSV not available")
            return {name: {
                "filer_id": fid,
                "total_raised": 0,
                "donor_count": 0,
                "avg_donation": 0,
                "top_donors": [],
                "by_state": {},
                "by_occupation": {},
            } for fid, name in FILER_IDS.items()}

    # Filing lookup
    filing_to_filer = {}
    for filer_id, filing_ids in filing_ids_by_filer.items():
        for fid in filing_ids:
            filing_to_filer[fid] = filer_id

    # Initialize data structures
    contributions = {filer_id: {
        'total': 0,
        'donors': [],  # List of individual contributions
        'by_state': defaultdict(float),
        'by_occupation': defaultdict(lambda: {'count': 0, 'amount': 0}),
    } for filer_id in FILER_IDS}

    print("  Processing S497_CD (late contributions)...")
    row_count = 0
    matched_count = 0

    with open(s497_path, 'r', encoding='latin-1', errors='replace') as f:
        clean_lines = (line.replace('\x00', '') for line in f)
        reader = csv.DictReader(clean_lines, delimiter='\t')
        for row in reader:
            row_count += 1
            if row_count % 500000 == 0:
                print(f"    Processed {row_count/1000:.0f}K rows...")

            try:
                filing_id = int(row.get('FILING_ID', 0))
                if filing_id not in filing_to_filer:
                    continue

                filer_id = filing_to_filer[filing_id]
                amount = float(row.get('AMOUNT', 0) or 0)

                if amount <= 0:
                    continue

                matched_count += 1

                # Extract donor info
                donor_last = row.get('ENTY_NAML', '') or ''
                donor_first = row.get('ENTY_NAMF', '') or ''
                full_name = f"{donor_first} {donor_last}".strip()
                if not full_name:
                    full_name = donor_last or 'Anonymous'

                employer = row.get('CTRIB_EMP', '') or ''
                occupation_raw = row.get('CTRIB_OCC', '') or ''
                city = row.get('ENTY_CITY', '') or ''
                state = row.get('ENTY_ST', '') or ''
                entity_cd = row.get('ENTITY_CD', '') or ''

                # Normalize occupation - handles non-individual entities (COM, SCC, OTH)
                occupation = normalize_occupation(occupation_raw, employer, entity_cd)

                contributions[filer_id]['total'] += amount
                contributions[filer_id]['donors'].append({
                    'name': full_name,
                    'amount': amount,
                    'employer': employer,
                    'occupation': occupation,
                    'city': city,
                    'state': state,
                })

                # Aggregate by state
                state_key = state.upper().strip() if state else 'Unknown'
                contributions[filer_id]['by_state'][state_key] += amount

                # Aggregate by occupation
                contributions[filer_id]['by_occupation'][occupation]['count'] += 1
                contributions[filer_id]['by_occupation'][occupation]['amount'] += amount

            except (ValueError, KeyError):
                continue

    print(f"    Scanned {row_count} rows, matched {matched_count}")

    # Convert to output format
    result = {}
    for filer_id, data in contributions.items():
        name = FILER_IDS[filer_id]

        # Aggregate donors by name (sum multiple contributions from same person)
        donor_totals = {}
        donor_info = {}  # Store most recent info for each donor
        for d in data['donors']:
            donor_name = d['name']
            if donor_name in donor_totals:
                donor_totals[donor_name] += d['amount']
            else:
                donor_totals[donor_name] = d['amount']
                donor_info[donor_name] = d

        # Create top donors list with aggregated amounts
        top_donors = []
        for donor_name, total_amount in sorted(donor_totals.items(), key=lambda x: x[1], reverse=True)[:10]:
            info = donor_info[donor_name]
            top_donors.append({
                'name': donor_name,
                'amount': total_amount,
                'employer': info['employer'],
                'occupation': info['occupation'],
                'city': info['city'],
                'state': info['state'],
            })

        # Sort by_state by amount
        by_state = dict(sorted(data['by_state'].items(), key=lambda x: x[1], reverse=True)[:10])

        # Sort by_occupation by amount
        by_occupation = dict(sorted(
            data['by_occupation'].items(),
            key=lambda x: x[1]['amount'],
            reverse=True
        )[:10])

        donor_count = len(donor_totals)
        result[name] = {
            "filer_id": filer_id,
            "total_raised": data['total'],
            "donor_count": donor_count,
            "avg_donation": data['total'] / donor_count if donor_count > 0 else 0,
            "top_donors": top_donors,
            "by_state": by_state,
            "by_occupation": by_occupation,
        }

    return result


def process_s496(filing_ids_by_filer: dict) -> dict:
    """Process Form 496 independent expenditures.

    Form 496 data lives in TWO tables:
    - CVR_CAMPAIGN_DISCLOSURE_CD (FORM_TYPE='F496'): cover page with committee name,
      candidate targeted, support/oppose code
    - S496_CD: line-item expenditure amounts, linked by FILING_ID

    Strategy: scan CVR for F496 filings targeting our candidates, collect filing IDs,
    then sum amounts from S496_CD for those filings.
    """
    s496_path = CALACCESS_DIR / "S496_CD.TSV"
    cvr_path = CALACCESS_DIR / "CVR_CAMPAIGN_DISCLOSURE_CD.TSV"

    if not s496_path.exists():
        extracted = extract_table("S496_CD")
        if not extracted or not s496_path.exists():
            print("  WARNING: S496_CD.TSV not available")
            return {"total_expenditures": 0, "total_amount": 0, "by_candidate": {}}

    if not cvr_path.exists():
        print("  WARNING: CVR_CAMPAIGN_DISCLOSURE_CD.TSV not available")
        return {"total_expenditures": 0, "total_amount": 0, "by_candidate": {}}

    # Build candidate name lookup: require first AND last name match
    # Maps (first_name_lower, last_name_lower) -> canonical name
    candidate_names = {}
    for filer_id, name in FILER_IDS.items():
        parts = name.split()
        first_name = parts[0].lower()
        last_name = parts[-1].lower()
        candidate_names[(first_name, last_name)] = name

    # Step 1: Scan CVR for F496 filings targeting our candidates
    # Only include filings from 2025+ (current governor race cycle).
    # Earlier filings are from previous races (e.g. 2024 congressional, 2018 governor).
    # Track latest amendment per filing: filing_id -> (amend_id, metadata)
    MIN_YEAR = 2025
    print(f"  Scanning CVR for F496 filings targeting our candidates ({MIN_YEAR}+)...")
    f496_filings = {}  # filing_id -> (amend_id, {committee, candidate, sup_opp})

    with open(cvr_path, 'r', encoding='latin-1', errors='replace') as f:
        clean_lines = (line.replace('\x00', '') for line in f)
        reader = csv.DictReader(clean_lines, delimiter='\t')
        for row in reader:
            try:
                if row.get('FORM_TYPE', '').strip() != 'F496':
                    continue

                # Date filter: only current race cycle
                rpt_date = (row.get('RPT_DATE', '') or '').strip()
                year_match = re.search(r'(20\d{2})', rpt_date)
                if not year_match or int(year_match.group(1)) < MIN_YEAR:
                    continue

                filing_id = int(row.get('FILING_ID', 0))
                amend_id = int(row.get('AMEND_ID', 0))

                committee_name = (row.get('FILER_NAML', '') or '').strip()
                cand_naml = (row.get('CAND_NAML', '') or '').strip()
                cand_namf = (row.get('CAND_NAMF', '') or '').strip()
                sup_opp = (row.get('SUP_OPP_CD', '') or '').strip().upper()

                if sup_opp not in ('S', 'O'):
                    continue

                # Match candidate: require both first and last name
                # CalAccess is inconsistent: sometimes first/last in separate fields,
                # sometimes full name crammed into CAND_NAML (e.g. "Tony Thurmond (I)")
                matched_candidate = None
                filing_last = cand_naml.lower().strip()
                filing_first = cand_namf.lower().strip()

                # If CAND_NAMF is empty, try splitting CAND_NAML ("Tony Thurmond" or "Tony Thurmond (I)")
                if not filing_first and ' ' in filing_last:
                    # Strip suffixes like "(I)" and split
                    clean_naml = re.sub(r'\s*\(.*?\)\s*$', '', filing_last).strip()
                    parts = clean_naml.split()
                    if len(parts) >= 2:
                        filing_first = parts[0]
                        filing_last = parts[-1]

                for (first, last), canonical in candidate_names.items():
                    if last == filing_last and filing_first.startswith(first[:3]):
                        matched_candidate = canonical
                        break

                if not matched_candidate:
                    continue

                # Keep latest amendment per filing
                if filing_id not in f496_filings or amend_id > f496_filings[filing_id][0]:
                    f496_filings[filing_id] = (amend_id, {
                        'committee_name': committee_name,
                        'candidate_name': f"{cand_namf} {cand_naml}".strip(),
                        'matched_candidate': matched_candidate,
                        'support_oppose': sup_opp,
                    })

            except (ValueError, KeyError):
                continue

    print(f"    Found {len(f496_filings)} F496 filings targeting our candidates")

    if not f496_filings:
        return {"total_expenditures": 0, "total_amount": 0, "by_candidate": {}}

    # Step 2: Read S496_CD to get amounts for matched filings
    print("  Reading S496_CD for expenditure amounts...")
    # Track amendments per line item: (filing_id, line_item) -> (amend_id, amount, description, date)
    latest_amounts = {}
    row_count = 0

    with open(s496_path, 'r', encoding='latin-1', errors='replace') as f:
        clean_lines = (line.replace('\x00', '') for line in f)
        reader = csv.DictReader(clean_lines, delimiter='\t')
        for row in reader:
            row_count += 1
            try:
                filing_id = int(row.get('FILING_ID', 0))
                if filing_id not in f496_filings:
                    continue

                amend_id = int(row.get('AMEND_ID', 0))
                line_item = row.get('LINE_ITEM', '')
                amount = float(row.get('AMOUNT', 0) or 0)
                if amount <= 0:
                    continue

                expn_dscr = row.get('EXPN_DSCR', '') or ''
                expn_date = row.get('EXP_DATE', '') or row.get('EXPN_DATE', '') or ''

                key = (filing_id, line_item)
                if key not in latest_amounts or amend_id > latest_amounts[key][0]:
                    latest_amounts[key] = (amend_id, amount, expn_dscr, expn_date)

            except (ValueError, KeyError):
                continue

    print(f"    Scanned {row_count} S496 rows, matched {len(latest_amounts)} line items")

    # Step 3: Aggregate — join CVR metadata with S496 amounts
    by_candidate = defaultdict(lambda: {
        'total_support': 0,
        'total_oppose': 0,
        'committees': defaultdict(lambda: {'support': 0, 'oppose': 0}),
        'expenditures': [],
    })

    for (filing_id, line_item), (amend_id, amount, description, date) in latest_amounts.items():
        _, meta = f496_filings[filing_id]
        candidate = meta['matched_candidate']
        committee = meta['committee_name']
        sup_opp = meta['support_oppose']

        entry = {
            'committee_name': committee,
            'candidate_name': meta['candidate_name'],
            'matched_candidate': candidate,
            'support_oppose': sup_opp,
            'amount': amount,
            'description': description,
            'date': date,
        }

        if sup_opp == 'S':
            by_candidate[candidate]['total_support'] += amount
            by_candidate[candidate]['committees'][committee]['support'] += amount
        else:
            by_candidate[candidate]['total_oppose'] += amount
            by_candidate[candidate]['committees'][committee]['oppose'] += amount

        by_candidate[candidate]['expenditures'].append(entry)

    # Convert to output format
    total_amount = 0
    total_count = 0
    by_candidate_output = {}

    for candidate, cdata in by_candidate.items():
        committees = []
        for cname, amounts in sorted(cdata['committees'].items(), key=lambda x: x[1]['support'] + x[1]['oppose'], reverse=True):
            committees.append({
                'committee_name': cname,
                'support': amounts['support'],
                'oppose': amounts['oppose'],
                'total': amounts['support'] + amounts['oppose'],
            })

        sorted_expns = sorted(cdata['expenditures'], key=lambda x: x['amount'], reverse=True)
        count = len(sorted_expns)
        total_count += count
        cand_total = cdata['total_support'] + cdata['total_oppose']
        total_amount += cand_total

        by_candidate_output[candidate] = {
            'total_support': cdata['total_support'],
            'total_oppose': cdata['total_oppose'],
            'net_support': cdata['total_support'] - cdata['total_oppose'],
            'committee_count': len(cdata['committees']),
            'top_committees': committees[:15],
            'top_expenditures': [{
                'committee': e['committee_name'],
                'amount': e['amount'],
                'support_oppose': e['support_oppose'],
                'description': e['description'],
                'date': e['date'],
            } for e in sorted_expns[:20]],
        }

    print(f"    Found {total_count} independent expenditures targeting {len(by_candidate_output)} candidates (${total_amount:,.0f} total)")

    return {
        "total_expenditures": total_count,
        "total_amount": total_amount,
        "by_candidate": by_candidate_output,
    }


def get_ca_region(city: str) -> str:
    """Map a California city to its region."""
    if not city:
        return 'Other CA'
    city_clean = city.strip().title()
    for region, cities in CA_REGIONS.items():
        if city_clean in cities:
            return region
    return 'Other CA'


def categorize_contribution_size(amount: float) -> str:
    """Categorize contribution by size bracket."""
    if amount < 100:
        return 'small'      # $1-99: grassroots
    elif amount < 500:
        return 'medium'     # $100-499: engaged supporters
    elif amount < 1000:
        return 'large'      # $500-999: committed donors
    else:
        return 'major'      # $1000+: major donors


def process_rcpt_cd(filing_ids_by_filer: dict) -> tuple:
    """Process RCPT_CD for full contribution history.

    Returns tuple of (contributions_data, geography_data, monthly_data).

    RCPT_CD contains all itemized monetary contributions from Form 460 Schedule A.
    This is the authoritative source for contribution analysis.
    """
    rcpt_path = CALACCESS_DIR / "RCPT_CD.TSV"
    if not rcpt_path.exists():
        extracted = extract_table("RCPT_CD")
        if not extracted or not rcpt_path.exists():
            print("  WARNING: RCPT_CD.TSV not available")
            empty_contrib = {name: {
                "filer_id": fid,
                "total_raised": 0, "contribution_count": 0, "unique_donors": 0,
                "avg_contribution": 0, "by_size": {}, "by_size_count": {},
                "by_type": {}, "by_type_count": {}, "repeat_donor_amount": 0,
                "repeat_donor_count": 0, "repeat_donor_rate": 0, "top_donors": [],
                "contributions_by_month": {},
            } for fid, name in FILER_IDS.items()}
            empty_geo = {name: {
                "filer_id": fid,
                "in_state": 0, "out_of_state": 0, "in_state_pct": 0,
                "by_region": {}, "top_cities": [], "top_states": [],
                "home_district_amount": 0, "home_district_pct": 0, "diversity_score": 0,
            } for fid, name in FILER_IDS.items()}
            return empty_contrib, empty_geo, {}

    # Filing lookup
    filing_to_filer = {}
    for filer_id, filing_ids in filing_ids_by_filer.items():
        for fid in filing_ids:
            filing_to_filer[fid] = filer_id

    # Initialize data structures
    contributions = {filer_id: {
        'total': 0,
        'by_size': defaultdict(float),
        'by_size_count': defaultdict(int),
        'by_type': defaultdict(float),
        'by_type_count': defaultdict(int),
        'donors': defaultdict(lambda: {'amount': 0, 'count': 0, 'info': None}),
        'by_city': defaultdict(float),
        'by_state': defaultdict(float),
        'by_month': defaultdict(float),
    } for filer_id in FILER_IDS}

    # Track latest amendments per contribution
    latest_rcpt = {}  # (filing_id, line_item) -> (amend_id, data)

    print("  Processing RCPT_CD (3.5GB - this takes a few minutes)...")
    row_count = 0
    matched_count = 0

    with open(rcpt_path, 'r', encoding='latin-1', errors='replace') as f:
        clean_lines = (line.replace('\x00', '') for line in f)
        reader = csv.DictReader(clean_lines, delimiter='\t')
        for row in reader:
            row_count += 1
            if row_count % 5000000 == 0:
                print(f"    Processed {row_count/1000000:.1f}M rows...")

            try:
                filing_id = int(row.get('FILING_ID', 0))
                if filing_id not in filing_to_filer:
                    continue

                filer_id = filing_to_filer[filing_id]
                amend_id = int(row.get('AMEND_ID', 0))
                line_item = row.get('LINE_ITEM', '')

                amount = float(row.get('AMOUNT', 0) or 0)
                if amount <= 0:
                    continue

                # Extract contributor info
                naml = row.get('CTRIB_NAML', '') or ''
                namf = row.get('CTRIB_NAMF', '') or ''
                full_name = f"{namf} {naml}".strip() or naml or 'Anonymous'

                city = row.get('CTRIB_CITY', '') or ''
                state = row.get('CTRIB_ST', '') or ''
                employer = row.get('CTRIB_EMP', '') or ''
                occupation_raw = row.get('CTRIB_OCC', '') or ''
                entity_cd = row.get('ENTITY_CD', '') or ''
                rcpt_date = row.get('RCPT_DATE', '') or ''

                matched_count += 1

                key = (filing_id, line_item)
                if key not in latest_rcpt or amend_id > latest_rcpt[key][0]:
                    latest_rcpt[key] = (amend_id, {
                        'filer_id': filer_id,
                        'amount': amount,
                        'name': full_name,
                        'city': city,
                        'state': state.upper().strip() if state else '',
                        'employer': employer,
                        'occupation': normalize_occupation(occupation_raw, employer, entity_cd),
                        'entity_cd': entity_cd,
                        'date': rcpt_date,
                    })

            except (ValueError, KeyError):
                continue

    print(f"    Scanned {row_count} rows, matched {matched_count}")
    print("    Aggregating contribution data...")

    # Aggregate from latest amendments
    for (filing_id, line_item), (amend_id, data) in latest_rcpt.items():
        filer_id = data['filer_id']
        amount = data['amount']
        name = data['name']
        city = data['city']
        state = data['state']
        entity_cd = data['entity_cd']
        rcpt_date = data['date']

        c = contributions[filer_id]
        c['total'] += amount

        # By size bracket
        size = categorize_contribution_size(amount)
        c['by_size'][size] += amount
        c['by_size_count'][size] += 1

        # By entity type
        entity_type = ENTITY_TYPES.get(entity_cd, 'Other')
        c['by_type'][entity_type] += amount
        c['by_type_count'][entity_type] += 1

        # By donor (for repeat analysis and top donors)
        c['donors'][name]['amount'] += amount
        c['donors'][name]['count'] += 1
        if c['donors'][name]['info'] is None:
            c['donors'][name]['info'] = data

        # By geography
        if city:
            c['by_city'][city.strip().title()] += amount
        if state:
            c['by_state'][state] += amount

        # By month
        if rcpt_date and len(rcpt_date) >= 7:
            try:
                # Parse date format (usually MM/DD/YYYY or YYYY-MM-DD)
                if '/' in rcpt_date:
                    parts = rcpt_date.split('/')
                    if len(parts) >= 3:
                        month_key = f"{parts[2][:4]}-{parts[0].zfill(2)}"
                elif '-' in rcpt_date:
                    month_key = rcpt_date[:7]
                else:
                    month_key = None
                if month_key and len(month_key) == 7:
                    c['by_month'][month_key] += amount
            except:
                pass

    # Build output structures
    contributions_output = {}
    geography_output = {}
    monthly_output = {}

    for filer_id, c in contributions.items():
        name = FILER_IDS[filer_id]
        donors = c['donors']

        # Contribution analysis
        unique_donors = len(donors)
        repeat_donors = {n: d for n, d in donors.items() if d['count'] > 1}
        repeat_count = len(repeat_donors)
        repeat_amount = sum(d['amount'] for d in repeat_donors.values())

        # Top donors (sorted by total amount)
        top_donors = sorted(donors.items(), key=lambda x: x[1]['amount'], reverse=True)[:15]

        contributions_output[name] = {
            "filer_id": filer_id,
            "total_raised": c['total'],
            "contribution_count": sum(c['by_size_count'].values()),
            "unique_donors": unique_donors,
            "avg_contribution": c['total'] / unique_donors if unique_donors > 0 else 0,
            "by_size": dict(c['by_size']),
            "by_size_count": dict(c['by_size_count']),
            "by_type": dict(c['by_type']),
            "by_type_count": dict(c['by_type_count']),
            "repeat_donor_amount": repeat_amount,
            "repeat_donor_count": repeat_count,
            "repeat_donor_rate": repeat_count / unique_donors if unique_donors > 0 else 0,
            "top_donors": [
                {"name": n, "amount": d['amount'], "donations": d['count']}
                for n, d in top_donors
            ],
            "contributions_by_month": dict(sorted(c['by_month'].items())),
        }

        # Geography analysis
        in_state = c['by_state'].get('CA', 0)
        out_of_state = sum(v for k, v in c['by_state'].items() if k != 'CA' and k)
        total_geo = in_state + out_of_state

        # CA regions
        by_region = defaultdict(float)
        for city_name, amount in c['by_city'].items():
            region = get_ca_region(city_name)
            by_region[region] += amount

        # Top cities
        top_cities = sorted(c['by_city'].items(), key=lambda x: x[1], reverse=True)[:15]

        # Top states
        top_states = sorted(c['by_state'].items(), key=lambda x: x[1], reverse=True)[:10]

        # Diversity score (number of cities with significant contributions)
        significant_cities = sum(1 for _, amt in c['by_city'].items() if amt >= 1000)

        geography_output[name] = {
            "filer_id": filer_id,
            "in_state": in_state,
            "out_of_state": out_of_state,
            "in_state_pct": in_state / total_geo if total_geo > 0 else 0,
            "by_region": dict(sorted(by_region.items(), key=lambda x: x[1], reverse=True)),
            "top_cities": [{"city": c, "amount": a} for c, a in top_cities],
            "top_states": [{"state": s, "amount": a} for s, a in top_states],
            "home_district_amount": 0,  # Would need district mapping
            "home_district_pct": 0,
            "diversity_score": significant_cities,
        }

        # Monthly data (just contributions for now, spending added later)
        monthly_output[filer_id] = dict(sorted(c['by_month'].items()))

    return contributions_output, geography_output, monthly_output


def build_timeline(monthly_contributions: dict, spending_data: dict) -> dict:
    """Build timeline data combining contributions and spending by month.

    Args:
        monthly_contributions: {filer_id: {month: amount}} from RCPT_CD
        spending_data: spending dict from process_expn_cd

    Returns:
        Timeline data for each candidate with monthly breakdowns.
    """
    timeline_output = {}

    for filer_id, name in FILER_IDS.items():
        contrib_by_month = monthly_contributions.get(filer_id, {})

        # Get all unique months from both sources
        all_months = set(contrib_by_month.keys())

        # Build monthly data
        monthly_data = []
        cumulative_raised = 0
        cumulative_spent = 0
        prev_contrib = None

        for month in sorted(all_months):
            contrib = contrib_by_month.get(month, 0)
            spend = 0  # Would need monthly spending breakdown from EXPN_CD

            cumulative_raised += contrib
            cumulative_spent += spend
            net = contrib - spend

            entry = {
                "month": month,
                "contributions": contrib,
                "spending": spend,
                "net": net,
                "cumulative_raised": cumulative_raised,
                "cumulative_spent": cumulative_spent,
            }

            # Calculate month-over-month growth after 3 months
            if len(monthly_data) >= 2 and prev_contrib and prev_contrib > 0:
                entry["mom_growth"] = (contrib - prev_contrib) / prev_contrib

            # 3-month trailing average
            if len(monthly_data) >= 2:
                recent = [monthly_data[-2]['contributions'], monthly_data[-1]['contributions'], contrib]
                entry["trail_3m_contrib"] = sum(recent) / 3

            monthly_data.append(entry)
            prev_contrib = contrib

        # Calculate momentum (3-month trend)
        momentum = None
        if len(monthly_data) >= 3:
            last_3 = [m['contributions'] for m in monthly_data[-3:]]
            first_val = last_3[0] if last_3[0] > 0 else 1
            momentum = (last_3[-1] - first_val) / first_val

        timeline_output[name] = {
            "monthly_data": monthly_data,
            "total_months": len(monthly_data),
            "momentum": momentum,
            "latest_contributions": monthly_data[-1]['contributions'] if monthly_data else 0,
        }

    return timeline_output


def generate_intel_analysis(
    summaries: dict,
    spending: dict,
    debts: dict,
    s497: dict,
    contributions: dict,
    geography: dict,
    timeline: dict,
    timestamp: str,
) -> dict:
    """Generate concise intel analysis from the latest data pull."""

    # Sort candidates by cash on hand (Form 460) or S497 raised
    def get_cash_position(name):
        s = summaries.get(name, {})
        if s.get('has_form_460'):
            return s.get('cash_on_hand', 0)
        return s.get('s497_total_raised', 0)

    ranked = sorted(summaries.keys(), key=get_cash_position, reverse=True)

    # Build observations
    observations = []

    # 1. Cash position rankings
    form_460_filers = [n for n in ranked if summaries[n].get('has_form_460')]
    s497_only = [n for n in ranked if not summaries[n].get('has_form_460')]

    if form_460_filers:
        leader = form_460_filers[0]
        leader_cash = summaries[leader]['cash_on_hand']
        observations.append(f"{leader.split()[-1]} leads Form 460 filers with ${leader_cash/1e6:.1f}M cash on hand.")

    # 2. Swalwell position
    sw = summaries.get('Eric Swalwell', {})
    sw_s497 = s497.get('Eric Swalwell', {})
    if sw_s497.get('total_raised', 0) > 0:
        sw_raised = sw_s497['total_raised']
        sw_donors = sw_s497.get('donor_count', 0)
        observations.append(f"Swalwell has raised ${sw_raised/1e6:.1f}M from {sw_donors} S497 donors. No Form 460 filed yet.")

    # 3. Tom Steyer self-funding
    steyer_s497 = s497.get('Tom Steyer', {})
    if steyer_s497.get('total_raised', 0) > 10_000_000:
        observations.append(f"Steyer self-funding: ${steyer_s497['total_raised']/1e6:.1f}M from {steyer_s497.get('donor_count', 0)} donors (mostly self).")

    # 4. Grassroots vs big donor analysis
    grassroots_leaders = []
    for name, c in contributions.items():
        if c.get('unique_donors', 0) > 1000:
            small_pct = c.get('by_size', {}).get('small', 0) / max(c.get('total_raised', 1), 1) * 100
            grassroots_leaders.append((name.split()[-1], c['unique_donors'], c.get('repeat_donor_rate', 0) * 100))

    if grassroots_leaders:
        grassroots_leaders.sort(key=lambda x: x[1], reverse=True)
        top = grassroots_leaders[0]
        observations.append(f"{top[0]} has strongest grassroots base: {top[1]:,} donors, {top[2]:.0f}% repeat rate.")

    # 5. Geographic concentration
    most_ca = None
    most_ca_pct = 0
    for name, g in geography.items():
        pct = g.get('in_state_pct', 0)
        if pct > most_ca_pct and g.get('in_state', 0) > 100000:
            most_ca_pct = pct
            most_ca = name.split()[-1]

    if most_ca:
        observations.append(f"{most_ca} most California-focused: {most_ca_pct*100:.0f}% in-state money.")

    # 6. Debt concerns
    high_debt = []
    for name, d in debts.items():
        s = summaries.get(name, {})
        cash = s.get('cash_on_hand', 0)
        debt = d.get('total_debt', 0)
        if debt > 200000 and cash > 0:
            debt_ratio = debt / cash * 100
            if debt_ratio > 30:
                high_debt.append((name.split()[-1], debt, debt_ratio))

    if high_debt:
        high_debt.sort(key=lambda x: x[2], reverse=True)
        top = high_debt[0]
        observations.append(f"{top[0]} has debt concerns: ${top[1]/1e3:.0f}K outstanding ({top[2]:.0f}% of cash).")

    # 7. Burn rate analysis
    high_burn = []
    for name, s in summaries.items():
        if s.get('has_form_460') and s.get('burn_rate', 0) > 0.6:
            high_burn.append((name.split()[-1], s['burn_rate'] * 100))

    if high_burn:
        high_burn.sort(key=lambda x: x[1], reverse=True)
        top = high_burn[0]
        observations.append(f"{top[0]} spending aggressively: {top[1]:.0f}% burn rate.")

    # 8. Regional strength
    regional_notes = []
    for name, g in geography.items():
        regions = g.get('by_region', {})
        if regions:
            top_region = max(regions.items(), key=lambda x: x[1])
            if top_region[1] > 500000:
                regional_notes.append(f"{name.split()[-1]}: ${top_region[1]/1e6:.1f}M from {top_region[0]}")

    # 9. PAC vs Individual donor composition (from S497 occupation data)
    pac_heavy = []
    individual_heavy = []
    for name, s497_d in s497.items():
        by_occ = s497_d.get('by_occupation', {})
        total_raised = s497_d.get('total_raised', 0)
        if total_raised < 100000:
            continue

        # Sum up N/A entities (committees, orgs, etc.)
        na_amount = sum(
            data.get('amount', 0) for occ, data in by_occ.items()
            if occ.startswith('N/A (')
        )
        na_pct = na_amount / total_raised * 100 if total_raised > 0 else 0

        if na_pct > 50:
            pac_heavy.append((name.split()[-1], na_pct, na_amount))
        elif na_pct < 20 and s497_d.get('donor_count', 0) > 50:
            individual_heavy.append((name.split()[-1], 100 - na_pct, s497_d.get('donor_count', 0)))

    if pac_heavy:
        pac_heavy.sort(key=lambda x: x[1], reverse=True)
        top = pac_heavy[0]
        observations.append(f"{top[0]} relies heavily on PACs/committees: {top[1]:.0f}% of S497 from non-individual donors.")

    if individual_heavy:
        individual_heavy.sort(key=lambda x: x[1], reverse=True)
        top = individual_heavy[0]
        observations.append(f"{top[0]} mostly individual donors: {top[1]:.0f}% from individuals ({top[2]} S497 donors).")

    # 10. Small dollar success (Form 460 RCPT_CD data)
    small_dollar_leaders = []
    for name, c in contributions.items():
        total = c.get('total_raised', 0)
        if total < 500000:
            continue
        small = c.get('by_size', {}).get('small', 0)
        medium = c.get('by_size', {}).get('medium', 0)
        grassroots = small + medium  # Under $500
        grassroots_pct = grassroots / total * 100 if total > 0 else 0
        if grassroots_pct > 30:
            small_dollar_leaders.append((name.split()[-1], grassroots_pct, grassroots))

    if small_dollar_leaders:
        small_dollar_leaders.sort(key=lambda x: x[1], reverse=True)
        top = small_dollar_leaders[0]
        observations.append(f"{top[0]} leads small-dollar fundraising: {top[1]:.0f}% of contributions under $500 (${top[2]/1e3:.0f}K).")

    # 11. Form 460 vs RCPT_CD discrepancy (committee transfers)
    transfer_gaps = []
    for name, s in summaries.items():
        if not s.get('has_form_460'):
            continue
        form_460_total = s.get('total_receipts', 0)
        rcpt_total = contributions.get(name, {}).get('total_raised', 0)
        if form_460_total > 0 and rcpt_total > 0:
            gap = form_460_total - rcpt_total
            gap_pct = gap / form_460_total * 100
            if gap > 500000 and gap_pct > 20:
                transfer_gaps.append((name.split()[-1], gap, gap_pct))

    if transfer_gaps:
        transfer_gaps.sort(key=lambda x: x[1], reverse=True)
        top = transfer_gaps[0]
        observations.append(f"{top[0]} received ${top[1]/1e6:.1f}M in committee transfers ({top[2]:.0f}% of Form 460 total).")

    # Build candidate snapshots
    snapshots = {}
    for name in ranked:
        s = summaries.get(name, {})
        sp = spending.get(name, {})
        d = debts.get(name, {})
        c = contributions.get(name, {})
        g = geography.get(name, {})
        s497_d = s497.get(name, {})

        # Calculate PAC percentage from S497 occupation data
        by_occ = s497_d.get('by_occupation', {})
        s497_total = s497_d.get('total_raised', 0)
        na_amount = sum(
            data.get('amount', 0) for occ, data in by_occ.items()
            if occ.startswith('N/A (')
        )
        pac_pct = na_amount / s497_total if s497_total > 0 else 0

        # Calculate small dollar percentage from RCPT_CD
        rcpt_total = c.get('total_raised', 0)
        small = c.get('by_size', {}).get('small', 0)
        medium = c.get('by_size', {}).get('medium', 0)
        small_dollar_pct = (small + medium) / rcpt_total if rcpt_total > 0 else 0

        # Calculate committee transfer amount (Form 460 - RCPT_CD gap)
        form_460_total = s.get('total_receipts', 0)
        committee_transfers = max(0, form_460_total - rcpt_total) if form_460_total > 0 else 0

        snapshot = {
            "has_form_460": s.get('has_form_460', False),
            "cash_on_hand": s.get('cash_on_hand', 0),
            "total_raised_460": s.get('total_receipts', 0),
            "total_spent_460": s.get('total_expenditures', 0),
            "s497_raised": s497_d.get('total_raised', 0),
            "s497_donors": s497_d.get('donor_count', 0),
            "s497_pac_pct": pac_pct,
            "rcpt_total": c.get('total_raised', 0),
            "unique_donors": c.get('unique_donors', 0),
            "repeat_rate": c.get('repeat_donor_rate', 0),
            "small_dollar_pct": small_dollar_pct,
            "committee_transfers": committee_transfers,
            "ca_pct": g.get('in_state_pct', 0),
            "total_debt": d.get('total_debt', 0),
            "burn_rate": s.get('burn_rate', 0),
        }
        snapshots[name] = snapshot

    return {
        "generated_at": timestamp,
        "data_pull_date": datetime.now().strftime("%B %d, %Y"),
        "observations": observations,
        "regional_notes": regional_notes[:5],
        "snapshots": snapshots,
        "rankings": {
            "by_cash": [n for n in form_460_filers],
            "by_donors": sorted(
                [n for n in contributions.keys() if contributions[n].get('unique_donors', 0) > 0],
                key=lambda x: contributions[x].get('unique_donors', 0),
                reverse=True
            ),
            "by_repeat_rate": sorted(
                [n for n in contributions.keys() if contributions[n].get('repeat_donor_rate', 0) > 0],
                key=lambda x: contributions[x].get('repeat_donor_rate', 0),
                reverse=True
            ),
        },
    }


def process_filings(filing_ids_by_filer: dict) -> dict:
    """Process CVR_CAMPAIGN_DISCLOSURE_CD for filing metadata.

    Extracts filing history with dates, form types, and period summaries.
    """
    cvr_path = CALACCESS_DIR / "CVR_CAMPAIGN_DISCLOSURE_CD.TSV"
    smry_path = CALACCESS_DIR / "SMRY_CD.TSV"

    if not cvr_path.exists():
        return {name: {"filings": []} for name in FILER_IDS.values()}

    # Build filing info from CVR
    filings = {filer_id: [] for filer_id in FILER_IDS}

    print("  Processing CVR_CAMPAIGN_DISCLOSURE_CD for filing metadata...")

    with open(cvr_path, 'r', encoding='latin-1', errors='replace') as f:
        clean_lines = (line.replace('\x00', '') for line in f)
        reader = csv.DictReader(clean_lines, delimiter='\t')
        for row in reader:
            try:
                filer_id = int(row.get('FILER_ID', 0))
                if filer_id not in FILER_IDS:
                    continue

                filing_id = int(row.get('FILING_ID', 0))
                amend_id = int(row.get('AMEND_ID', 0))
                form_type = row.get('FORM_TYPE', '') or ''
                rpt_date = row.get('RPT_DATE', '') or ''
                thru_date = row.get('THRU_DATE', '') or ''
                from_date = row.get('FROM_DATE', '') or ''

                # Only track main forms (F460, F497)
                if form_type not in ['F460', 'F497']:
                    continue

                filings[filer_id].append({
                    'filing_id': filing_id,
                    'amend_id': amend_id,
                    'form_type': form_type,
                    'rpt_date': rpt_date,
                    'thru_date': thru_date,
                    'from_date': from_date,
                })

            except (ValueError, KeyError):
                continue

    # Get SMRY data for F460 filings (cash on hand, period totals)
    filing_summaries = {}  # filing_id -> {cash_on_hand, receipts, expenditures}

    if smry_path.exists():
        print("  Enriching with SMRY_CD period data...")
        with open(smry_path, 'r', encoding='latin-1', errors='replace') as f:
            clean_lines = (line.replace('\x00', '') for line in f)
            reader = csv.DictReader(clean_lines, delimiter='\t')
            for row in reader:
                try:
                    filing_id = int(row.get('FILING_ID', 0))
                    form_type = row.get('FORM_TYPE', '').strip()
                    line_item = row.get('LINE_ITEM', '').strip()
                    amend_id = int(row.get('AMEND_ID', 0))

                    if form_type != 'F460':
                        continue

                    amount_a = float(row.get('AMOUNT_A', 0) or 0)

                    if filing_id not in filing_summaries:
                        filing_summaries[filing_id] = {'cash': 0, 'receipts': 0, 'expend': 0, 'amend': -1}

                    # Only keep latest amendment
                    if amend_id < filing_summaries[filing_id]['amend']:
                        continue

                    if amend_id > filing_summaries[filing_id]['amend']:
                        filing_summaries[filing_id] = {'cash': 0, 'receipts': 0, 'expend': 0, 'amend': amend_id}

                    if line_item == '16':  # Ending cash
                        filing_summaries[filing_id]['cash'] = amount_a
                    elif line_item == '1':  # Receipts
                        filing_summaries[filing_id]['receipts'] = amount_a
                    elif line_item == '11':  # Expenditures
                        filing_summaries[filing_id]['expend'] = amount_a

                except (ValueError, KeyError):
                    continue

    # Build output
    result = {}
    for filer_id, filing_list in filings.items():
        name = FILER_IDS[filer_id]

        # Dedupe by filing_id (keep latest amendment)
        latest_filings = {}
        for f in filing_list:
            fid = f['filing_id']
            if fid not in latest_filings or f['amend_id'] > latest_filings[fid]['amend_id']:
                latest_filings[fid] = f

        # Enrich with SMRY data and sort by date
        enriched = []
        for fid, f in latest_filings.items():
            smry = filing_summaries.get(fid, {})
            enriched.append({
                'filing_id': fid,
                'form_type': f['form_type'],
                'thru_date': f['thru_date'],
                'rpt_date': f['rpt_date'],
                'cash_on_hand': smry.get('cash', 0),
                'period_receipts': smry.get('receipts', 0),
                'period_expenditures': smry.get('expend', 0),
            })

        # Sort by report date (most recent first)
        enriched.sort(key=lambda x: x['rpt_date'], reverse=True)

        result[name] = {"filings": enriched}

    return result


def main():
    print("=" * 60)
    print("CAL-ACCESS Data Processor for 2026 Governor Race")
    print("=" * 60)
    print()

    # Step 1: Download if needed
    print("[1/5] Checking CAL-ACCESS data...")
    download_calaccess_if_needed()
    print()

    # Step 2: Extract required tables
    print("[2/5] Extracting required tables...")
    for table in REQUIRED_TABLES:
        extract_table(table)
    print()

    # Step 3: Get filing IDs for our candidates
    print("[3/5] Getting candidate filing IDs...")
    filing_ids = get_candidate_filing_ids()
    print()

    # Step 4: Process each data type
    print("[4/7] Processing data files...")

    print("\n--- Financial Summaries (SMRY_CD) ---")
    summaries = process_smry_cd(filing_ids)

    print("\n--- Expenditures (EXPN_CD) ---")
    spending = process_expn_cd(filing_ids)

    print("\n--- Debts & Loans ---")
    debts = process_debt_loan(filing_ids)

    print("\n--- Late Contributions (S497_CD) ---")
    s497_data = process_s497(filing_ids)

    print("\n--- Independent Expenditures (S496_CD) ---")
    ie_data = process_s496(filing_ids)

    print("\n--- Full Contribution History (RCPT_CD) ---")
    contributions_data, geography_data, monthly_contrib = process_rcpt_cd(filing_ids)

    print("\n--- Building Timeline ---")
    timeline_data = build_timeline(monthly_contrib, spending)

    print("\n--- Filing History ---")
    filings_data = process_filings(filing_ids)
    print()

    # Step 5: Write output files
    print("[5/7] Writing JSON output files...")

    timestamp = datetime.now().isoformat()

    # Campaign Summary - enhanced with Form 460 status and S497 fallback
    # Fix Issue #3: Show S497 data for candidates without Form 460
    enhanced_summaries = {}
    for name, data in summaries.items():
        s497_total = s497_data.get(name, {}).get('total_raised', 0)
        has_form_460 = data['total_receipts'] > 0 or data['total_expenditures'] > 0 or data['cash_on_hand'] > 0

        enhanced_data = dict(data)
        enhanced_data['has_form_460'] = has_form_460

        # If no Form 460 data but S497 data exists, add as fallback
        if not has_form_460 and s497_total > 0:
            enhanced_data['s497_total_raised'] = s497_total

        enhanced_summaries[name] = enhanced_data

    summary_output = {
        "generated_at": timestamp,
        "data_source": "CAL-ACCESS SMRY_CD (Form 460 Summaries)",
        "candidates": enhanced_summaries,
    }
    with open(DATA_DIR / "campaign-summary.json", 'w') as f:
        json.dump(summary_output, f, indent=2, cls=SafeJSONEncoder)
    print(f"  Wrote campaign-summary.json")

    # Campaign Spending
    spending_output = {
        "generated_at": timestamp,
        "data_source": "CAL-ACCESS EXPN_CD (Itemized Expenditures)",
        "candidates": spending,
    }
    with open(DATA_DIR / "campaign-spending.json", 'w') as f:
        json.dump(spending_output, f, indent=2, cls=SafeJSONEncoder)
    print(f"  Wrote campaign-spending.json")

    # Campaign Debts
    debts_output = {
        "generated_at": timestamp,
        "data_source": "CAL-ACCESS DEBT_CD + LOAN_CD",
        "candidates": debts,
    }
    with open(DATA_DIR / "campaign-debts.json", 'w') as f:
        json.dump(debts_output, f, indent=2, cls=SafeJSONEncoder)
    print(f"  Wrote campaign-debts.json")

    # Campaign Finance (S497 Late Contributions)
    finance_output = {
        "generated_at": timestamp,
        "data_source": "CAL-ACCESS S497 (Late Contributions)",
        "candidates": s497_data,
    }
    with open(DATA_DIR / "campaign-finance.json", 'w') as f:
        json.dump(finance_output, f, indent=2, cls=SafeJSONEncoder)
    print(f"  Wrote campaign-finance.json")

    # Campaign Contributions (Full RCPT_CD History)
    contributions_output = {
        "generated_at": timestamp,
        "data_source": "CAL-ACCESS RCPT_CD (Full Contribution History)",
        "candidates": contributions_data,
    }
    with open(DATA_DIR / "campaign-contributions.json", 'w') as f:
        json.dump(contributions_output, f, indent=2, cls=SafeJSONEncoder)
    print(f"  Wrote campaign-contributions.json")

    # Campaign Geography
    geography_output = {
        "generated_at": timestamp,
        "data_source": "CAL-ACCESS RCPT_CD (Contributor Geography)",
        "candidates": geography_data,
    }
    with open(DATA_DIR / "campaign-geography.json", 'w') as f:
        json.dump(geography_output, f, indent=2, cls=SafeJSONEncoder)
    print(f"  Wrote campaign-geography.json")

    # Campaign Timeline
    timeline_output = {
        "generated_at": timestamp,
        "data_source": "CAL-ACCESS RCPT_CD + EXPN_CD (Time Series)",
        "candidates": timeline_data,
    }
    with open(DATA_DIR / "campaign-timeline.json", 'w') as f:
        json.dump(timeline_output, f, indent=2, cls=SafeJSONEncoder)
    print(f"  Wrote campaign-timeline.json")

    # Campaign Filings
    filings_output = {
        "generated_at": timestamp,
        "data_source": "CAL-ACCESS CVR_CAMPAIGN_DISCLOSURE_CD + SMRY_CD",
        "candidates": filings_data,
    }
    with open(DATA_DIR / "campaign-filings.json", 'w') as f:
        json.dump(filings_output, f, indent=2, cls=SafeJSONEncoder)
    print(f"  Wrote campaign-filings.json")

    # Independent Expenditures (S496)
    ie_output = {
        "generated_at": timestamp,
        "data_source": "CAL-ACCESS S496_CD (Late Independent Expenditures)",
        "data": ie_data,
    }
    with open(DATA_DIR / "independent-expenditures.json", 'w') as f:
        json.dump(ie_output, f, indent=2, cls=SafeJSONEncoder)
    print(f"  Wrote independent-expenditures.json")

    # Generate Intel/Analysis
    print("  Generating intel analysis...")
    intel = generate_intel_analysis(
        summaries=enhanced_summaries,
        spending=spending,
        debts=debts,
        s497=s497_data,
        contributions=contributions_data,
        geography=geography_data,
        timeline=timeline_data,
        timestamp=timestamp,
    )
    with open(DATA_DIR / "intel-analysis.json", 'w') as f:
        json.dump(intel, f, indent=2, cls=SafeJSONEncoder)
    print(f"  Wrote intel-analysis.json")

    print()
    print("=" * 60)
    print("Processing complete! Generated 10 JSON files.")
    print("=" * 60)

    # Print summary
    print("\nCandidate Summary:")
    print("-" * 60)
    for name in sorted(summaries.keys(), key=lambda x: summaries[x].get('cash_on_hand', 0), reverse=True):
        s = summaries[name]
        sp = spending[name]
        d = debts[name]
        s497 = s497_data.get(name, {})
        contrib = contributions_data.get(name, {})
        geo = geography_data.get(name, {})
        has_460 = enhanced_summaries[name].get('has_form_460', False)

        print(f"\n{name}:")
        if has_460:
            print(f"  [Form 460 Filed]")
            print(f"  Cash on hand:  ${s['cash_on_hand']:,.0f}")
            print(f"  Total raised:  ${s['total_receipts']:,.0f}")
            print(f"  Total spent:   ${s['total_expenditures']:,.0f}")
        else:
            s497_raised = s497.get('total_raised', 0)
            print(f"  [No Form 460 - S497 data only]")
            print(f"  S497 raised:   ${s497_raised:,.0f}")

        # Contribution details from RCPT_CD
        rcpt_total = contrib.get('total_raised', 0)
        if rcpt_total > 0:
            print(f"  RCPT_CD total: ${rcpt_total:,.0f} ({contrib.get('unique_donors', 0)} donors)")
            print(f"    - Small (<$100):    ${contrib.get('by_size', {}).get('small', 0):,.0f}")
            print(f"    - Medium ($100-499): ${contrib.get('by_size', {}).get('medium', 0):,.0f}")
            print(f"    - Large ($500-999):  ${contrib.get('by_size', {}).get('large', 0):,.0f}")
            print(f"    - Major ($1000+):    ${contrib.get('by_size', {}).get('major', 0):,.0f}")
            print(f"    - Repeat donors:    {contrib.get('repeat_donor_rate', 0)*100:.1f}%")

        # Geography
        in_state = geo.get('in_state', 0)
        if in_state > 0:
            print(f"  Geography: {geo.get('in_state_pct', 0)*100:.1f}% CA, {geo.get('diversity_score', 0)} cities")

        print(f"  EXPN spending: ${sp['total_spending']:,.0f} ({sp['expenditure_count']} items)")
        print(f"  Debts:         ${d['total_debt']:,.0f}")
        if s497.get('total_raised', 0) > 0:
            print(f"  S497 donors:   {s497.get('donor_count', 0)} donors, ${s497.get('total_raised', 0):,.0f} total")


if __name__ == "__main__":
    main()
