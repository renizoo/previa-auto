# -*- coding: utf-8 -*-
import sys
import os

# Configurar encoding UTF-8 para o stdout no Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import pandas as pd
from fuzzywuzzy import fuzz
import unicodedata
import string
from openpyxl import load_workbook
from datetime import datetime

# === Função para remover acentos, pontuação e sufixos irrelevantes ===
def normalizar(texto):
    texto = str(texto).lower().strip()
    texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('utf-8')
    texto = texto.translate(str.maketrans('', '', string.punctuation))
    texto = texto.replace(" de curitiba", "").replace(" de sao jose dos pinhais", "")
    return texto

# === 1. Carregar arquivos ===
csv_path = "planilha_entregas.csv"
output_dir = "."
motoboys_path = "motoboys.csv"

if len(sys.argv) > 1 and sys.argv[1]:
    csv_path = sys.argv[1]
if len(sys.argv) > 2 and sys.argv[2]:
    output_dir = sys.argv[2]
if len(sys.argv) > 3 and sys.argv[3]:
    motoboys_path = sys.argv[3]

df_entregas = pd.read_csv(csv_path)

df_motoboys = pd.read_csv(motoboys_path)

# === 2. Normalizar dados ===
df_entregas['CEP'] = df_entregas['CEP'].astype(str).str.strip()
df_entregas['CEP_COMP'] = df_entregas['CEP'].str[:5]

df_entregas['Bairro'] = df_entregas['Bairro'].apply(normalizar)
df_entregas['Cidade'] = df_entregas['Cidade'].apply(normalizar)

df_motoboys['bairro'] = df_motoboys['bairro'].fillna('').apply(normalizar)
df_motoboys['cidade'] = df_motoboys['cidade'].fillna('').apply(normalizar)
df_motoboys['cep'] = df_motoboys['cep'].fillna('').astype(str).str[:5].str.strip()

# === 3. Inicializar coluna de motoboy ===
df_entregas['MOTOBOY'] = ""

# === 4. Fuzzy matching de bairro ===
def bairro_compatível(bairro_entrega, bairro_motoboy):
    if not bairro_entrega or not bairro_motoboy:
        return False
    return fuzz.token_sort_ratio(bairro_entrega, bairro_motoboy) >= 85

# === 5. Loop para atribuir motoboys ===
for i, entrega in df_entregas.iterrows():
    cidade_entrega = entrega['Cidade']
    bairro_entrega = entrega['Bairro']
    cep_comp = entrega['CEP_COMP']

    for _, motoboy in df_motoboys.iterrows():
        nome = motoboy['nome_do_motoboy']
        cidade_m = motoboy['cidade']
        bairro_m = motoboy['bairro']
        cep_m = motoboy['cep']

        if cidade_entrega != cidade_m:
            continue

        if bairro_m == "" and cep_m == "":
            df_entregas.at[i, 'MOTOBOY'] = nome
            break

        elif bairro_m != "" and cep_m == "":
            if bairro_compatível(bairro_entrega, bairro_m):
                df_entregas.at[i, 'MOTOBOY'] = nome
                break

        elif cep_m != "":
            if cep_comp.startswith(cep_m):
                df_entregas.at[i, 'MOTOBOY'] = nome
                break

# === 6. Gerar planilha de saída ===
df_saida = df_entregas[['pacote', 'etiqueta', 'CEP', 'Bairro', 'Cidade', 'Logradouro', 'Número', 'MOTOBOY']].rename(columns={
    'pacote': 'CODIGO1',
    'etiqueta': 'CODIGO2',
    'CEP': 'CEP',
    'Bairro': 'BAIRRO',
    'Cidade': 'CIDADE',
    'Logradouro': 'LOGRADOURO',
    'Número': 'NÚMERO'
})

df_saida['MOTOBOY'] = df_saida['MOTOBOY'].replace("", "SEM MOTOBOY")

motoboys_planilha = df_motoboys['nome_do_motoboy'].unique().tolist()
motoboys_entregas = df_saida['MOTOBOY'].unique().tolist()
todos_motoboys = sorted(set(motoboys_planilha + motoboys_entregas), key=lambda x: (x != "SEM MOTOBOY", x))

# ➕ Numeração da coluna
numeros = list(range(1, len(todos_motoboys) + 1))
df_resumo = pd.DataFrame({
    'Nº': numeros,
    'MOTOBOY': todos_motoboys,
    'QTD_ENTREGAS': [""] * len(todos_motoboys)
})

# === 7. Gerar nome do arquivo com quantidade, data e hora ===
quantidade_entregas = len(df_saida)
agora = datetime.now()
data_str = agora.strftime("%d-%m-%Y")
hora_str = agora.strftime("%Hh%Mm")

nome_arquivo = f"entregas_{quantidade_entregas}_{data_str}_{hora_str}.xlsx"
arquivo_saida = os.path.join(output_dir, nome_arquivo)

# Exportar planilha
with pd.ExcelWriter(arquivo_saida, engine='openpyxl') as writer:
    df_saida.to_excel(writer, sheet_name="Entregas", index=False)
    df_resumo.to_excel(writer, sheet_name="Resumo", index=False)

# Inserir fórmulas CONT.SE e data
wb = load_workbook(arquivo_saida)
ws_resumo = wb["Resumo"]

for i in range(2, len(df_resumo) + 2):  # da linha 2 em diante
    ws_resumo[f'C{i}'] = f'=COUNTIF(Entregas!H:H, B{i})'

# ➕ Inserir data no topo da planilha
hoje = datetime.today().strftime('%d/%m/%Y')
ws_resumo["E1"] = f"Data: {hoje}"

# Salvar
wb.save(arquivo_saida)

print(f"✅ Arquivo gerado com sucesso!")
print(f"📄 Arquivo salvo em: {arquivo_saida}")
print(f"📊 Total de entregas: {quantidade_entregas}")
