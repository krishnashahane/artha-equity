"""Validate reviewed web-company packages before any activation writes.

Packages retain the source_snapshot schema plus a company descriptor using the
companies.json schema. Review is explicit; a scaffold is never valuation evidence.
"""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from portable_finance import calculate, iso, number

FIELDS = {'year':'fiscal_year','revenue':'revenue','ebit':'operating_ebit','netIncome':'net_income_attributable_owners','da':'depreciation_amortization','capex':'capex','receivables':'trade_receivables','payables':'trade_payables','cash':'cash_and_cash_equivalents','assets':'total_assets','equity':'total_equity','liabilities':'total_liabilities','cfo':'cash_flow_operating','cfi':'cash_flow_investing','cff':'cash_flow_financing','netCashChange':'cash_flow_net_change','fx':'cash_fx_effect','openingCash':'cash_opening','closingCash':'cash_flow_closing_cash_equivalents'}


def official_url(value: str, domain: str) -> bool:
    """Require HTTPS on the explicitly reviewed issuer domain or a subdomain."""
    url = urlparse(str(value)); host = url.hostname or ''
    return url.scheme == 'https' and not url.username and (host == domain or host.endswith('.' + domain))


def validate_package(package: dict) -> dict:
    """Return a validated company; reject incomplete provenance and mismatched facts."""
    company = package['company']; snapshot = package['snapshot']
    if not re.fullmatch(r'[a-z][a-z0-9_]{0,63}', company['id']):
        raise ValueError('Invalid company id.')
    domain = company.get('officialDomain', '')
    if not re.fullmatch(r'[a-z0-9-]+(?:\.[a-z0-9-]+)+', domain):
        raise ValueError('An explicitly reviewed officialDomain is required.')
    if package.get('reviewed') is not True:
        raise ValueError('Package must be explicitly reviewed against official filings.')
    if len(company['historical']) != 3 or len(snapshot['annuals']) != 3:
        raise ValueError('Exactly three annual periods and twelve reconciliations are required.')
    sources = {s['id']: s for s in company['sources']}
    if len(sources) != len(company['sources']):
        raise ValueError('Duplicate source id.')
    for source in sources.values():
        if not official_url(source['url'], domain) or not iso(source['publicationDate']) or source.get('verified') is not True:
            raise ValueError('Sources need a reviewed official URL and publication date.')
    facts = {(f['year'], f['field']): f for f in company['facts']}
    if len(facts) != len(company['facts']):
        raise ValueError('Duplicate source fact.')
    for row, annual in zip(company['historical'], snapshot['annuals']):
        for web, field in FIELDS.items():
            if row[web] != annual[field]:
                raise ValueError('Historical data differs from the source snapshot: ' + field)
            if web == 'year':
                continue
            fact = facts.get((row['year'], field), {})
            source = sources.get(fact.get('sourceId'), {})
            if (fact.get('value') != row[web] or fact.get('unit') != 'INR crore'
                    or not isinstance(fact.get('pdfPage'), int) or isinstance(fact.get('pdfPage'), bool) or fact['pdfPage'] < 1
                    or fact.get('sourceUrl') != source.get('url') or fact.get('publicationDate') != source.get('publicationDate')
                    or fact.get('sourceId') not in row['sourceIds']):
                raise ValueError('Required source fact lacks value, unit, URL, page or publication date: ' + field)
    shares = company['shares']
    observations = [s for s in snapshot['share_observations'] if s['effective_date'] == shares['date']]
    if len(observations) != 1:
        raise ValueError('Exactly one matching dated share observation is required.')
    observation = observations[0]
    if observation.get('gross_outstanding_shares') is not None and (not number(observation.get('treasury_shares')) or observation['gross_outstanding_shares']-observation['treasury_shares']!=observation['net_outstanding_shares']):
        raise ValueError('Gross shares less treasury must equal net shares.')
    source = sources.get(observation['source_id'], {})
    if (not source or observation['publication_date'] != source['publicationDate'] or not observation.get('net_source_pdf_page')
            or observation['net_outstanding_shares'] / 1e7 != shares['netCrore']
            or shares.get('fullyDilutedCrore') != (observation.get('fully_diluted_period_end_shares') / 1e7 if observation.get('fully_diluted_period_end_shares') else None)):
        raise ValueError('Share denominator must match reviewed dated source evidence.')
    result = calculate(company, company['assumptions'], observations, False)
    if len(result['reconciliations']) != 12 or any(c['status'] != 'pass' for c in result['reconciliations']):
        raise ValueError('Twelve statement reconciliations must pass.')
    return company


def snapshot_for(root: Path, company: dict) -> dict:
    """Load only this company's snapshot, never another issuer's fallback data."""
    relative = company.get('snapshotPath')
    if relative is None and company['id'] == 'infosys':
        relative = 'data/source_snapshot.json'
    if not relative:
        raise ValueError('Company-specific source snapshot is unavailable.')
    path = (root / relative).resolve()
    if not path.is_relative_to((root / 'data').resolve()):
        raise ValueError('Snapshot path must remain within data/.')
    content=path.read_bytes()
    expected=company.get('inputManifest',{}).get('sha256')
    if expected and hashlib.sha256(content).hexdigest()!=expected:
        raise ValueError('Company source fingerprint differs from reviewed evidence.')
    return json.loads(content)


def activate(root: Path, package: dict) -> str:
    """Validate everything first, then atomically publish the web registry last.

    Run offline with the server stopped. Existing issuer evidence is never replaced.
    """
    company = validate_package(package)
    bundle_path = root / 'data/companies.json'; bundle = json.loads(bundle_path.read_text())
    if any(c['id'] == company['id'] for c in bundle['companies']):
        raise ValueError('Company is already active.')
    target = root / 'data/workspaces' / company['id'] / 'reviewed.json'
    if target.exists():
        raise ValueError('Reviewed evidence already exists.')
    content = json.dumps(package['snapshot'], indent=2, allow_nan=False) + '\n'
    company = {**company, 'snapshotPath': target.relative_to(root).as_posix(),
               'inputManifest': {'source': target.relative_to(root).as_posix(), 'sha256': hashlib.sha256(content.encode()).hexdigest()}}
    target.parent.mkdir(parents=True, exist_ok=True); target.write_text(content)
    bundle['companies'].append(company)
    temporary = bundle_path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(bundle, indent=2, allow_nan=False) + '\n'); temporary.replace(bundle_path)
    return company['id']
