// The blank forms and icons are stored as base64 inside index.html. A find-and-replace over the whole file
// (such as a version bump) can quietly change a few letters inside them, which shows up as smudges and
// coloured streaks on exported PDFs. These checks catch that.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const template=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('the blank timesheet, holiday and van check forms are exactly as uploaded',()=>{
 const expected={
  PDF_TEMPLATE:'725becc8efba2c5155065454e01fbeb43b83e745ee4ecd50a6b546ccb90c5dc2',
  HOLIDAY_PDF_TEMPLATE:'3f37693e5df7729e2d00e5be9d3145b7b5752374aa9e41b9890f62ec3b18679b',
  VAN_PDF_TEMPLATE:'7c696f53d046950ec706d732f4a5412891eaaf0775a49fe9fb3afc897835a5d4',
 };
 for(const [name,hash] of Object.entries(expected)){
  const b64=template.match(new RegExp('const '+name+"\\s*=\\s*'([A-Za-z0-9+/=]+)'"))[1];
  assert.equal(sha(Buffer.from(b64,'base64')),hash,name+' has been changed');
 }
});

test('every built-in PNG icon is undamaged',()=>{
 const pngs=[...template.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]{100,})/g)].map(m=>Buffer.from(m[1],'base64'));
 assert.ok(pngs.length>=4);
 for(const png of pngs){
  let p=8;
  while(p<png.length){
   const len=png.readUInt32BE(p),chunk=png.subarray(p+4,p+8+len);
   assert.equal(zlib.crc32(chunk),png.readUInt32BE(p+8+len),'damaged '+chunk.subarray(0,4)+' chunk');
   p+=12+len;
  }
 }
});
