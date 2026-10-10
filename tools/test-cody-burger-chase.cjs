const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=require('../cody-burger-chase.js');
const maze=api.parseMaze(api.MAZE);
test('maze is rectangular and every chip, big burger and the salad exit can be reached by Cody',()=>{
 assert.equal(maze.w,19);assert.equal(maze.h,21);assert.equal(maze.house.length,3);assert.equal(maze.burgers.size,4);
 const seen=api.reachable(maze,maze.player);
 for(const k of [...maze.chips,...maze.burgers])assert.ok(seen.has(k),'unreachable '+k);
 assert.ok(seen.has(maze.exit.x+','+maze.exit.y));
 assert.ok(!seen.has(maze.house[0].x+','+maze.house[0].y),'Cody must not get into the salad house');
});
test('the tunnel wraps from one side to the other',()=>{
 assert.ok(!api.isWall(maze,-1,9));assert.ok(!api.isWall(maze,19,9));assert.ok(api.openDirs(maze,0,9).includes('left'));
});
test('salads never turn back unless stuck and steer toward their target',()=>{
 assert.equal(api.chooseDir(maze,4,3,'right',{x:4,y:20}),'down');
 assert.notEqual(api.chooseDir(maze,4,3,'right',{x:0,y:3}),'left');
 assert.equal(api.chooseDir(maze,1,1,'up',{x:9,y:9}),'right');
 const random=api.chooseDir(maze,4,3,'right',null,()=>0.99);assert.ok(['right','down','up'].includes(random));
});
test('modes cycle scatter and chase and levels get quicker up to a cap',()=>{
 assert.equal(api.modeAt(0),'scatter');assert.equal(api.modeAt(8),'chase');assert.equal(api.modeAt(28),'scatter');assert.equal(api.modeAt(500),'chase');
 assert.ok(api.levelSettings(3).saladSpeed>api.levelSettings(1).saladSpeed);
 assert.deepEqual(api.levelSettings(40),api.levelSettings(80));assert.equal(api.levelSettings(40).powerTime,2.5);
});
test('the game is in the arcade picker and cached for offline play',()=>{
 assert.match(fs.readFileSync('spark-town-launcher.js','utf8'),/cody-burger-chase\.html\?v=74/);
 for(const file of ['index.html','Index.html'])assert.match(fs.readFileSync(file,'utf8'),/spark-town-launcher\.js\?v=74/);
 const sw=fs.readFileSync('sw.js','utf8');for(const f of ['cody-burger-chase.html?v=74','cody-burger-chase.js?v=74','spark-town-launcher.js?v=74'])assert.ok(sw.includes(f),f);
 assert.match(fs.readFileSync('cody-burger-chase.html','utf8'),/cody-burger-chase\.js\?v=74/);
});
