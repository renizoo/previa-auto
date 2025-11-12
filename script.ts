// script-logmanager.ts
import 'dotenv/config'
import fs from 'fs'
import { chromium, Page, BrowserContext } from 'playwright'

const URL_ALVO = process.env.SITE_URL!
const USER = process.env.SITE_USER || ''
const PASS = process.env.SITE_PASSWORD || ''
const HEADLESS = (process.env.HEADLESS || 'false').toLowerCase() === 'true'
const RETRIES = Number(process.env.RUN_MAX_RETRIES || 2)
const STORAGE = process.env.STORAGE_STATE || 'storageState-logmanager.json'

// ==== helpers ====
async function newContext(browser) {
  if (fs.existsSync(STORAGE)) return browser.newContext({ storageState: STORAGE })
  return browser.newContext()
}

async function doLogin(page: Page, context: BrowserContext) {
  if (!USER || !PASS) throw new Error('SITE_USER/SITE_PASSWORD ausentes no .env')

  // Aguarda input de email/usuário
  const emailInput = page.locator('input[type="email"], input[name="username"], input[name="email"]').first()
  await emailInput.waitFor({ state: 'visible', timeout: 30_000 })
  await emailInput.fill(USER)

  // Input de senha
  const passInput = page.locator('input[type="password"], input[name="password"]').first()
  await passInput.fill(PASS)

  // Botão de login
  const loginBtn = page.getByRole('button', { name: /entrar|login|acessar|sign in/i }).first()
  await loginBtn.click()

  // Espera a navegação após login
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
  await context.storageState({ path: STORAGE })
}

async function ensureAtTargetUrlLogged(page: Page, context: BrowserContext) {
  await page.goto(URL_ALVO, { waitUntil: 'domcontentloaded' })

  // Se cair no login, vai ter input de email
  const isLogin = await page.locator('input[type="email"], input[name="username"]').count()
  if (isLogin) {
    await doLogin(page, context)
    // reabre URL alvo já logado
    await page.goto(URL_ALVO, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
  }
}

// ==== fluxo principal ====
async function runOnce() {
  const browser = await chromium.launch({ headless: HEADLESS })
  const context = await newContext(browser)
  const page = await context.newPage()
  try {
    await ensureAtTargetUrlLogged(page, context)

    // 👉 Aqui entram suas próximas ações dentro do LogManager
    console.log('✅ Login realizado e página carregada:', URL_ALVO)

    await page.screenshot({ path: `ok-logmanager-${Date.now()}.png`, fullPage: true })
  } catch (err) {
    console.error('❌ Erro no fluxo LogManager:', err)
    await page.screenshot({ path: `erro-logmanager-${Date.now()}.png`, fullPage: true }).catch(() => {})
    throw err
  } finally {
    await browser.close()
  }
}

async function main() {
  for (let i = 1; i <= RETRIES; i++) {
    try {
      console.log(`▶️ Tentativa ${i}/${RETRIES}`)
      await runOnce()
      console.log(`✅ Sucesso na tentativa ${i}`)
      break
    } catch (e) {
      console.error(`❌ Falha tentativa ${i}:`, e)
      if (i === RETRIES) process.exitCode = 1
      await new Promise(r => setTimeout(r, 2000 * i))
    }
  }
}
main()
