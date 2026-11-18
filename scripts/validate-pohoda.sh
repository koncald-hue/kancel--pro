#!/bin/sh
# Ověří soubor pohoda-faktury.xml proti oficiálním schématům STORMWARE (stáhne je do dočasné složky). Potřebuje curl, python3 a xmllint.
#   sh scripts/validate-pohoda.sh pohoda-faktury.xml
set -e
[ -f "$1" ] || { echo "Zadejte soubor XML."; exit 2; }
D=$(mktemp -d); cd "$D"
python3 - <<'PY'
import re, subprocess, collections, os
seen=set(); q=collections.deque(['data.xsd'])
while q:
    f=q.popleft()
    if f in seen: continue
    seen.add(f); subprocess.run(['curl','-s','-L','-m','40','-o',f,'https://www.stormware.cz/schema/version_2/'+f])
    for m in re.findall(r'schemaLocation="([^"]+)"', open(f,encoding='cp1250',errors='ignore').read()):
        if m not in seen: q.append(m)
PY
cd - >/dev/null; xmllint --noout --schema "$D/data.xsd" "$1"; rm -rf "$D"
