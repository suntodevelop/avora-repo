"""Read source XLSX cells/hyperlinks without modifying or executing workbook content."""
import json
import posixpath
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

source = Path(sys.argv[1])
target = Path(sys.argv[2])
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
pkg = {'p': 'http://schemas.openxmlformats.org/package/2006/relationships'}
with zipfile.ZipFile(source) as archive:
    shared = []
    if 'xl/sharedStrings.xml' in archive.namelist():
        for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', ns):
            shared.append(''.join(item.itertext()))
    relationships = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
    result = {'source': source.name, 'sheets': []}
    for sheet in ET.fromstring(archive.read('xl/workbook.xml')).findall('s:sheets/s:sheet', ns):
        relation = relationships[sheet.attrib['{' + ns['r'] + '}id']]
        filename = posixpath.normpath(posixpath.join('xl', relation)) if not relation.startswith('/') else relation.lstrip('/')
        xml = ET.fromstring(archive.read(filename))
        relfile = posixpath.join(posixpath.dirname(filename), '_rels', posixpath.basename(filename) + '.rels')
        links = {}
        if relfile in archive.namelist():
            related = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(archive.read(relfile))}
            for link in xml.findall('s:hyperlinks/s:hyperlink', ns):
                rid = link.attrib.get('{' + ns['r'] + '}id')
                if rid in related:
                    links[link.attrib['ref']] = related[rid]
        rows = []
        for row in xml.findall('s:sheetData/s:row', ns):
            cells = []
            for cell in row.findall('s:c', ns):
                value = cell.findtext('s:v', default='', namespaces=ns)
                if cell.attrib.get('t') == 's' and value:
                    value = shared[int(value)]
                elif cell.attrib.get('t') == 'inlineStr':
                    value = ''.join(cell.find('s:is', ns).itertext())
                if value or cell.attrib['r'] in links:
                    record = {'cell': cell.attrib['r'], 'value': value}
                    if cell.attrib['r'] in links:
                        record['url'] = links[cell.attrib['r']]
                    cells.append(record)
            if cells:
                rows.append({'row': int(row.attrib['r']), 'cells': cells})
        result['sheets'].append({'name': sheet.attrib['name'], 'rows': rows, 'merged': [m.attrib['ref'] for m in xml.findall('s:mergeCells/s:mergeCell', ns)]})
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
for sheet in result['sheets']:
    print(json.dumps({'sheet': sheet['name'], 'rowCount': len(sheet['rows']), 'sample': sheet['rows'][:12]}, ensure_ascii=False))
