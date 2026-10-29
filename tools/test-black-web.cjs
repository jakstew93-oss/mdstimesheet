const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('the Black Web is in the secret arcade and cached for offline play',()=>{
 const launcher=fs.readFileSync('spark-town-launcher.js','utf8');
 assert.match(launcher,/name:'The Black Web'[^}]*path:'black-web\.html\?v=3'/);
 assert.ok(fs.readFileSync('sw.js','utf8').includes("'./black-web.html?v=3'"));
});

test('it has the browser, the VPN, the cookie banner and the shop',()=>{
 const page=fs.readFileSync('black-web.html','utf8');
 for(const part of ['ShadowFox Ultra 3000','Connect VPN','THE BLACK WEB','We value your privacy','Reject all','Manage preferences','Left kidney','evri','I am not the police','Mum ❤️','CYBER POLICE','Chat with Steve','Download more RAM','Customers also bought','how to delete search history ON PHONE','Amateur. You want the BLACK web.','Your badges','dialUp','free valuation','Live auction','Boss button','has stopped working','Vantablack Web','Certificate of Survival','Share with the lads'])assert.ok(page.includes(part),part);
 assert.ok(page.includes('Nothing on this site is real'),'says it is a joke');
});
