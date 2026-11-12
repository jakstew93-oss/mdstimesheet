const {test}=require('node:test');
const assert=require('node:assert/strict');
const pay=require('../pay-estimate.js');
// The app's break schedule: whole hours worked in the day -> minutes deducted.
const TABLE={7:20,8:20,9:30,10:45,11:45,12:45,13:60,14:60,15:60,16:75,17:75,18:90,19:105};
const breakFor=mins=>{let d=0;for(let k=7;k<=19;k++)if(Math.floor(mins/60)>=k)d=TABLE[k];return d};
const day=(date,startTime,endTime,extra={})=>({date,startTime,endTime,...extra});
// Week ending Sunday 15 November 2026.
const WEEK=[day('2026-11-09','07:00','16:00'),day('2026-11-10','07:00','16:00'),day('2026-11-11','07:00','16:00'),day('2026-11-12','07:00','16:00'),day('2026-11-13','07:00','16:00')];

test('weekdays are paid at the hourly rate on hours after breaks',()=>{
 const e=pay.estimate(WEEK,{},breakFor);
 assert.equal(e.weekMins,5*(540-30));
 assert.equal(e.weekPay,722.5);
 assert.equal(e.gross,722.5);
});
test('tax, National Insurance and pension follow the weekly 2026/27 rules',()=>{
 const e=pay.estimate(WEEK,{},breakFor);
 assert.equal(e.pension,30.13);                    // 5% of 722.50 - 120
 assert.equal(e.tax,90);                           // 20% of floor(722.50 - 30.13 - 241.90) = 450
 assert.equal(e.ni,38.44);                         // 8% of 722.50 - 242
 assert.equal(e.takeHome,563.93);
});
test('Saturday is time and a half and breaks come off that day too',()=>{
 const e=pay.estimate([day('2026-11-14','08:00','13:00')],{},breakFor);
 assert.equal(e.satMins,300);
 assert.equal(e.satPay,127.5);
 assert.equal(e.weekPay,0);
});
test('Sunday uses its own rate',()=>{
 assert.equal(pay.estimate([day('2026-11-15','08:00','12:00')],{sunX:2},breakFor).sunPay,136);
});
test('two jobs in a day share one break deduction',()=>{
 const e=pay.estimate([day('2026-11-09','07:00','11:00'),day('2026-11-09','12:00','16:00')],{},breakFor);
 assert.equal(e.weekMins,480-20);
});
test('a shift past midnight is paid against the day it started',()=>{
 const e=pay.estimate([day('2026-11-13','20:00','02:00')],{},breakFor);
 assert.equal(e.weekMins,360);assert.equal(e.satMins,0);
});
test('each day with a food allowance tick is one £20 night away, paid on top untaxed',()=>{
 const entries=[...WEEK.slice(0,3),day('2026-11-12','07:00','11:00',{food:true}),day('2026-11-12','12:00','16:00',{food:true}),{...WEEK[4],food:true}];
 const e=pay.estimate(entries,{},breakFor);
 assert.equal(e.nights,2);assert.equal(e.nightPay,40);
 const plain=pay.estimate(entries.map(x=>({...x,food:false})),{},breakFor);
 assert.equal(e.tax,plain.tax);assert.equal(e.ni,plain.ni);
 assert.equal(e.takeHome,Math.round((plain.takeHome+40)*100)/100);
});
test('nights away can be set as taxed instead',()=>{
 const e=pay.estimate([{...WEEK[0],food:true}],{nightTaxed:true},breakFor);
 assert.equal(e.gross,144.5+20);assert.equal(e.untaxed,0);
});
test('a holiday day with no times is paid the set hours',()=>{
 const e=pay.estimate([{date:'2026-11-09',hol:true}],{},breakFor);
 assert.equal(e.holidayDays,1);assert.equal(e.holidayPay,136);
});
test('tax codes: allowance, K codes, flat-rate codes and the higher rate',()=>{
 assert.equal(pay.weeklyTax(241,'1257L'),0);
 assert.equal(pay.weeklyTax(342,'1257L'),20);
 assert.equal(pay.weeklyTax(100,'BR'),20);
 assert.equal(pay.weeklyTax(100,'0T'),20);
 assert.equal(pay.weeklyTax(100,'NT'),0);
 assert.equal(pay.weeklyTax(100,'K100'),23.8);   // 100 + 1000/52 = 119.23 -> 119 taxed
 assert.equal(pay.weeklyTax(1242,'1257L'),255);  // 725 at 20% + 275 at 40%
 assert.equal(pay.weeklyTax(342,'S1257L W1'),20);
 assert.equal(pay.readCode('nonsense'),null);
});
test('National Insurance is 8% between £242 and £967 and 2% above',()=>{
 assert.equal(pay.weeklyNI(242),0);
 assert.equal(pay.weeklyNI(342),8);
 assert.equal(pay.weeklyNI(1067),60);
});
test('pension can be on all pay, and can come off after tax',()=>{
 assert.equal(pay.weeklyPension(700,{pensionPct:5,pensionBasis:'all'}),35);
 assert.equal(pay.weeklyPension(100,{pensionPct:5,pensionBasis:'qualifying'}),0);
 const before=pay.estimate(WEEK,{pensionBeforeTax:true},breakFor),after=pay.estimate(WEEK,{pensionBeforeTax:false},breakFor);
 assert.equal(after.tax,96);assert.ok(after.takeHome<before.takeHome);
});
test('bad saved settings fall back to the defaults',()=>{
 const s=pay.clean({rate:'abc',taxCode:'??',pensionPct:-3,satX:2});
 assert.equal(s.rate,17);assert.equal(s.taxCode,'1257L');assert.equal(s.pensionPct,5);assert.equal(s.satX,2);
});
test('Jak, Martyn and Oliver each get the pay estimate with their own settings',()=>{
 const {ALLOWED_USERS,settingsKey}=require('../pay-estimate.js');
 assert.deepEqual(ALLOWED_USERS,['Jak Stewart','Martyn Evans','Oliver Spicer']);
 assert.equal(settingsKey('Jak Stewart'),'mds_pay_settings_v1','Jak keeps the settings he already saved');
 assert.equal(settingsKey('Martyn Evans'),'mds_pay_settings_v1:Martyn Evans');
 assert.notEqual(settingsKey('Oliver Spicer'),settingsKey('Martyn Evans'));
});
