import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const directory='reports/flight-results-'+new Date().toISOString().replace(/[:.]/g,'-');
await mkdir(directory,{recursive:true});
const result={status:'FAIL',method:'Direct Playwright; no AI decisions',route:'DEL-DIB',departure:'2026-11-19',return:'2026-11-21',checks:[]};
let page;
const browser=await chromium.launch({channel:'msedge',headless:false});
try {
 page=await browser.newPage(); page.setDefaultTimeout(10000);
 await page.goto('https://phptravels.net',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'I Understand & Continue',exact:true}).click();
 await page.getByRole('button',{name:'Round Trip',exact:true}).click();
 for(const [side,query,code] of [['from','Delhi','DEL'],['to','Dibrugarh','DIB']]) {
  await page.locator('#fl_'+side+'_trigger').click();
  await page.locator('#fl_'+side+'_q').fill(query);
  await page.locator('#fl_'+side+'_panel').getByText(code,{exact:true}).filter({visible:true}).click();
  await expect(page.locator('#fl_'+side+'_trigger')).toContainText(code);
  console.log('Selected',code);
 }
 await page.locator('#flights_departure_date').click();
 await expect(page.getByRole('columnheader',{name:'November 2026',exact:true}).filter({visible:true})).toBeVisible();
 await page.getByRole('cell',{name:'19',exact:true}).filter({visible:true}).click();
 await page.waitForTimeout(800);
 // The range picker automatically advances to the return date after departure selection.
 await expect(page.getByRole('columnheader',{name:'November 2026',exact:true}).filter({visible:true})).toBeVisible();
 await page.getByRole('cell',{name:'21',exact:true}).filter({visible:true}).click();
 await expect(page.locator('#flights_departure_date')).toHaveValue('Nov 19, 2026');
 await expect(page.locator('#flights_return_date')).toHaveValue('Nov 21, 2026');
 result.checks.push('Selected DEL and DIB; verified November 19 and 21 dates');
 console.log('Route and dates verified; submitting Search Flights');
 await page.getByRole('button',{name:'Search Flights',exact:true}).click();
 await expect(page).toHaveURL('https://phptravels.net/flights/del/dib/roundtrip/economy/19-11-2026/21-11-2026/1/0/0',{timeout:45000});
 result.url=page.url();
 result.checks.push('Flight results URL opened');
 const main=page.getByRole('main');
 await expect(main.getByRole('button',{name:'flight_takeoff Book Now',exact:true}).first()).toBeVisible({timeout:45000});
 for(const text of ['DEL','DIB','19-11-2026','21-11-2026']) await expect(main).toContainText(text);
 await expect(page.locator('#flights_departure_date')).toHaveValue('Nov 19, 2026');
 await expect(page.locator('#flights_return_date')).toHaveValue('Nov 21, 2026');
 result.visibleFlightCards=await main.getByRole('button',{name:'flight_takeoff Book Now',exact:true}).count();
 result.checks.push('Flight cards visible with DEL, DIB, outbound and return dates; no booking clicked');
 const snapshot=await page.locator('body').ariaSnapshot();
 await writeFile(directory+'/snapshot.txt',snapshot);
 console.log('Results URL:',page.url());
 console.log('Visible flight cards:',result.visibleFlightCards);
 result.status='PASS';
} catch(error){result.reason=error.message;process.exitCode=1;console.log('Check failed:',error.message);}
finally {
 if(page){result.url=page.url();await page.screenshot({path:directory+'/final.png',fullPage:true}).catch(()=>{});}
 await writeFile(directory+'/report.json',JSON.stringify(result,null,2));
 await browser.close();console.log('Report:',directory);
}
