import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function openMachine(page: Page) {
  await page.goto('/');
  // Streamlit Community Cloud wraps the dashboard in another iframe.
  const dashboard = process.env.HARVESTSHIELD_STREAMLIT_URL?.startsWith('https:')
    ? page.frameLocator('iframe').first() : page;
  await dashboard.getByText('Dashboard Overview', {exact: true}).waitFor({timeout: 60000});
  await dashboard.locator('[data-testid="stSidebar"]').getByText('Machine Simulator', {exact: true}).click();
  const machine = dashboard.frameLocator('iframe[title="backend.simulator_component.harvestshield_machine"]');
  await expect(machine.getByRole('button', {name: 'Finish run', exact: true})).toBeVisible();
  return {dashboard, machine};
}

test('embedded machine runs, preserves approved-only planning, bubbles and exports', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => {
    // Community Cloud telemetry can fail behind restricted egress. Keep checking
    // every application error; exclude only the identified platform tracker.
    const telemetry = e.message === 'Failed to fetch' &&
      /\/static\/js\//.test(e.stack ?? '') && /\.sendPendingEvents/.test(e.stack ?? '');
    if (!telemetry) errors.push(e.message);
  });
  const {machine} = await openMachine(page);
  await expect(machine.locator('canvas')).toBeVisible();
  await machine.getByRole('button', {name: 'Finish run', exact: true}).click();
  await expect(machine.locator('.run-status .badge')).toHaveText('COMPLETE');
  await machine.getByRole('tab', {name: 'Risk bubble', exact: true}).click();
  await expect(machine.getByTestId('neighbor-flag')).toHaveText('FLAGGED');
  await machine.getByRole('tab', {name: 'Warehouse Planner', exact: true}).click();
  await expect(machine.locator('table')).toContainText('DISPATCH');
  const waiting = page.waitForEvent('download');
  await machine.getByRole('button', {name: 'Export run', exact: true}).click();
  const run = JSON.parse(await readFile((await (await waiting).path())!, 'utf8'));
  expect(run.snapshot.plan.allocations.every((a: {itemId: string}) =>
    run.snapshot.items[a.itemId].marketability === 'APPROVED')).toBe(true);
  expect(errors).toEqual([]);
});

test('embedded photo uses the real Python checkpoint and supports multiple views', async ({page}) => {
  const {dashboard, machine} = await openMachine(page);
  await machine.getByRole('button', {name: 'Analyze photo', exact: true}).click();
  await machine.getByTestId('tomato-image-file').setInputFiles([
    'public/samples/red-tomato.jpg', 'public/samples/cracked-tomato.jpg',
  ]);
  await expect(machine.getByTestId('model-result-pending')).toContainText('Prediction ready', {timeout: 60000});
  await machine.getByRole('button', {name: 'Finish run', exact: true}).click();
  await expect(machine.getByTestId('actual-model-result')).toContainText('2 actual images');
  const waiting = page.waitForEvent('download');
  await machine.getByRole('button', {name: 'Download actual prediction'}).click();
  const evidence = JSON.parse(await readFile((await (await waiting).path())!, 'utf8'));
  expect(evidence.views).toHaveLength(2);
  expect(evidence.views.every((v: {sourceType: string}) => v.sourceType === 'REAL_TOMATO_MODEL')).toBe(true);
  expect(evidence.views.every((v: {checkpointSha256: string}) =>
    v.checkpointSha256 === 'ce41ffd3ea9fbf9c61c418446edc61e232dda9acd8742a1519f95a1ed0b8253d')).toBe(true);
  await expect(dashboard.locator('[data-testid="stException"]')).toHaveCount(0);
});

test('embedded original-planner comparison uses Python and dashboard pages remain available', async ({page}) => {
  const {dashboard, machine} = await openMachine(page);
  await machine.getByLabel('Scenario', {exact: true}).selectOption('Environmental risk comparison');
  await machine.getByRole('button', {name: 'Finish run', exact: true}).click();
  await expect(machine.locator('.run-status .badge')).toHaveText('COMPLETE');
  await machine.getByRole('tab', {name: 'Evidence & Validation', exact: true}).click();
  const waiting = page.waitForEvent('download');
  await machine.getByRole('button', {name: /original Python/i}).click();
  const comparison = JSON.parse(await readFile((await (await waiting).path())!, 'utf8'));
  expect(comparison.originalPython.source).toBe('UNCHANGED_PYTHON_V0.1');
  for (const name of ['Overview', 'Analyze Batch', 'Batch Intelligence', 'Resource Planner',
    'Capacity Simulator', 'How HarvestShield Works', 'Validation']) {
    await dashboard.locator('[data-testid="stSidebar"]').getByText(name, {exact: true}).click();
    await expect(dashboard.getByRole('radio', {name, exact: true})).toBeChecked();
    await expect(dashboard.locator('[data-testid="stException"]')).toHaveCount(0);
  }
});

test('workspace matches dashboard tokens, keeps state across tabs and fits mobile', async ({page}) => {
  const {dashboard, machine} = await openMachine(page);
  const theme = await dashboard.locator('.stApp').evaluate(el => ({
    bg: getComputedStyle(el).getPropertyValue('--bg').trim(),
    lime: getComputedStyle(el).getPropertyValue('--lime').trim(),
  }));
  const embeddedTheme = await machine.locator('html').evaluate(el => ({
    bg: getComputedStyle(el).getPropertyValue('--bg').trim(),
    lime: getComputedStyle(el).getPropertyValue('--lime').trim(),
  }));
  expect(embeddedTheme).toEqual(theme);
  await expect(machine.locator('body')).toHaveCSS('font-family', '"Source Sans Pro", "Source Sans 3", sans-serif');
  await expect(machine.locator('.brand')).toHaveCount(0);
  await expect(machine.locator('.metric').first()).toHaveCSS('border-radius', '20px');
  await expect(machine.locator('.metric strong').first()).toHaveCSS('color', 'rgb(167, 239, 78)');
  await expect(machine.getByRole('tab', {name: 'Simulation', exact: true})).toHaveAttribute('aria-selected', 'true');
  await machine.getByRole('tab', {name: 'Simulation', exact: true}).focus();
  await machine.getByRole('tab', {name: 'Simulation', exact: true}).press('ArrowRight');
  await expect(machine.getByRole('tab', {name: 'Crate Map', exact: true})).toHaveAttribute('aria-selected', 'true');
  await machine.getByRole('tab', {name: 'Crate Map', exact: true}).press('Home');
  await expect(machine.locator('[id="Warehouse Planner"]')).toBeHidden();
  await machine.getByRole('button', {name: 'Finish run', exact: true}).click();
  await expect(machine.locator('.run-status .badge')).toHaveText('COMPLETE');
  await machine.getByRole('tab', {name: 'Crate Map', exact: true}).click();
  await expect(machine.locator('[id="Crate Map"]')).toBeVisible();
  await expect(machine.locator('[id="Simulation"]')).toBeHidden();
  await machine.getByRole('tab', {name: 'Simulation', exact: true}).click();
  await expect(machine.locator('.run-status .badge')).toHaveText('COMPLETE');
  await page.setViewportSize({width: 390, height: 844});
  const overflow = await machine.locator('html').evaluate(el => el.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await expect(machine.getByRole('button', {name: 'Finish run', exact: true})).toBeVisible();
});
