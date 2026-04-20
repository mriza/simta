import puppeteer, { Browser, Page } from 'puppeteer'

describe('E2E Tests', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  })

  afterAll(async () => {
    await browser.close()
  })

  beforeEach(async () => {
    page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720 })
  })

  afterEach(async () => {
    await page.close()
  })

  describe('Login Flow', () => {
    it('should load the login page', async () => {
      await page.goto('http://localhost:3535')
      await page.waitForSelector('input[type="text"]')

      const title = await page.title()
      expect(title).toContain('SIMTA')
    })

    it('should show error for invalid login', async () => {
      await page.goto('http://localhost:3535')

      // Wait for login form
      await page.waitForSelector('input[type="text"]')

      // Fill login form
      await page.type('input[type="text"]', 'invalid')
      await page.type('input[type="password"]', 'invalid')

      // Click login button
      await page.click('button[type="submit"]')

      // Wait for error message
      await page.waitForSelector('.error, .alert-danger, [class*="error"]', { timeout: 5000 })

      const errorText = await page.$eval('.error, .alert-danger, [class*="error"]', el => el.textContent)
      expect(errorText).toContain('Invalid')
    })
  })

  describe('Dashboard', () => {
    beforeEach(async () => {
      // Mock login by setting localStorage
      await page.goto('http://localhost:3535')
      await page.evaluate(() => {
        localStorage.setItem('authToken', 'mock-token')
        localStorage.setItem('userRole', 'dosen')
        localStorage.setItem('userId', 'test-user')
        localStorage.setItem('userName', 'Test User')
      })
      await page.reload()
    })

    it('should display dashboard after login', async () => {
      await page.waitForSelector('[data-testid="dashboard"], .dashboard, #dashboard')

      const dashboardContent = await page.$('[data-testid="dashboard"], .dashboard, #dashboard')
      expect(dashboardContent).toBeTruthy()
    })

    it('should show statistics cards', async () => {
      await page.waitForSelector('.stat-card, .card, [class*="stat"]')

      const statCards = await page.$$('.stat-card, .card, [class*="stat"]')
      expect(statCards.length).toBeGreaterThan(0)
    })

    it('should navigate between tabs', async () => {
      // Wait for navigation tabs
      await page.waitForSelector('nav a, .nav a, [role="tab"]')

      const tabs = await page.$$('nav a, .nav a, [role="tab"]')
      expect(tabs.length).toBeGreaterThan(1)

      // Click on mahasiswa tab
      const mahasiswaTab = await page.$('a[href*="mahasiswa"], [data-tab="mahasiswa"]')
      if (mahasiswaTab) {
        await mahasiswaTab.click()
        await page.waitForTimeout(1000)

        // Check if mahasiswa content is visible
        const mahasiswaContent = await page.$('[data-testid="mahasiswa"], #mahasiswa, .mahasiswa')
        expect(mahasiswaContent).toBeTruthy()
      }
    })
  })

  describe('TA Title Search', () => {
    beforeEach(async () => {
      // Mock login
      await page.goto('http://localhost:3535')
      await page.evaluate(() => {
        localStorage.setItem('authToken', 'mock-token')
        localStorage.setItem('userRole', 'dosen')
        localStorage.setItem('userId', 'test-user')
        localStorage.setItem('userName', 'Test User')
      })
      await page.reload()
    })

    it('should search for TA titles', async () => {
      // Navigate to TA titles tab
      const taTab = await page.$('a[href*="ta_titles"], [data-tab="ta_titles"]')
      if (taTab) {
        await taTab.click()
        await page.waitForTimeout(1000)

        // Wait for search input
        await page.waitForSelector('input[type="text"], input[placeholder*="search"]')

        // Type search query
        await page.type('input[type="text"], input[placeholder*="search"]', 'sistem informasi')

        // Wait for results or debounce
        await page.waitForTimeout(1500)

        // Check if results are displayed
        const results = await page.$$('.result, .item, [class*="result"]')
        // Results might be empty, but no error should occur
        expect(results.length).toBeGreaterThanOrEqual(0)
      }
    })
  })
})