const {test}=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('../receipt-ocr.js');
test('UK date and final total take precedence over subtotal, VAT, tendered cash and change',()=>{
 const r=parse('TEST SHOP\nDate: 09/10/2026 18:45\nSubtotal 15.21\nVAT 3.04\nTOTAL £18.25\nCash £20.00\nChange £1.75');
 assert.equal(r.date,'2026-10-09');assert.equal(r.amount,'18.25');
});
test('reads ISO, UK two-digit year and month name dates; rejects invalid calendar dates',()=>{
 for(const date of ['2026-10-09','09-10-26','9 Oct 2026','09.10.2026'])assert.equal(parse('Date '+date+'\nTotal GBP 1,234.56').date,'2026-10-09');
 assert.equal(parse('Date 31/02/2026').date,'');assert.equal(parse('Date 29/02/2024').date,'2024-02-29');
 assert.equal(parse('Date 09/10/2026\nTotal GBP 1,234.56').amount,'1234.56');
});
test('handles totals on the next line and VAT-inclusive total labels',()=>{
 assert.equal(parse('TOTAL\n£8.50\nVAT £1.42').amount,'8.50');
 assert.equal(parse('Subtotal £7.08\nTOTAL INCLUDING VAT £8.50').amount,'8.50');
 assert.equal(parse('Amount paid £8.50\nCash tendered £10.00').amount,'8.50');
});
test('ambiguous unlabelled prices and unreadable receipts require manual review',()=>{
 assert.equal(parse('Bread £1.50\nMilk £2.50').amount,'');
 assert.equal(parse('Date 09.10.2026').amount,'');assert.equal(parse('Date 09/10/2026').amount,'');
 assert.equal(parse('').date,'');assert.equal(parse('').amount,'');
});
