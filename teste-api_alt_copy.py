import csv
import time
import requests
from pathlib import Path
from collections import deque

# ===== CONFIG =====
CSV_PATH = "drivers.csv"
BASE_URL = "https://app.logmanager.com.br/api/v1/clients"
TOKEN = "iFkECjA2Gqv2FLALGjupomsbu7QornEvogzxpLty3KmC4tCGAAJWy1FjJLkbIFUT8DModi944KjwTNK2IWKgfOhxHAJMtp9vrZ0soKxkdf8Ow20vTVGrYCO0nGYIUAUNiJ8kZrgYN1inWUfrLtaHJC9BtdMSGLsW1p6UJnIZo5I68weeMKdrwG3IU4Gc65aeda75033b9"          # coloque seu token aqui
USE_BEARER = False                 # True -> "Authorization: Bearer", False -> "Token"


# phones vazio => remove todos os telefones
PAYLOAD = {"phones": ["1"]}
# Se sua instalação exigir um item vazio em vez de array vazio:
# PAYLOAD = {"phones": [""]}

# Limite global: 10 requisições por 60s (qualquer endpoint)
RATE_LIMIT_MAX = 18
RATE_LIMIT_WINDOW = 60  # segundos
MAX_RETRIES = 2         # tentativas extras em 429/5xx

# ========= HEADERS =========
headers = {
    ("Authorization" if USE_BEARER else "Token"): (f"Bearer {TOKEN}" if USE_BEARER else TOKEN),
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# ========= RATE LIMITER (janela deslizante) =========
class RateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self.calls = deque()  # timestamps dos últimos calls

    def wait(self):
        now = time.time()
        # remove chamadas fora da janela
        while self.calls and now - self.calls[0] >= self.window:
            self.calls.popleft()
        if len(self.calls) >= self.limit:
            sleep_for = self.window - (now - self.calls[0]) + 0.01
            time.sleep(max(0, sleep_for))
        # recalc & registra a chamada que faremos agora
        now = time.time()
        while self.calls and now - self.calls[0] >= self.window:
            self.calls.popleft()
        self.calls.append(now)

GLOBAL_LIMITER = RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)

# ========= UTIL: PUT com limite e retry =========
def limited_put(url: str, json_payload: dict):
    attempt = 0
    while True:
        attempt += 1
        GLOBAL_LIMITER.wait()  # garante <= 10 req/min
        resp = requests.put(url, headers=headers, json=json_payload, timeout=60)

        # Se respeitarmos o limite, 429 não deveria ocorrer, mas tratamos mesmo assim
        if resp.status_code == 429 and attempt <= MAX_RETRIES + 1:
            retry_after = resp.headers.get("Retry-After")
            wait_s = float(retry_after) if (retry_after and retry_after.isdigit()) else RATE_LIMIT_WINDOW
            time.sleep(wait_s)
            continue

        # Retry básico para 5xx
        if 500 <= resp.status_code < 600 and attempt <= MAX_RETRIES + 1:
            time.sleep(2 ** (attempt - 1))  # backoff exponencial simples
            continue

        return resp

# ========= LER CSV (IDs) =========
ids = []
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        cid = str(row.get("ID") or row.get("id") or "").strip()
        if cid:
            ids.append(cid)
ids = list(dict.fromkeys(ids))  # únicos, preservando ordem
print(f"Encontrados {len(ids)} IDs no CSV '{CSV_PATH}'.")

# ========= LOGS =========
ok_path = Path("put_success.csv")
err_path = Path("put_errors.csv")
with ok_path.open("w", newline="", encoding="utf-8") as okf, \
     err_path.open("w", newline="", encoding="utf-8") as erf:

    okw = csv.writer(okf); okw.writerow(["id", "status"])
    erw = csv.writer(erf); erw.writerow(["id", "status", "response"])

    success = 0
    for i, cid in enumerate(ids, 1):
        url = f"{BASE_URL}/{cid}"
        try:
            resp = limited_put(url, PAYLOAD)
            if 200 <= resp.status_code < 300:
                success += 1
                okw.writerow([cid, resp.status_code])
                print(f"[{i}/{len(ids)}] OK  -> id={cid} status={resp.status_code}")
            else:
                preview = (resp.text or "")[:500].replace("\n", " ")
                erw.writerow([cid, resp.status_code, preview])
                print(f"[{i}/{len(ids)}] ERR -> id={cid} status={resp.status_code} resp={preview}")
        except Exception as e:
            erw.writerow([cid, "EXC", str(e)])
            print(f"[{i}/{len(ids)}] EXC -> id={cid} error={e}")

print(f"\nConcluído: {success}/{len(ids)} clientes atualizados.")
print(f"Logs salvos: {ok_path} (sucessos) | {err_path} (erros)")