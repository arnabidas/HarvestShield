import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {Engine} from '../../src/domain/engine';
import {hash} from '../../src/domain/queue';
test('3D factory, guided A2/B4 journey, planner and deterministic ledger download',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('visual-condition')).toHaveCount(0);
  await expect(page.getByLabel('Risk overlay',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'02 First imaging / layer map',exact:true}).click();
  await expect(page.getByLabel('Risk overlay',{exact:true})).toBeVisible();
  await expect(page.getByTestId('visual-condition')).toBeVisible();
  await page.getByRole('button',{name:'Overview',exact:true}).click();
  await mkdir('../docs/evidence',{recursive:true});await page.screenshot({path:'../docs/evidence/factory-overview.png',fullPage:true});
  await page.getByRole('button',{name:'Watch the Complete Machine'}).click();
  await page.getByLabel('Playback speed').selectOption('4');
  await expect(page.getByTestId('neighbor-flag')).toHaveText('FLAGGED',{timeout:60000});
  await page.getByRole('button',{name:'Ⅱ Pause'}).click();
  await expect(page.getByTestId('visual-condition')).toHaveText('GOOD');
  await expect(page.getByTestId('quality-route')).toHaveText('SECONDARY_SCREENING');
  await page.getByRole('button',{name:'02 First imaging / layer map',exact:true}).click();
  await page.getByRole('button',{name:'06 Original-crate risk overlay',exact:true}).click();
  await expect(page.locator('.scene-caption strong')).toHaveText('Original-crate risk overlay');
  await page.waitForTimeout(800);
  await page.screenshot({path:'../docs/evidence/a2-retroactive-bubble.png',fullPage:true});
  await page.getByRole('button',{name:'Finish run'}).click();
  await expect(page.locator('.run-status .badge')).toHaveText('COMPLETE');
  await page.getByRole('button',{name:'Warehouse Planner',exact:true}).click();
  await expect(page.locator('table')).toContainText('DISPATCH');
  await expect(page.locator('table')).toContainText('STORE');
  await page.screenshot({path:'../docs/evidence/approved-only-planner.png',fullPage:true});
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export run',exact:true}).click();const download=await downloadPromise;const path=await download.path();const saved=JSON.parse(await readFile(path!,'utf8'));
  expect(hash(new Engine(saved.scenario).runAll().events)).toBe(saved.eventHash);
  expect(saved.snapshot.plan.allocations.every((a:{itemId:string})=>saved.snapshot.items[a.itemId].marketability==='APPROVED')).toBe(true);
  expect(errors).toEqual([]);
});
test('2D fallback, fault hold, import validation and local restore',async({page})=>{
  await page.goto('/?fallback=1');await expect(page.getByText('ACCESSIBLE 2D MACHINE FLOW')).toBeVisible();
  await page.getByLabel('Scenario',{exact:true}).selectOption('Tracking loss');await page.getByRole('button',{name:'Finish run'}).click();await expect(page.locator('.run-status .badge')).toHaveText('COMPLETE');
  await page.getByRole('button',{name:'Warehouse Planner',exact:true}).click();await expect(page.locator('table tbody tr')).toHaveCount(0);
  await page.getByRole('button',{name:'Quality Decisions',exact:true}).click();await expect(page.locator('.alert').filter({hasText:'IDENTITY_LOST'})).toBeVisible();
  await page.getByRole('button',{name:'Save run locally'}).click();await expect(page.getByRole('status')).toContainText('saved locally');
  await page.reload();await page.getByRole('button',{name:'Restore saved run'}).click();await expect(page.locator('.run-status .badge')).toHaveText('COMPLETE');await expect(page.locator('.page-head')).toContainText('Tracking loss');
  await page.locator('.scenario-panel input[type=file]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":"1.0","seed":-1}')});await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.page-head')).toContainText('Tracking loss');
  await page.screenshot({path:'../docs/evidence/fail-closed-fallback.png',fullPage:true});
});
test('multi-commodity lanes and responsive controls',async({page})=>{
  await page.goto('/?fallback=1');await page.getByLabel('Scenario',{exact:true}).selectOption('Multi-commodity · 20 lanes');await page.getByRole('button',{name:'Finish run'}).click();await expect(page.locator('.run-status .badge')).toHaveText('COMPLETE');
  await page.getByRole('button',{name:'Batches & Lanes',exact:true}).click();await expect(page.locator('.lane-grid>div')).toHaveCount(20);await expect(page.locator('.cards').filter({hasText:'apple'})).toBeVisible();await expect(page.locator('.cards').filter({hasText:'potato'})).toBeVisible();await page.screenshot({path:'../docs/evidence/twenty-lane-multi-commodity.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Simulation',exact:true}).click();await expect(page.getByRole('button',{name:'Step event →'})).toBeVisible();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);expect(overflow).toBe(false);await page.screenshot({path:'../docs/evidence/mobile-fallback.png',fullPage:true});
});
test('unavailable WebGL automatically selects 2D without external network',async({page})=>{
  await page.addInitScript("HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {apply(target, self, args) { return ['webgl', 'webgl2'].includes(args[0]) ? null : Reflect.apply(target, self, args); }});");
  await page.route('https://**/*',route=>route.abort());
  await page.goto('/');await expect(page.getByText('ACCESSIBLE 2D MACHINE FLOW')).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);await page.getByRole('button',{name:'Finish run'}).click();await expect(page.locator('.run-status .badge')).toHaveText('COMPLETE');await page.getByRole('button',{name:'02 First imaging / layer map',exact:true}).click();await expect(page.getByTestId('visual-condition')).toHaveText('GOOD');
});
test('WebGL context loss preserves authoritative run in 2D',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Crate gate',exact:true}).click();await expect(page.locator('.run-status strong')).not.toContainText('0.0');const before=await page.locator('.run-status strong').innerText();await page.locator('canvas').evaluate(canvas=>{(canvas as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();});await expect(page.getByText('ACCESSIBLE 2D MACHINE FLOW')).toBeVisible();expect(await page.locator('.run-status strong').innerText()).toBe(before);expect(errors).toEqual([]);
});
