#!/usr/bin/env python3
"""Download public permitted challenge data; no credentials or removed references."""
import argparse
import hashlib
import json
from pathlib import Path
import time
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://data.source.coop/humane-intelligence/bias-bounty-mapping-equity-challenge'
REGIONS = ['northern-ca', 'eastern-ok', 'maricopa-az', 'south-central-tx']


def fetch(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'mapping-equity-baseline/1.0'}), timeout=180) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    data = ROOT / 'data'
    data.mkdir(exist_ok=True)
    listing = fetch(BASE + '?list-type=2')
    (data / 'source-listing.xml').write_bytes(listing)
    ns = {'s': 'http://s3.amazonaws.com/doc/2006-03-01/'}
    tree = ET.fromstring(listing)
    if tree.findtext('s:IsTruncated', namespaces=ns) != 'false':
        raise ValueError('Listing truncated: implement pagination before proceeding')
    inventory = [{'path': row.findtext('s:Key', namespaces=ns).split('/', 1)[1],
                  'bytes': int(row.findtext('s:Size', namespaces=ns))}
                 for row in tree.findall('s:Contents', ns)]
    (data / 'inventory.json').write_text(json.dumps(inventory, indent=2) + '\n')
    expected = {row['path']: row['bytes'] for row in inventory}
    paths = ['README.md']
    for region in REGIONS:
        paths += [f'strata/{region}/{region}-strata-tract-table.parquet',
                  f'reference/{region}/{region}-sample-submission.csv']
    paths += [f'reference/northern-ca/northern-ca-{layer}.parquet' for layer in
              ['census-acs-housing', 'overture-infrastructure', 'overture-pois']]
    manifest = []
    for relative in paths:
        path = data / relative
        if args.refresh or not path.exists() or path.stat().st_size != expected[relative]:
            content = fetch(BASE + '/' + relative)
            if len(content) != expected[relative]:
                raise ValueError(f'Unexpected size: {relative}')
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(path.suffix + '.part')
            temporary.write_bytes(content)
            temporary.replace(path)
        manifest.append({'path': relative, 'url': BASE + '/' + relative,
                         'bytes': path.stat().st_size,
                         'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        print(relative, path.stat().st_size, flush=True)
    (data / 'download-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
