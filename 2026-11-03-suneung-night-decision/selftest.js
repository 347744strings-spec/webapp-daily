/* runSelfTest: 손계산과 비교하는 판정 케이스 (tests.html·node 공용) */
(function(root){
function runSelfTest(R){
  var A=['kor','math','eng','inq'];
  function S(p,m,inq,x){var r={type:'sum',areas:A,pick:p,max:m,inq:inq||'top1'};for(var k in x)r[k]=x[k];return r}
  var G={kor:2,math:3,eng:2,inq1:2,inq2:3,hist:3},SCI={inq1:'sci',inq2:'sci'};
  var KOREA=S(4,8,'top1',{history:4}),KHU=S(2,5,'avg2',{avgRounding:'keep',history:5});
  function g(x){var o={};for(var k in G)o[k]=G[k];for(k in x)o[k]=x[k];return o}
  var C=[
   ['고려대 4개합8: 2+3+2+min(2,3)=9 → 미충족',function(){return R.judge(KOREA,G,SCI,{}).status},'fail'],
   ['경희대 인문 2개합5 avg2: 국2+영2=4 → 충족',function(){return R.judge(KHU,G,SCI,{}).status},'ok'],
   ['고려대 수학 경계 up(3→2): 9/8 → 모름',function(){return R.judge(KOREA,G,SCI,{math:'up'}).status},'unknown'],
   ['고려대 경계 문장: 수학이 가름',function(){return R.judge(KOREA,G,SCI,{math:'up'}).deciders.join()},'math'],
   ['한국사 6 → 경희대(5 이내) 미충족',function(){return R.judge(KHU,g({hist:6}),SCI,{}).status},'fail'],
   ['한국사 4 → 고려대 한국사 통과(합 8이면 충족)',function(){return R.judge(KOREA,g({math:2,hist:4}),SCI,{}).status},'ok'],
   ['한국사 5 → 고려대(4 이내) 미충족',function(){return R.judge(KOREA,g({math:2,hist:5}),SCI,{}).status},'fail'],
   ['avg2 소수 유지: 국3 영3 수4 탐(2,3) → 2.5+3=5.5 > 5',function(){return R.evalRule(KHU,g({kor:3,eng:3,math:4}),SCI).sum},5.5],
   ['avg2 버림: 2+3=5 ≤ 5 → 충족',function(){return R.judge(S(2,5,'avg2',{avgRounding:'floor'}),g({kor:3,eng:3,math:4}),SCI,{}).status},'ok'],
   ['avg2 올림: 3+3=6 > 5 → 미충족',function(){return R.judge(S(2,5,'avg2',{avgRounding:'ceil'}),g({kor:3,eng:3,math:4}),SCI,{}).status},'fail'],
   ['avg2 그대로: 5.5 > 5 → 미충족',function(){return R.judge(KHU,g({kor:3,eng:3,math:4}),SCI,{}).status},'fail'],
   ['성대 sciAlt: 탐(과1, 사4) 평균2.5 vs 과탐1 → 1',function(){return R.inqValue({inq:'sciAlt'},g({inq1:1,inq2:4}),{inq1:'sci',inq2:'soc'})},1],
   ['성대 sciAlt: 사탐만(1,4) → 평균 2.5',function(){return R.inqValue({inq:'sciAlt'},g({inq1:1,inq2:4}),{inq1:'soc',inq2:'soc'})},2.5],
   ['성대 공학 수학필수 3개합6: 국2 영2 탐2 수4 → 2+2+4=8 미충족',function(){return R.judge(S(3,6,'sciAlt',{must:['math']}),g({math:4,inq1:2,inq2:2}),SCI,{}).status},'fail'],
   ['성대 사회과학(수학 필수 없음) 같은 성적 → 2+2+2=6 충족',function(){return R.judge(S(3,6,'sciAlt'),g({math:4,inq1:2,inq2:2}),SCI,{}).status},'ok'],
   ['중앙대 영어 1·2 통합: 국3 수3 영2 탐3 → 1+3+3=7 > 6 미충족',function(){return R.evalRule(S(3,6,'top1',{history:4,engMerge12:true}),g({kor:3,math:3,eng:2,inq1:3,inq2:3}),SCI).sum},7],
   ['중앙대 영어 통합 없으면 2+3+3=8',function(){return R.evalRule(S(3,6,'top1',{history:4}),g({kor:3,math:3,eng:2,inq1:3,inq2:3}),SCI).sum},8],
   ['경계 2과목(수학 up, 영어 down) 고려대 → 4조합',function(){return R.judge(KOREA,G,SCI,{math:'up',eng:'down'}).total},4],
   ['경계 2과목 고려대 통과 조합 1/4 (수2·영2만 8)',function(){return R.judge(KOREA,G,SCI,{math:'up',eng:'down'}).passCount},1],
   ['경계 2과목 가르는 과목 = 수학·영어',function(){return R.judge(KOREA,G,SCI,{math:'up',eng:'down'}).deciders.join()},'math,eng'],
   ['경계 6과목 → 64조합',function(){return R.judge(KOREA,g({kor:3,math:3,eng:3,inq1:3,inq2:3,hist:3}),SCI,{kor:'up',math:'up',eng:'up',inq1:'up',inq2:'up',hist:'up'}).total},64],
   ['경계 1등급 up은 변화 없음(1→1) → 1조합',function(){return R.judge(KOREA,g({kor:1}),SCI,{kor:'up'}).total},1],
   ['경계 down 아래로: 경희대 국2 영2 → 영3이어도 국2+탐2.5=4.5 충족',function(){return R.judge(KHU,G,SCI,{eng:'down'}).status},'ok'],
   ['each형: 3개 영역 각 1등급(국1 수1 영2 탐1) → 충족',function(){return R.judge({type:'each',areas:A,pick:3,eachMax:1,inq:'avg2',avgRounding:'floor'},g({kor:1,math:1,eng:2,inq1:1,inq2:2}),SCI,{}).status},'ok'],
   ['mustAny 수학 또는 과탐: 국1 영1 수5 사탐만 → 미충족',function(){return R.judge(S(2,3,'top1',{mustAny:['math','sci']}),g({kor:1,eng:1,math:5,inq1:1,inq2:1}),{inq1:'soc',inq2:'soc'},{}).status},'fail'],
   ['mustAny 과탐 있으면: 국1+과탐1=2 → 충족',function(){return R.judge(S(2,3,'top1',{mustAny:['math','sci']}),g({kor:1,eng:1,math:5,inq1:1,inq2:1}),SCI,{}).status},'ok'],
   ['최저 없음 → 항상 충족',function(){return R.judge({type:'none'},g({kor:9,math:9,eng:9,inq1:9,inq2:9,hist:9}),SCI,{}).status},'ok'],
   ['같은 날 고사 겹침 감지(11/21 2개)',function(){return R.overlaps([{date:'2026-11-21',start:'09:00'},{date:'2026-11-21',start:'14:00'},{date:'2026-11-28'}]).length},1],
   ['겹침 시작 간격 300분',function(){return R.overlaps([{date:'2026-11-21',start:'09:00'},{date:'2026-11-21',start:'14:00'}])[0].minGap},300],
   ['D-day 11/3 → 수능 D-16',function(){return R.dday('2026-11-19','2026-11-03')},16]
  ];
  var cases=C.map(function(c){var got;try{got=c[1]()}catch(e){got='ERR '+e.message}return{name:c[0],want:String(c[2]),got:String(got),ok:got===c[2]}});
  return{cases:cases,total:cases.length,pass:cases.filter(function(c){return c.ok}).length};
}
if(typeof module!=='undefined'&&module.exports)module.exports=runSelfTest;else root.runSelfTest=runSelfTest;
})(this);
