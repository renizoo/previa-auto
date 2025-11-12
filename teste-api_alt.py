import math
import time
import csv
import json
import requests

client_id = "131011"  # substitua pelo ID real do cliente
API_URL = f"https://app.logmanager.com.br/api/v1/clients/{client_id}"

headers = {"Token": "iFkECjA2Gqv2FLALGjupomsbu7QornEvogzxpLty3KmC4tCGAAJWy1FjJLkbIFUT8DModi944KjwTNK2IWKgfOhxHAJMtp9vrZ0soKxkdf8Ow20vTVGrYCO0nGYIUAUNiJ8kZrgYN1inWUfrLtaHJC9BtdMSGLsW1p6UJnIZo5I68weeMKdrwG3IU4Gc65aeda75033b9", "Content-Type": "application/json", "Accept": "application/json"}


payload = {
    "phones": [
        ""
    ]
}


r = requests.put(API_URL, headers=headers, json=payload)
print(r.status_code, r.text)
r.raise_for_status()
