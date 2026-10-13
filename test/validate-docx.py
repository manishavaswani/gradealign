#!/usr/bin/env python3
"""RubricLens — validate that generated .docx files are well-formed OOXML:
valid zip, required parts present, and every XML part parses.
Run after test/docx.js:  python3 test/validate-docx.py
"""
import glob
import sys
import zipfile
import xml.etree.ElementTree as ET

failures = 0
files = sorted(glob.glob('/tmp/rubriclens-docx/*.docx'))
if not files:
    print('FAIL  no .docx files found in /tmp/rubriclens-docx — run test/docx.js first')
    sys.exit(1)

required = {'[Content_Types].xml', 'word/document.xml', '_rels/.rels'}
for f in files:
    try:
        z = zipfile.ZipFile(f)
        names = set(z.namelist())
        missing = required - names
        bad_xml = []
        for n in names:
            if n.endswith('.xml') or n.endswith('.rels'):
                try:
                    ET.fromstring(z.read(n))
                except ET.ParseError as e:
                    bad_xml.append(f'{n}: {e}')
        ok = not missing and not bad_xml
        print(('PASS' if ok else 'FAIL') + f'  {f}  ({len(names)} parts)')
        for m in sorted(missing):
            print(f'       missing part: {m}')
        for b in bad_xml:
            print(f'       bad xml: {b}')
        if not ok:
            failures += 1
    except zipfile.BadZipFile as e:
        print(f'FAIL  {f}  not a zip: {e}')
        failures += 1

sys.exit(1 if failures else 0)
