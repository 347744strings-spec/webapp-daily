(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PayCheck=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function num(v,min,max,name){if(v===''||v===null||typeof v==='boolean'||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error(name+' 입력 범위를 확인해 주세요.');return Number(v)}
function calculate(i,r,s={},q={}){
 const h=num(i.weeklyHours,0,80,'주 시간'),w=num(i.hourlyWage,1,1000000,'시급'),year=num(i.baseYear,2026,2027,'연도'),floor=r.minimumWage[year];if(!floor)throw Error('지원 연도를 확인해 주세요.');
 const mode=i.wageMode;if(!['base','inclusive','unknown'].includes(mode))throw Error('시급 표기를 확인해 주세요.');
 const eligible=h>=r.weeklyThreshold&&i.attendance!=='no'&&i.continuity!=='no';
 const conditional=eligible&&(i.attendance!=='yes'||i.continuity!=='yes');
 const canReverse=mode==='inclusive'&&h>=15&&h<=40&&eligible;
 const unsupported=mode==='unknown'||(mode==='inclusive'&&!canReverse);
 const base=canReverse?w/r.inclusiveDivisor:w;
 const hh=eligible?Math.min(h/r.standardHours*r.holidayCap,r.holidayCap):0;
 const hp=hh*base,weekly=h*base+hp,minWeekly=(h+hh)*floor;
 const multiplier=num(s.weeksPerMonth??r.weeksPerMonth,1,5,'환산 주수');
 const monthly=s.monthMode==='209'&&h===40?base*209:weekly*multiplier;
 const minimumMonthly=s.monthMode==='209'&&h===40?floor*209:minWeekly*multiplier;
 let premium=0;if(i.workplaceSize==='fivePlus'&&i.premiumEnabled){const n=num(i.nightHours??0,0,80,'야간 시간'),o=num(i.extraHours??0,0,40,'추가 시간');premium=base*(n*.5+o*1.5)}
 const expectedMonthly=monthly+premium*multiplier,reference=Math.max(monthly,minimumMonthly)+premium*multiplier;
 let received=null;if(i.receivedAmount!==''&&i.receivedAmount!=null)received=num(i.receivedAmount,0,100000000,'받은 금액');
 const comparable=received!==null&&i.receivedKind==='gross'&&!unsupported;
 const rawDifference=comparable?reference-received:null;const difference=rawDifference!==null&&Math.abs(rawDifference)<1e-7?0:rawDifference;
 const below=base<floor&&!unsupported;let verdict='needCheck';
 if(!unsupported&&(below||(comparable&&difference>.0001)))verdict='shortfallLikely';
 else if(!unsupported&&!conditional&&q.q2_itemized==='yes'&&q.q3_meetsFloor==='yes'&&((mode==='inclusive'&&q.q1_inclusiveMention==='yes')||(mode==='base'&&q.q1_inclusiveMention==='no'))&&(received===null||(comparable&&difference<=.0001)))verdict='okLikely';
 return {h,w,year,floor,base,hh,hp,weekly,monthly,minimumMonthly,expectedMonthly,reference,received,difference,comparable,verdict,below,conditional,eligible,unsupported,canReverse,premium,hourlyShortfall:Math.max(0,floor-base),weeklyShortfall:Math.max(0,minWeekly-weekly),monthlyShortfall:Math.max(0,minimumMonthly-monthly)};
}
function split(days,i,r){if(!Array.isArray(days)||days.length>70)throw Error('날짜는 최대 70개까지입니다.');const seen=new Set();return days.map(d=>{if(!/^202[67]-\d\d-\d\d$/.test(d.date)||new Date(d.date+'T00:00:00Z').toISOString().slice(0,10)!==d.date||seen.has(d.date+'|'+(d.kind||'work')))throw Error('유효한 중복 없는 날짜가 필요합니다.');seen.add(d.date+'|'+(d.kind||'work'));const hours=num(d.hours,0,d.kind==='holiday'?8:24,'일 시간');const year=d.date.slice(0,4),floor=r.minimumWage[year],quoted=num(i.hourlyWage,1,1000000,'시급');const base=i.wageMode==='inclusive'&&Number(i.weeklyHours)>=15&&Number(i.weeklyHours)<=40?quoted/1.2:quoted;const rate=Math.max(floor,base);return {...d,hours,floor,rate,total:hours*rate}})}
function averages(log){const rows=log.filter(x=>x.hours!==''&&x.hours!=null);if(!rows.length)return null;return {count:rows.length,contract:rows.reduce((a,x)=>a+num(x.hours,0,80,'계약 시간'),0)/rows.length,actual:rows.reduce((a,x)=>a+num(x.actual??x.hours,0,80,'실제 시간'),0)/rows.length}}
function runSelfTest(r){const base={hourlyWage:10320,weeklyHours:20,wageMode:'base',baseYear:2026,attendance:'yes',continuity:'yes',receivedAmount:'',receivedKind:'gross'};const t=[];const ck=(n,x)=>t.push({name:n,pass:!!x});let a=calculate(base,r);ck('20h 주휴시간',a.hh===4);ck('20h 주휴액',a.hp===41280);ck('20h 주급',a.weekly===247680);a=calculate({...base,wageMode:'inclusive',hourlyWage:12000},r);ck('포함 역산',a.base===10000);ck('포함 미달',a.verdict==='shortfallLikely');ck('15h',calculate({...base,weeklyHours:15},r).hp===30960);ck('14.5h',calculate({...base,weeklyHours:14.5},r).hh===0);ck('40h',calculate({...base,weeklyHours:40},r).hh===8);ck('상한',calculate({...base,weeklyHours:60},r).hh===8);ck('결근',calculate({...base,attendance:'no'},r).hh===0);ck('퇴사',calculate({...base,continuity:'no'},r).hh===0);let z=split([{date:'2026-12-31',hours:4},{date:'2027-01-01',hours:4}],base,r);ck('12/31',z[0].rate===10320);ck('1/1',z[1].rate===10700);ck('합계',z[0].total+z[1].total===84080);ck('모름',calculate({...base,wageMode:'unknown'},r).verdict==='needCheck');ck('세후',calculate({...base,receivedAmount:1,receivedKind:'net'},r).difference===null);ck('4주 경계',averages([{hours:14},{hours:14},{hours:16},{hours:16}]).contract===15);ck('209',calculate({...base,weeklyHours:40},r,{monthMode:'209'}).monthly===2156880);return {passed:t.filter(x=>x.pass).length,total:t.length,tests:t}}
return {calculate,split,averages,runSelfTest};});
