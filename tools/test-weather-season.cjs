const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=require('../weather-season.js');
const day=s=>new Date(s+'T12:00:00');
test('seasons fall on the right dates and can be previewed',()=>{
 assert.equal(api.seasonFor(day('2026-10-23')),null);assert.equal(api.seasonFor(day('2026-10-24')),'halloween');assert.equal(api.seasonFor(day('2026-10-31')),'halloween');
 assert.equal(api.seasonFor(day('2026-11-03')),null);assert.equal(api.seasonFor(day('2026-11-05')),'bonfire');assert.equal(api.seasonFor(day('2026-11-07')),null);
 assert.equal(api.seasonFor(day('2026-12-01')),'christmas');assert.equal(api.seasonFor(day('2027-01-05')),'christmas');assert.equal(api.seasonFor(day('2027-01-06')),null);
 assert.equal(api.seasonFor(day('2026-06-01'),'bonfire'),'bonfire');assert.equal(api.seasonFor(day('2026-12-25'),'none'),null);assert.equal(api.seasonFor(day('2026-06-01'),'bogus'),null);
});
test('weather codes map to icons and screen effects',()=>{
 assert.deepEqual(api.weatherInfo(0,1),{icon:'sun',label:'Clear',effect:null,amount:0});
 assert.equal(api.weatherInfo(0,0).icon,'night');assert.equal(api.weatherInfo(3,1).icon,'cloud');assert.equal(api.weatherInfo(45,1).icon,'fog');
 assert.equal(api.weatherInfo(53,1).effect,'rain');assert.equal(api.weatherInfo(65,1).label,'Heavy rain');assert.equal(api.weatherInfo(65,1).amount,1);
 assert.equal(api.weatherInfo(73,1).effect,'snow');assert.equal(api.weatherInfo(81,1).effect,'rain');assert.equal(api.weatherInfo(86,1).effect,'snow');assert.equal(api.weatherInfo(95,1).effect,'thunder');
});
test('quips give the most useful warning first',()=>{
 assert.match(api.quipFor({code:95,isDay:1,wind:40,min:0,max:5}),/Thunder/);
 assert.match(api.quipFor({code:63,isDay:1,wind:5,min:8,max:12}),/waterproofs/);
 assert.match(api.quipFor({code:2,isDay:1,wind:35,min:8,max:12}),/ladders/);
 assert.match(api.quipFor({code:0,isDay:1,wind:5,min:-2,max:4}),/De-ice/);
 assert.match(api.quipFor({code:0,isDay:1,wind:5,min:14,max:27}),/suncream/);
 assert.match(api.quipFor({code:3,isDay:1,wind:5,min:8,max:12,rainChance:70}),/rain is on the way/);
 assert.equal(api.quipFor({code:3,isDay:1,wind:5,min:8,max:12,rainChance:10}),'Grey but dry.');
});
test('forecast request rounds the location and the reply is read safely',()=>{
 const url=api.forecastUrl(53.80076,-1.54908);assert.match(url,/latitude=53\.80&longitude=-1\.55/);assert.match(url,/wind_speed_unit=mph/);
 assert.match(api.townUrl('Stoke on Trent'),/name=Stoke%20on%20Trent/);
 assert.deepEqual(api.parseForecast({current:{temperature_2m:11.6,weather_code:61,wind_speed_10m:12.4,is_day:1},daily:{temperature_2m_max:[13.2],temperature_2m_min:[7.5],precipitation_probability_max:[80]}}),{code:61,isDay:1,temp:12,wind:12,max:13,min:8,rainChance:80});
 assert.equal(api.parseForecast({current:{temperature_2m:5,weather_code:0},daily:{}}).rainChance,null);
 assert.throws(()=>api.parseForecast({}));
});
test('only Jak Stewart sees it, and only in the pixel themes',()=>{
 assert.ok(api.shownFor('arcade','Jak Stewart'));assert.ok(api.shownFor('pacman','Jak Stewart'));
 assert.ok(!api.shownFor('pacman','Cody Slack'));assert.ok(!api.shownFor('pacman',null));assert.ok(!api.shownFor('forest','Jak Stewart'));
});
test('it is loaded by the app and cached offline',()=>{
 const template=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
 assert.match(template,/weather-season\.js\?v=77/);assert.match(template,/weather-season\.css\?v=77/);
 const sw=fs.readFileSync('sw.js','utf8');for(const f of ['weather-season.js?v=77','weather-season.css?v=77'])assert.ok(sw.includes(f),f);
});
