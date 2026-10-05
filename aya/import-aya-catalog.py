#!/usr/bin/env python3
"""Import the Aya standalone avatar catalog into Mercury's catalog, for free.

Reads aya-dev/web/char.json (items), char_map.json (asset type names) and the
char/<id>.thumb.png thumbnails. Items keep their Roblox asset IDs, so the Site's
/asset route resolves them through the Aya library/API fallback when worn.

- Accessories (Hair, Face, Neck, Shoulder, Front, Back, Waist) become Hats (8),
  which Mercury lists and lets users wear.
- Body parts (27-31), heads, faces, T-shirts, shirts, pants and hats keep their type.
- Items without a type (0) are skipped.

Owned and created by a dedicated "AyaCatalog" account that can't be logged into.
Already imported IDs are skipped, so it can be re-run.

Usage: aya/import-aya-catalog.py [path/to/aya-dev/web]
"""

import json
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from base64 import b64encode
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "aya-dev" / "web"
DB_URL = "http://127.0.0.1:8000/sql"
DB_AUTH = "Basic " + b64encode(b"root:root").decode()
CREATOR = "AyaCatalog"

ACCESSORY_TYPES = {41, 42, 43, 44, 45, 46, 47}  # Hair, Face, Neck, Shoulder, Front, Back, Waist
KEPT_TYPES = {2, 8, 11, 12, 17, 18, 27, 28, 29, 30, 31}


def query(sql, **params):
    lets = "".join(f"LET ${k} = {json.dumps(v, ensure_ascii=False)};\n" for k, v in params.items())
    req = urllib.request.Request(
        DB_URL,
        data=(lets + sql).encode(),
        headers={
            "Authorization": DB_AUTH,
            "surreal-ns": "main",
            "surreal-db": "main",
            "Accept": "application/json",
        },
    )
    try:
        results = json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        raise SystemExit(f"query failed: {e.read().decode()[:1000]}")
    for r in results:
        if r.get("status") != "OK":
            raise SystemExit(f"query failed: {r}")
    return results[-1]["result"]


def password_hash():
    # a hash of a random secret nobody keeps, made with the Site's own Bun.password
    out = subprocess.run(
        ["docker", "compose", "exec", "-T", "site", "bun", "-e",
         "console.log(Bun.password.hashSync(crypto.randomUUID() + crypto.randomUUID()))"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    return out.stdout.strip()


def main():
    items = json.load(open(WEB / "char.json"))["items"]
    type_names = {t["value"]: t["name"] for t in json.load(open(WEB / "char_map.json"))}

    creator = query("SELECT VALUE id FROM user WHERE username = $name;", name=CREATOR)
    if creator:
        creator = creator[0]
    else:
        default_colours = query("RETURN (SELECT VALUE bodyColours FROM user LIMIT 1)[0];")
        creator = query(
            """CREATE ONLY user CONTENT {
                bodyColours: $colours, email: "", hashedPassword: $hash,
                permissionLevel: 1, username: $name,
                description: [{ text: "Owner of the items imported from the Aya avatar catalog." }],
            } RETURN VALUE id;""",
            colours=default_colours, hash=password_hash(), name=CREATOR,
        )
        print(f"created {CREATOR} ({creator})")

    existing = set(query("SELECT VALUE record::id(id) FROM asset;"))
    assets, skipped = [], {"untyped": 0, "existing": 0}
    for asset_id, item in items.items():
        aya_type = item["AssetTypeID"]
        if aya_type in ACCESSORY_TYPES:
            mercury_type = 8
        elif aya_type in KEPT_TYPES:
            mercury_type = aya_type
        else:
            skipped["untyped"] += 1
            continue
        if int(asset_id) in existing:
            skipped["existing"] += 1
            continue
        name = (item["Name"].strip() or f"{type_names.get(aya_type, 'Item')} {asset_id}")[:50]
        kind = type_names.get(aya_type, str(aya_type))
        assets.append({
            "id": int(asset_id),
            "name": name,
            "type": mercury_type,
            "description": f"{kind} from the Aya avatar catalog.",
        })

    thumbs_dir = ROOT / "data" / "thumbnails"
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    for i in range(0, len(assets), 200):
        batch = assets[i:i + 200]
        query(
            """LET $creator = <record> $creator;
            FOR $a IN $assets {
                LET $asset = CREATE ONLY type::record("asset", $a.id) CONTENT {
                    name: $a.name,
                    description: [{ text: $a.description }],
                    price: 0,
                    forSale: true,
                    type: $a.type,
                    visibility: "Visible",
                } RETURN VALUE id;
                RELATE $creator->created->$asset;
                RELATE $creator->ownsAsset->$asset;
            };""",
            assets=batch, creator=creator,
        )
        for a in batch:
            thumb = WEB / "char" / f"{a['id']}.thumb.png"
            if thumb.exists():
                shutil.copyfile(thumb, thumbs_dir / str(a["id"]))
        print(f"imported {min(i + 200, len(assets))}/{len(assets)}")

    print(f"done: {len(assets)} imported, {skipped['existing']} already present, "
          f"{skipped['untyped']} without a type skipped")


if __name__ == "__main__":
    main()
