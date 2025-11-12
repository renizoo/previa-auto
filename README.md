# Sistema de Atribuição de Entregas para Motoboys

Sistema desktop completo para automação de download, processamento e atribuição de entregas para motoboys.

## Funcionalidades

### 🚀 Automação Completa
- Login automático no sistema LogManager
- Download automático do relatório de entregas (Paraná)
- Conversão de XLSX para CSV
- Processamento inteligente com fuzzy matching
- Atribuição automática de entregas por CEP, bairro e cidade
- Geração de planilha final com resumo
- Classificação de tipo de envio (ML, Shopee, Outros)

### 👥 Gerenciamento de Motoboys
- Visualizar todos os motoboys cadastrados
- Adicionar novos motoboys
- Editar informações de motoboys existentes
- Remover motoboys
- Interface intuitiva e moderna

## Requisitos

- Node.js (v16 ou superior)
- Python 3 (com pandas, fuzzywuzzy, openpyxl)
- macOS, Windows ou Linux

## Instalação

1. Clone ou extraia o projeto
2. Instale as dependências do Node.js:
```bash
npm install
```

3. Instale as dependências do Python:
```bash
pip3 install pandas fuzzywuzzy openpyxl python-Levenshtein
```

4. Configure o arquivo `.env` com suas credenciais:
```
SITE_URL=https://app.logmanager.com.br/...
SITE_USER=seu_email@exemplo.com
SITE_PASSWORD=sua_senha
HEADLESS=true
```

## Uso

### Modo Desenvolvimento
```bash
npm start
```

### Gerar Aplicativo Executável

Para macOS:
```bash
npm run dist
```

Para todas as plataformas (Windows, macOS, Linux):
```bash
npm run dist:all
```

O aplicativo gerado estará na pasta `dist/`

## Estrutura de Arquivos

```
previa-auto/
├── main.js              # Processo principal do Electron
├── preload.js           # Bridge segura entre renderer e main
├── renderer.js          # Lógica da interface
├── index.html           # Interface do usuário
├── script-logmanager.ts # Automação com Playwright
├── previa.py            # Processamento Python
├── motoboys.csv         # Banco de dados de motoboys
├── .env                 # Configurações (credenciais)
└── package.json         # Dependências e scripts

Arquivos gerados:
├── downloads/                           # Relatórios baixados
├── entregas_atribuidas_com_resumo.xlsx  # Planilha final
└── storageState-logmanager.json         # Sessão salva
```

## Formato do motoboys.csv

```csv
nome_do_motoboy,cidade,bairro,cep
João Silva,Curitiba,Centro,80020
Maria Santos,Curitiba,,
Pedro Costa,Pinhais,Jardim Claudia,
```

**Regras de atribuição:**
- Se `bairro` e `cep` vazios: atende toda a cidade
- Se apenas `cep` vazio: atende por fuzzy match de bairro
- Se `cep` preenchido: atende por CEP (primeiros 5 dígitos)

## Como Usar o Sistema

### Tab Automação
1. Clique em "Iniciar Automação Completa"
2. O sistema irá:
   - Limpar arquivos antigos
   - Fazer login no LogManager
   - Baixar o relatório de entregas
   - Processar e atribuir motoboys
   - Gerar planilha final
3. Clique em "Abrir Arquivo" para visualizar o resultado

### Tab Gerenciar Motoboys
1. Visualize todos os motoboys cadastrados
2. Clique em "Adicionar Motoboy" para cadastrar novo
3. Use "Editar" para modificar informações
4. Use "Deletar" para remover (com confirmação)

## Planilha Final Gerada

**Aba "Entregas":**
- CEP, BAIRRO, CIDADE, LOGRADOURO, NÚMERO
- MOTOBOY (atribuído automaticamente)
- TIPO_ENVIO (ML, Shopee, Outros)

**Aba "Resumo":**
- Nº, MOTOBOY, QTD_ENTREGAS
- Fórmulas automáticas de contagem
- Data de geração

## Sistema de Logs e Debugging

O sistema agora possui um sistema completo de logging para facilitar a identificação de problemas.

### 📋 Arquivos de Log

Quando a automação é executada, são gerados automaticamente:

1. **Arquivo de log detalhado** - `logs/automation-YYYY-MM-DDTHH-MM-SS-sssZ.log`
   - Registra todas as etapas da automação
   - Inclui timestamps de cada operação
   - Contém stack traces completos de erros
   - Informações de configuração do ambiente

2. **Screenshot de erro** - `erro-{timestamp}.png`
   - Capturado automaticamente quando ocorre erro
   - Mostra o estado da página no momento do erro

3. **HTML de erro** - `erro-{timestamp}.html`
   - Código HTML completo da página no momento do erro
   - Útil para debug de problemas de interface

### 🔍 Como Usar os Logs

Quando ocorrer um erro:

1. O sistema exibirá a mensagem: "📋 Log completo salvo em: logs/automation-..."
2. Abra o arquivo de log para ver detalhes completos do erro
3. Procure por linhas com "❌ ERROR" para identificar o problema
4. O log inclui:
   - Informações do sistema (SO, Node.js, Python)
   - URL e configurações de acesso
   - Cada etapa da automação com timestamps
   - Stack traces completos de erros
   - Verificações de arquivos e diretórios

### 📊 Console do Electron

Em modo desenvolvimento, o console do Electron também mostra:
- Platform e caminhos de sistema
- Comandos executados
- Saídas de stdout e stderr
- Códigos de saída dos processos

Para ver o console do Electron:
1. Descomente a linha no `main.js`: `mainWindow.webContents.openDevTools();`
2. Execute `npm start`
3. Console aparecerá automaticamente

## Troubleshooting

### Erro de Login
- Verifique as credenciais no arquivo `.env`
- Certifique-se de que o arquivo `storageState-logmanager.json` existe
- **Verifique o log** para ver se o formulário de login foi encontrado

### Erro no Python
- Instale as dependências: `pip3 install -r requirements.txt`
- Verifique se Python 3 está no PATH
- **Verifique o log** para ver o comando Python executado e sua saída

### Erro de Permissão
- No macOS, autorize o app nas Configurações > Privacidade
- No Windows, execute como administrador se necessário

### Erro "Desconhecido ao executar automação"
- **SEMPRE consulte o arquivo de log** em `logs/`
- O log conterá detalhes completos do erro
- Verifique também os arquivos de screenshot e HTML gerados

### Problemas no Windows
- Verifique os logs do console do Electron
- Certifique-se de que Node.js e Python estão no PATH
- Verifique as permissões da pasta de instalação

## Suporte

Para problemas ou dúvidas, entre em contato com o desenvolvedor.

## Licença

ISC License
