(function(root){
'use strict';
const fields=['date','jobNumber','vehicleReg','driverName','startTime','timeOnSite','timeOffSite','endTime','food','hol','id','widgetCaptureId','widgetTimestamps','watchTimestamps'];
function validate(op){
 if(!op||typeof op.id!=='string'||typeof op.entryId!=='string'||['__proto__','constructor','prototype'].includes(op.entryId)||!/^[-\w]{1,80}$/.test(op.id)||!/^[-\w]{1,80}$/.test(op.entryId)||!['patch','delete'].includes(op.kind))throw Error('Invalid operation');
 if(op.kind==='delete')return {id:op.id,entryId:op.entryId,kind:'delete'};
 if(!op.changes||typeof op.changes!=='object'||Array.isArray(op.changes))throw Error('Invalid changes');
 const changes={};
 for(const [key,value] of Object.entries(op.changes)){
  if(!fields.includes(key))throw Error('Unsupported field');
  if(['food','hol'].includes(key)){if(typeof value!=='boolean')throw Error('Invalid flag');}
  else if(key==='id'){if(!Number.isSafeInteger(value)||value<1)throw Error('Invalid entry ID');}
  else if(['widgetTimestamps','watchTimestamps'].includes(key)){
   if(!Array.isArray(value)||value.length>4||value.some(t=>!Number.isSafeInteger(t.epochMillis)||t.epochMillis<946684800000||t.epochMillis>4102444800000||!Number.isInteger(t.offsetSeconds)||Math.abs(t.offsetSeconds)>64800))throw Error('Invalid timestamps');
  }else if(typeof value!=='string'||value.length>120)throw Error('Invalid text');
  if(key==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value))throw Error('Invalid date');
  if(['startTime','timeOnSite','timeOffSite','endTime'].includes(key)&&value!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('Invalid time');
  changes[key]=value;
 }
 return {id:op.id,entryId:op.entryId,kind:'patch',changes};
}
function apply(rows,op){
 const previous=rows[op.entryId]||{};
 if(op.kind==='delete')rows[op.entryId]={deleted:true};
 else if(!previous.deleted)rows[op.entryId]={...previous,...op.changes};
 return rows;
}
function diff(old,current){const changes={};for(const key of fields){if(key in current&&JSON.stringify(old?.[key])!==JSON.stringify(current[key]))changes[key]=current[key];}return changes;}
const api={fields,validate,apply,diff};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MDSWatchCore=api;
})(typeof window==='undefined'?globalThis:window);
