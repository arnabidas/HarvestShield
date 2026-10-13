import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

test('file drop starts the machine and reveals the real model result only at output',async({page,request})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const bytes=await readFile('public/samples/red-tomato.jpg');
  const response=await request.post('/api/inference/tomato',{data:{sourceItemId:'UPLOAD-C01-L01-I01',commodity:'tomato',mimeType:'image/jpeg',imageBase64:bytes.toString('base64')}});
  expect(response.ok()).toBe(true);const actual=await response.json();
  await page.goto('/');
  const transfer=await page.evaluateHandle(base64=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const data=new DataTransfer();data.items.add(new File([bytes],'judge-tomato.jpg',{type:'image/jpeg'}));return data;},bytes.toString('base64'));
  await page.locator('.scene').dispatchEvent('drop',{dataTransfer:transfer});
  await expect(page.getByRole('button',{name:'Ⅱ Pause'})).toBeVisible();
  await expect(page.getByTestId('machine-model-output')).toHaveCount(0);
  await expect(page.getByTestId('model-result-pending')).toContainText('Prediction ready',{timeout:15000});
  await page.getByLabel('Playback speed').selectOption('4');
  await expect(page.getByTestId('machine-model-output')).toContainText(actual.sourceLabel,{timeout:20000});
  await expect(page.getByTestId('machine-model-output')).toContainText(`${(actual.confidence*100).toFixed(2)}%`);
  await expect(page.getByTestId('actual-model-result')).toContainText(actual.modelVersion);
  await expect(page.getByTestId('actual-model-result')).toContainText(actual.imageSha256.slice(0,16));
  await page.locator('.workspace').screenshot({path:'../docs/evidence/real-upload-output.png'});
  expect(errors).toEqual([]);
});

test('sample drag uses actual inference and an offline service never returns a fixture result',async({page})=>{
  await page.goto('/?fallback=1');
  await page.getByRole('button',{name:'Red tomato Drag or click to run'}).dragTo(page.getByTestId('tomato-dropzone'));
  await expect(page.getByRole('button',{name:'Ⅱ Pause'})).toBeVisible();
  await expect(page.getByTestId('model-result-pending')).toContainText('Prediction ready',{timeout:15000});
  await page.getByRole('button',{name:'Finish run',exact:true}).click();
  await expect(page.getByTestId('machine-model-output')).toBeVisible();
  await page.getByRole('button',{name:'Return to full crate demo'}).click();
  await page.route('**/api/inference/tomato',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test service offline'})}));
  await page.getByTestId('tomato-image-file').setInputFiles(resolve('public/samples/red-tomato.jpg'));
  await expect(page.getByText('No prediction has been substituted.')).toBeVisible();
  await expect(page.getByTestId('machine-model-output')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Finish run',exact:true})).toBeDisabled();
});

test('spatial map and bubble tabs show animated recorded geometry and pause with the virtual clock',async({page})=>{
  await page.goto('/?fallback=1');await page.getByRole('tab',{name:'Spatial map',exact:true}).click();
  await expect(page.getByRole('img',{name:'Animated original position map, layer 1'})).toBeVisible();
  await page.getByRole('button',{name:'▶ Play',exact:true}).click();await page.waitForTimeout(900);
  await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();await page.waitForTimeout(100);
  const paused=await page.locator('.spatial-canvas').innerHTML();await page.waitForTimeout(300);expect(await page.locator('.spatial-canvas').innerHTML()).toBe(paused);
  await page.getByRole('button',{name:'Replay bubble discovery',exact:true}).click();await page.getByRole('tab',{name:'Risk bubble',exact:true}).click();
  const emerging=await page.locator('.spatial-canvas').innerHTML();await page.getByRole('button',{name:'▶ Play',exact:true}).click();await page.waitForTimeout(500);await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();expect(await page.locator('.spatial-canvas').innerHTML()).not.toBe(emerging);
  await page.getByRole('button',{name:'Finish run',exact:true}).click();await page.getByRole('tab',{name:'Risk bubble',exact:true}).click();
  await expect(page.getByRole('img',{name:'Animated neighbor influence field, layer 1'})).toBeVisible();
  await expect(page.locator('.bubble-source')).toHaveCount(2);await expect(page.getByTestId('neighbor-flag')).toHaveText('FLAGGED');
  await page.locator('.workspace').screenshot({path:'../docs/evidence/animated-spatial-bubble-panel.png'});
  await page.getByRole('tab',{name:'Spatial map',exact:true}).click();await page.locator('.workspace').screenshot({path:'../docs/evidence/animated-spatial-map-panel.png'});
});
