(function(root){
 'use strict';
 const timeFields=['startTime','timeOnSite','timeOffSite','endTime'];
 function dateISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
 function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(new Date(value+'T12:00:00').getTime())&&dateISO(new Date(value+'T12:00:00'))===value}
 function weekFor(date){if(!validDate(date))return null;const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+(7-d.getDay())%7);return dateISO(d)}
 function nextWeek(week){const d=new Date(week+'T12:00:00');d.setDate(d.getDate()+7);return dateISO(d)}
 function withinWeek(date,week){if(!validDate(date)||!validDate(week))return false;const start=new Date(week+'T12:00:00');start.setDate(start.getDate()-6);return date>=dateISO(start)&&date<=week}
 function migrate(entries,selected){
  const data={version:1,weeks:{}};
  for(const e of entries){const week=withinWeek(e.date,selected)?selected:(weekFor(e.date)||selected);const bucket=data.weeks[week]||(data.weeks[week]={entries:[],archived:week<selected});bucket.entries.push(e)}
  return data;
 }
 function checkEntries(entries,week){
  const problems=[];const seen=new Map();
  entries.forEach((e,i)=>{
   const label=(e.date||'No date')+' · '+(e.jobNumber?'Job '+e.jobNumber:'Entry '+(i+1));
   const add=message=>problems.push({id:e.id,label,message});
   if(!withinWeek(e.date,week))add('Date is outside the selected week.');
   if(!e.hol){
    if(!String(e.jobNumber||'').trim())add('Missing job number.');
    const missing=timeFields.filter(k=>!e[k]);
    if(missing.length)add('Missing '+missing.map(k=>({startTime:'start',timeOnSite:'on-site',timeOffSite:'off-site',endTime:'finish'})[k]).join(', ')+' time.');
    if(timeFields.some(k=>e[k]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(e[k])))add('Invalid time.');
    if(!missing.length&&timeFields.every(k=>/^([01]\d|2[0-3]):[0-5]\d$/.test(e[k]))){
     const minutes=timeFields.map(k=>Number(e[k].slice(0,2))*60+Number(e[k].slice(3)));
     let previous=minutes[0],offset=0;
     for(let n=1;n<minutes.length;n++){let value=minutes[n]+offset;if(value<previous){offset+=1440;value+=1440}previous=value}
     if(previous-minutes[0]>=1440||previous===minutes[0])add('Check the order of the four times.');
    }
   }
   const key=JSON.stringify([e.date,e.jobNumber||'',e.vehicleReg||'',e.driverName||'',...timeFields.map(k=>e[k]||''),!!e.hol]);
   if(seen.has(key))add('Possible duplicate of another entry.');else seen.set(key,e.id);
  });
  return problems;
 }
 function restoreDeleted(data,items){for(const {week,entry} of items){const bucket=data.weeks[week]||(data.weeks[week]={entries:[],archived:false});if(!bucket.entries.some(e=>e.id===entry.id))bucket.entries.push(entry);bucket.entries.sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.startTime||'').localeCompare(b.startTime||''))}return data}
 const api={timeFields,dateISO,validDate,weekFor,nextWeek,withinWeek,migrate,checkEntries,restoreDeleted};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MDSTools=api;
})(typeof window==='undefined'?globalThis:window);
