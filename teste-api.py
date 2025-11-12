import math
import time
import csv
import json
import requests

API_URL = "https://app.logmanager.com.br/api/v1/clients"

PER_PAGE = 100
START_PAGE = 0                 # sua API retornou page=0, então é 0-based
RATE_SLEEP = 0.05              # 50 ms entre chamadas para ser educado com a API

headers = {"Token": "aCvO0qLoE80WILPgpSCVJQ1OEAbFsjF2UtpdpYymTZEWpnmEFZfV2YRuLakoXGsC6mQI0TnObtwLeAVs4s9TfkRmfKA2HzgULSvwKrcXSAU72MZelSHdI5NAFztgLHlISpPe2C3X32Auclm0s3lPhsxmlTBHeyqBWVu1sJzWy9bbpJgDwUCmi46LK0XF639b2df7007da", "Content-Type": "application/json", "Accept": "application/json"}


def get_page(page: int, per_page: int):
    resp = requests.get(API_URL, headers=headers, params={"page": page, "per_page": per_page}, timeout=60)
    if resp.status_code == 429:
        # backoff simples se bater rate limit
        time.sleep(1.0)
        resp = requests.get(API_URL, headers=headers, params={"page": page, "per_page": per_page}, timeout=60)
    resp.raise_for_status()
    return resp.json()

# 1) primeira chamada para descobrir total
first = get_page(START_PAGE, PER_PAGE)
total = first.get("total", 0)
per_page = first.get("per_page", PER_PAGE)
page0 = first.get("page", START_PAGE)
items = first.get("data", []) or []

total_pages = math.ceil(total / per_page) if per_page else 1
print(f"total={total} | per_page={per_page} | page0={page0} | total_pages={total_pages}")

# 2) acumular tudo
all_items = []
all_items.extend(items)

# varrer páginas restantes
for page in range(START_PAGE + 1, total_pages):
    time.sleep(RATE_SLEEP)
    js = get_page(page, per_page)
    batch = js.get("data", []) or []
    all_items.extend(batch)
    print(f"coletado: {len(all_items)}/{total} (página {page}/{total_pages-1})")

print(f"\nTotal final coletado: {len(all_items)} itens.")

# 3) salvar JSON
with open("drivers.json", "w", encoding="utf-8") as f:
    json.dump(all_items, f, ensure_ascii=False, indent=2)

# 4) salvar CSV (usa as chaves encontradas nos objetos)
#    monta o cabeçalho como união de todas as chaves para evitar perda de campos
fieldnames = set()
for it in all_items:
    if isinstance(it, dict):
        fieldnames.update(it.keys())
fieldnames = sorted(fieldnames)

with open("drivers.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for it in all_items:
        if isinstance(it, dict):
            writer.writerow({k: it.get(k, "") for k in fieldnames})
        else:
            # se vier algo que não é dict, joga numa coluna "value"
            writer.writerow({fieldnames[0]: str(it)})

print("Arquivos salvos: drivers.json e drivers.csv")

