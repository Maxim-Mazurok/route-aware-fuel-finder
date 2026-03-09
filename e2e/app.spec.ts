import { expect, test } from '@playwright/test'

test.use({
  geolocation: { latitude: -33.8731, longitude: 151.2065 },
  permissions: ['geolocation'],
})

test('plans a route and shows ranked stations', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Destination').fill('Parramatta Station, Parramatta NSW 2150')
  const planButton = page.getByRole('button', { name: 'Plan route' })
  await expect(planButton).toBeEnabled()
  await planButton.click()

  await expect(page.getByText('Stations on your way')).toBeVisible()
  await expect(page.getByTestId('station-card').first()).toBeVisible()
  await expect(page.getByText('Base route')).toBeVisible()
})

test('saves and reuses the home address', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Home address').fill('22 Example Street, Petersham NSW 2049')
  await page.reload()

  await expect(page.getByLabel('Home address')).toHaveValue(
    '22 Example Street, Petersham NSW 2049',
  )

  await page.getByRole('button', { name: 'Use home' }).click()
  await expect(page.getByLabel('Destination')).toHaveValue(
    '22 Example Street, Petersham NSW 2049',
  )
})
