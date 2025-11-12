// script-logmanager.ts
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { chromium, Page, BrowserContext } from 'playwright'
import * as XLSX from 'xlsx/xlsx.mjs'
import { exec } from 'child_process'

// Carregar .env do diretório correto
const envPath = path.resolve(process.cwd(), '.env')
console.log(`[DEBUG] Tentando carregar .env de: ${envPath}`)
console.log(`[DEBUG] .env existe: ${fs.existsSync(envPath)}`)
dotenv.config({ path: envPath })

// xlsx ESM + registrar fs para APIs de arquivo
XLSX.set_fs(fs)

// ============ ENV ============
const URL_ALVO = process.env.SITE_URL!
const USER = process.env.SITE_USER || ''
const PASS = process.env.SITE_PASSWORD || ''
const STORAGE = process.env.STORAGE_STATE || 'storageState-logmanager.json'
const HEADLESS = (process.env.HEADLESS || 'false').toLowerCase() === 'true'
const DOWNLOAD_DIR = process.env.REPORT_DOWNLOAD_DIR || 'downloads'

// integração Python
const PYTHON_BIN = process.env.PYTHON_BIN || 'python'
const PYTHON_SCRIPT = process.env.PYTHON_SCRIPT || 'previa.py'

// ============ LOGGING ============
const LOG_DIR = 'logs'
const LOG_FILE = path.join(LOG_DIR, `automation-${new Date().toISOString().replace(/[:.]/g, '-')}.log`)

function initLogger() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
  log('========================================')
  log('🚀 Iniciando automação')
  log(`📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}`)
  log(`💻 Sistema: ${process.platform}`)
  log(`📦 Node: ${process.version}`)
  log(`📂 CWD: ${process.cwd()}`)
  log(`📂 __dirname: ${__dirname}`)
  log(`🌐 URL Alvo: ${URL_ALVO}`)
  log(`👤 Usuário: ${USER ? '***' : '(não definido)'}`)
  log(`🔒 Headless: ${HEADLESS}`)
  log(`📁 Download Dir: ${DOWNLOAD_DIR}`)
  log(`🐍 Python: ${PYTHON_BIN}`)
  log(`📜 Python Script: ${PYTHON_SCRIPT}`)
  log(`🎭 Playwright Browsers: ${process.env.PLAYWRIGHT_BROWSERS_PATH || '(system default)'}`)
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    log(`🎭 Browsers path exists: ${fs.existsSync(process.env.PLAYWRIGHT_BROWSERS_PATH)}`)
  }
  log('========================================\n')
}

function log(message: string, isError = false) {
  const timestamp = new Date().toISOString()
  const prefix = isError ? '❌ ERROR' : 'ℹ️  INFO'
  const logMessage = `[${timestamp}] ${prefix}: ${message}\n`

  // Escrever no arquivo
  fs.appendFileSync(LOG_FILE, logMessage, 'utf-8')

  // Também exibir no console
  if (isError) {
    console.error(message)
  } else {
    console.log(message)
  }
}

function logError(message: string, error: any) {
  log(`${message}`, true)
  log(`Mensagem de erro: ${error.message || String(error)}`, true)
  if (error.stack) {
    log(`Stack trace:\n${error.stack}`, true)
  }
  if (error.code) {
    log(`Código de erro: ${error.code}`, true)
  }
  log('----------------------------------------\n', true)
}

// ============ UTILS ============
async function ensureDir(p: string) {
  await fs.promises.mkdir(p, { recursive: true }).catch(() => {})
}

function runPython(csvAbsolutePath: string, outputDir: string, motoboysCsvPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Determinar se PYTHON_SCRIPT é um executável standalone
    const isStandaloneExe = PYTHON_SCRIPT.toLowerCase().endsWith('.exe') || path.isAbsolute(PYTHON_SCRIPT)

    let cmd: string
    if (isStandaloneExe) {
      // Executável standalone: resolver caminho e executar diretamente
      const pythonPath = path.isAbsolute(PYTHON_SCRIPT) ? PYTHON_SCRIPT : path.resolve(process.cwd(), PYTHON_SCRIPT)
      cmd = `"${pythonPath}" "${csvAbsolutePath}" "${outputDir}" "${motoboysCsvPath}"`
    } else {
      // Script Python tradicional: usar interpretador + script
      const pythonBin = PYTHON_BIN || 'python'
      const scriptPath = path.isAbsolute(PYTHON_SCRIPT) ? PYTHON_SCRIPT : path.resolve(process.cwd(), PYTHON_SCRIPT)
      cmd = `${pythonBin} "${scriptPath}" "${csvAbsolutePath}" "${outputDir}" "${motoboysCsvPath}"`
    }
    log(`🐍 Executando comando Python: ${cmd}`)
    log(`📂 CSV Input: ${csvAbsolutePath}`)
    log(`📂 Output Dir: ${outputDir}`)
    log(`📂 Motoboys CSV: ${motoboysCsvPath}`)

    exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        logError('Erro ao executar script Python', error)
        log(`Comando executado: ${cmd}`, true)
        return reject(error)
      }
      if (stderr) {
        log(`⚠️ Python STDERR:\n${stderr}`)
      }
      if (stdout) {
        log(`🐍 Python STDOUT:\n${stdout}`)
      }
      log('✅ Python executado com sucesso')
      resolve()
    })
  })
}

// ============ LOGIN ============
async function isLoginScreen(page: Page) {
  try {
    const count = await page.locator('#login-form').count()
    log(`Verificando tela de login: ${count > 0 ? 'Login necessário' : 'Já logado'}`)
    return count
  } catch (error) {
    logError('Erro ao verificar tela de login', error)
    throw error
  }
}

async function doLogin(page: Page, context: BrowserContext) {
  try {
    log('🔐 Iniciando processo de login')
    await page.locator('#login-form').waitFor({ state: 'visible', timeout: 30000 })
    log('Formulário de login encontrado')

    await page.locator('#input-email').fill(USER)
    log('Email preenchido')

    await page.locator('#input-password').fill(PASS)
    log('Senha preenchida')

    const btn = page.locator('button:has-text("Entrar"), button[type="submit"]').first()
    if (await btn.count()) {
      await btn.click().catch(()=>{})
      log('Botão "Entrar" clicado')
    } else {
      await page.locator('#input-password').press('Enter').catch(()=>{})
      log('Enter pressionado no campo de senha')
    }

    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(()=>{})
    log('Aguardando carregamento da página após login')

    await context.storageState({ path: STORAGE })
    log(`✅ Login bem-sucedido, sessão salva em: ${STORAGE}`)
  } catch (error) {
    logError('Erro durante o processo de login', error)
    throw error
  }
}

async function ensureLogged(page: Page, context: BrowserContext) {
  try {
    log(`🌐 Navegando para: ${URL_ALVO}`)
    await page.goto(URL_ALVO, { waitUntil: 'domcontentloaded' })

    if (await isLoginScreen(page)) {
      log('🔐 Tela de login detectada, fazendo login...')
      await doLogin(page, context)
      await page.goto(URL_ALVO, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(()=>{})
    } else {
      log('✅ Usuário já está logado')
    }
  } catch (error) {
    logError('Erro ao garantir login', error)
    throw error
  }
}

// ============ Helper: selecionar "Paraná" em qualquer Select2 multi ============
async function selecionarParanaEmQualquerSelect2(page: Page) {
  try {
    log('🔍 Verificando se "Paraná" já está selecionado')
    const jaSelecionado = page.locator('.select2-selection__rendered >> text=Paraná')
    if (await jaSelecionado.count()) {
      log('✅ Estado "Paraná" já está selecionado.')
      return
    }

    log('🔎 Procurando Select2 na página')
    const selects = page.locator('.select2 .select2-selection')
    const total = await selects.count()
    log(`Encontrados ${total} Select2(s) na página`)

    if (!total) {
      const error = new Error('Nenhum Select2 encontrado na página.')
      logError('Falha ao encontrar Select2', error)
      throw error
    }

    for (let i = 0; i < total; i++) {
      log(`Tentando Select2 #${i + 1}/${total}`)
      const sel = selects.nth(i)
      await sel.click({ timeout: 5000 }).catch(()=>{})

      const search = page.locator('input.select2-search__field').first()
      if (!(await search.count())) {
        log(`Select2 #${i + 1} não abriu campo de busca, tentando próximo`)
        await page.keyboard.press('Escape').catch(()=>{})
        continue
      }

      log(`Preenchendo "Paraná" no Select2 #${i + 1}`)
      await search.fill('Paraná')
      await page.waitForTimeout(300)

      const opcaoParana = page.locator('.select2-results__option:has-text("Paraná")').first()
      if (await opcaoParana.count()) {
        await opcaoParana.click({ timeout: 5000 }).catch(()=>{})
        log('✅ Estado "Paraná" selecionado com sucesso')
        return
      }

      log(`Opção "Paraná" não encontrada no Select2 #${i + 1}`)
      await page.keyboard.press('Escape').catch(()=>{})
    }

    const error = new Error('Não foi possível selecionar "Paraná" em nenhum Select2.')
    logError('Falha ao selecionar Paraná', error)
    throw error
  } catch (error) {
    logError('Erro na função selecionarParanaEmQualquerSelect2', error)
    throw error
  }
}

// ============ FLUXO ============
async function fluxoDownloadEProcessar(page: Page) {
  try {
    log('========== INICIANDO FLUXO DE DOWNLOAD E PROCESSAMENTO ==========')

    // 1) Selecionar Estado "Paraná"
    log('📍 Etapa 1: Selecionando estado "Paraná"')
    await selecionarParanaEmQualquerSelect2(page)

    // 2) Pesquisar
    log('🔍 Etapa 2: Clicando em botão "Pesquisar"')
    const btnPesquisar = page.locator('#btnSearch')
    await btnPesquisar.waitFor({ state: 'visible', timeout: 15000 })
    await btnPesquisar.click()
    log('🔎 Botão "Pesquisar" clicado')
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(()=>{})
    log('Página carregada após pesquisa')

    // 3) Baixar PROMESSA — ancorado no card correto
    log('⬇️ Etapa 3: Localizando botão de download PROMESSA')
    const cardPromessa = page.locator('div.intro-y.box:has-text("PROMESSA")').first()
    const btnBaixarPromessa = cardPromessa
      .locator('button[onclick*="operationDataExport(\'card_1\'"], button#xlsxExport')
      .first()

    await btnBaixarPromessa.waitFor({ state: 'visible', timeout: 15000 })
    log('Botão de download PROMESSA encontrado')

    await btnBaixarPromessa.click({ trial: false })
    log('⬇️ Botão "Baixar PROMESSA" clicado')

    // 4) Modal: botão "Não"
    log('🔍 Etapa 4: Verificando modal de confirmação')
    const btnNao = page.locator('button.swal2-deny:has-text("Não")')
    if (await btnNao.count()) {
      await btnNao.click()
      log('❌ Modal de confirmação: clicado em "Não"')
    } else {
      log('ℹ️ Modal de confirmação não apareceu')
    }

    // 5) Central de Downloads
    log('📂 Etapa 5: Acessando Central de Downloads')
    const btnCentral = page.locator('button.swal2-confirm:has-text("Acessar Central de Downloads")')
    await btnCentral.waitFor({ state: 'visible', timeout: 20000 })
    log('Botão "Acessar Central de Downloads" encontrado')

    const [maybeNewPage] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null),
      btnCentral.click().then(() =>
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => null)
      ),
    ])

    const dPage = maybeNewPage ?? page
    const abaType = maybeNewPage ? 'NOVA aba' : 'MESMA aba'
    log(`📂 Central de Downloads aberta na ${abaType}`)

    // 6) Espera 15s e dá refresh
    log('⏳ Etapa 6: Aguardando 15 segundos antes do refresh')
    await dPage.waitForTimeout(15000)
    log('🔄 Fazendo refresh da página')
    await dPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
    await dPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    log('🔄 Refresh concluído')

    // 7) Pega SEMPRE o primeiro item da tabela
    log('📥 Etapa 7: Procurando link de download do arquivo .xlsx')
    const firstDownloadSelectors = [
      'table tbody tr:first-child a[href$=".xlsx"]',
      'table tr:first-child a[href$=".xlsx"]',
      'td.text-center a[href$=".xlsx"]',
      'a:has(i.fa-download)'
    ]

    let firstFoundSel: string | null = null
    for (const sel of firstDownloadSelectors) {
      log(`Tentando seletor: ${sel}`)
      const loc = dPage.locator(sel).first()
      if (await loc.count()) {
        try {
          await loc.waitFor({ state: 'visible', timeout: 3000 })
          firstFoundSel = sel
          log(`✅ Seletor encontrado: ${sel}`)
          break
        } catch {
          log(`Seletor ${sel} encontrado mas não visível`)
        }
      } else {
        log(`Seletor ${sel} não encontrado`)
      }
    }

    if (!firstFoundSel) {
      const error = new Error('Não encontrei o primeiro link .xlsx na Central de Downloads.')
      logError('Falha ao encontrar link de download', error)
      throw error
    }

    log('🎯 Preparando para baixar arquivo')
    const firstLink = dPage.locator(firstFoundSel).first()
    await firstLink.scrollIntoViewIfNeeded().catch(() => {})

    const [download] = await Promise.all([
      dPage.waitForEvent('download', { timeout: 60000 }),
      firstLink.click()
    ])

    log('⬇️ Download iniciado')
    await ensureDir(DOWNLOAD_DIR)
    const suggested = download.suggestedFilename() || `relatorio-${Date.now()}.xlsx`
    const finalPathXlsx = path.join(DOWNLOAD_DIR, suggested)
    await download.saveAs(finalPathXlsx)
    log(`✅ Relatório baixado em: ${finalPathXlsx}`)

    // 8) Converter para CSV com nome FIXO
    log('📊 Etapa 8: Convertendo arquivo XLSX para CSV')
    try {
      const buf = await fs.promises.readFile(finalPathXlsx)
      log(`Arquivo XLSX lido: ${finalPathXlsx} (${buf.length} bytes)`)

      const workbook = XLSX.read(buf, { type: 'buffer' })
      log(`Workbook carregado com ${workbook.SheetNames.length} aba(s)`)

      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        const error = new Error('Planilha vazia ou sem abas.')
        logError('Falha ao ler planilha', error)
        throw error
      }

      log(`Processando aba: ${sheetName}`)
      const csvData = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])
      const finalPathCsv = path.join(DOWNLOAD_DIR, 'planilha_entregas.csv') // nome fixo
      await fs.promises.writeFile(finalPathCsv, csvData, 'utf8')
      log(`✅ Arquivo convertido para CSV em: ${finalPathCsv}`)

      const ABS_CSV = path.resolve(finalPathCsv)
      log(`Caminho absoluto do CSV: ${ABS_CSV}`)

      // 9) Determinar diretório de saída
      const outputDir = process.env.OUTPUT_DIR || process.cwd()
      log(`📁 Diretório de saída: ${outputDir}`)

      // 10) Caminho do motoboys.csv (passado via env ou usar padrão)
      const motoboysCsvPath = process.env.MOTOBOYS_CSV_PATH || path.join(process.cwd(), 'motoboys.csv')
      log(`👥 Arquivo de motoboys: ${motoboysCsvPath}`)

      // Verificar se arquivos existem
      if (!fs.existsSync(ABS_CSV)) {
        const error = new Error(`CSV não encontrado: ${ABS_CSV}`)
        logError('CSV não existe', error)
        throw error
      }
      log(`✅ CSV existe e está acessível`)

      if (!fs.existsSync(motoboysCsvPath)) {
        log(`⚠️ AVISO: Arquivo motoboys.csv não encontrado em ${motoboysCsvPath}`, true)
      } else {
        log(`✅ Arquivo motoboys.csv encontrado`)
      }

      // 11) Chamar Python para processar o CSV e gerar a planilha final
      log('🐍 Etapa 9: Executando script Python para processar dados')
      await runPython(ABS_CSV, outputDir, motoboysCsvPath)
      log('🎉 Fluxo completo finalizado com sucesso!')
      log('========== FIM DO FLUXO ==========')
    } catch (err) {
      logError('Falha ao converter XLSX para CSV ou processar dados', err)
      throw err
    }
  } catch (error) {
    logError('ERRO CRÍTICO no fluxo principal', error)
    throw error
  }
}

// ============ RUNNER ============
async function main() {
  try {
    // Inicializar logger
    initLogger()

    log('🌐 Iniciando navegador Chromium')
    const browser = await chromium.launch({ headless: HEADLESS })
    log(`Navegador iniciado em modo ${HEADLESS ? 'headless' : 'com interface'}`)

    log('📝 Configurando contexto do navegador')
    const storageExists = fs.existsSync(STORAGE)
    log(`Storage state: ${storageExists ? `Carregando de ${STORAGE}` : 'Criando novo'}`)

    const context = await browser.newContext({
      acceptDownloads: true,
      storageState: storageExists ? STORAGE : undefined
    })

    const page = await context.newPage()
    log('✅ Nova página criada')

    try {
      await ensureLogged(page, context)
      await fluxoDownloadEProcessar(page)
    } catch (err) {
      logError('❌ ERRO FATAL no fluxo de automação', err)

      // Tirar screenshot do erro
      const screenshotPath = `erro-${Date.now()}.png`
      log(`📸 Tentando salvar screenshot em: ${screenshotPath}`)
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch((screenshotErr) => {
        logError('Falha ao salvar screenshot', screenshotErr)
      })

      // Salvar HTML da página para debug
      try {
        const htmlPath = `erro-${Date.now()}.html`
        const htmlContent = await page.content()
        await fs.promises.writeFile(htmlPath, htmlContent, 'utf-8')
        log(`📄 HTML da página salvo em: ${htmlPath}`)
      } catch (htmlErr) {
        logError('Falha ao salvar HTML da página', htmlErr)
      }

      log(`📋 Log completo salvo em: ${LOG_FILE}`, true)
      process.exitCode = 1
    } finally {
      log('🔒 Fechando navegador')
      await browser.close()
      log('✅ Navegador fechado')
    }
  } catch (err) {
    console.error('❌ ERRO CRÍTICO ao inicializar automação:', err)
    if (err instanceof Error) {
      console.error('Stack trace:', err.stack)
    }
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('❌ ERRO NÃO TRATADO:', err)
  if (err instanceof Error) {
    console.error('Stack trace:', err.stack)
  }
  process.exit(1)
})
