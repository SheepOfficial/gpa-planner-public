const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const core=require('../dist/core.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('虚构示例与精确达标边界',()=>{
 const e=core.example(),r=core.solve(e);assert.equal(e.currentGpa,'3.8');assert.equal(e.historyCredits,'40');assert.equal(e.historyPoints,'152');assert.equal(e.courses.length,5);assert.ok(r.feasible);close(r.forecast,204.1/51);close(r.max,205.5/51);
 const below=core.example();below.courses.filter(c=>c.type==='numeric').forEach(c=>c.fixed='98');assert.equal(core.solve(below).feasible,false);below.courses[2].fixed='99';assert.equal(core.solve(below).feasible,true);
 const exact=core.example();exact.target='3.9';assert.equal(core.solve(exact).forecast,3.9);assert.equal(core.solve({...e,target:'4.1'}).feasible,false);
});
test('固定分数和固定等级重新分配',()=>{
 const e=core.example();e.courses[0].fixed='95';const r=core.solve(e);assert.equal(r.rows[0].score,95);assert.ok(r.rows[0].fixed);close(r.forecast,4);
 const x=core.example();x.courses.find(c=>c.name==='综合实践').fixed='良好';assert.equal(core.solve(x).feasible,false);assert.ok(core.solve(x).rows.filter(c=>!c.fixed).every(c=>c.score===null));
});
test('空白等级可分配，等级不总为优秀',()=>{
 const e=core.example();e.target='3.9';const r=core.solve(e);assert.ok(r.rows.some(c=>c.type==='rating'&&c.score==='良好'));assert.ok(e.courses.filter(c=>c.type==='rating').every(c=>c.fixed===''));
 e.historyCredits='0';e.historyPoints='0';e.courses=[{name:'等级课程',credits:'1',type:'rating',fixed:''}];e.target='3.5';assert.equal(core.solve(e).rows[0].score,'良好');assert.equal(core.solve(e).allFixed,false);e.target='2.5';assert.equal(core.solve(e).rows[0].score,'中等');e.courses[0].fixed='优秀';assert.equal(core.solve(e).rows[0].score,'优秀');assert.equal(core.solve(e).allFixed,true);
});
test('零历史成绩、低目标与小数成绩精确比较',()=>{
 const e=core.example();e.historyCredits='0';e.historyPoints='0';e.currentGpa='';assert.ok(core.solve(e).feasible);e.target='0';assert.ok(core.solve(e).rows.filter(c=>c.type==='numeric').every(c=>c.score===60));
 e.courses=[{name:'考试课程',credits:'1',type:'numeric',fixed:'99.5'}];e.target='4.95';assert.ok(core.solve(e).feasible);e.target='4.950000000001';assert.equal(core.solve(e).feasible,false);
});
test('分段规则与不同学分',()=>{
 const e=core.example();e.historyCredits='0';e.historyPoints='0';e.target='3.6';e.rule={...e.rule,scale:'4',mode:'bands',ratings:[],bands:[{min:0,max:60,gpa:0},{min:60,max:80,gpa:2},{min:80,max:90,gpa:3},{min:90,max:100,gpa:4}]};e.courses=[{name:'课程甲',credits:'3.5',type:'numeric',fixed:''},{name:'课程乙',credits:'1',type:'numeric',fixed:''}];assert.ok(core.solve(e).feasible);assert.equal(core.gradePoint('89.999',e.rule).value(),3);assert.equal(core.gradePoint(90,e.rule).value(),4);assert.equal(core.gradePoint(100,e.rule).value(),4);
});
test('无效输入与规则缺失重叠',()=>{
 for(const credits of ['','0','-1','NaN']){const e=core.example();e.courses[0].credits=credits;assert.throws(()=>core.solve(e));}for(const fixed of ['-1','101','abc']){const e=core.example();e.courses[0].fixed=fixed;assert.throws(()=>core.solve(e));}
 const e=core.example();e.rule.mode='bands';e.rule.bands[1].min=61;assert.throws(()=>core.solve(e),/缺失/);e.rule.bands[1].min=59;assert.throws(()=>core.solve(e),/重叠/);e.rule.bands[1].min=60;e.rule.bands.at(-1).max=99;assert.throws(()=>core.solve(e),/覆盖/);
});
test('两列和四列课程表的行号及空白等级',()=>{
 const r=core.importRows([['学分','课程名称'],['3','课程甲'],['',''],['1','课程乙']]);assert.equal(r.length,2);assert.equal(r[1].sourceRow,4);assert.equal(r[0].type,'');const n=core.importRows([['课程名称','学分','评分方式','预计成绩'],['课程甲',3,'百分制',95],['课程乙',1,'等级','']]);assert.equal(n[0].fixed,'95');assert.equal(n[1].type,'rating');assert.equal(n[1].fixed,'');assert.throws(()=>core.importRows([['成绩'],[95]]),/表头/);
});
test('Excel 虚构课程与模板回读',()=>{
 const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../dist/vendor/xlsx.full.min.js'),'utf8'),context);const x=context.XLSX,w=x.utils.book_new(),courses=core.example().courses;x.utils.book_append_sheet(w,x.utils.aoa_to_sheet([['学分','课程名称'],...courses.map(c=>[c.credits,c.name])]),'课程');const back=x.read(x.write(w,{type:'buffer',bookType:'xlsx'}),{type:'buffer'}),rows=core.importRows(x.utils.sheet_to_json(back.Sheets[back.SheetNames[0]],{header:1,defval:''}));assert.equal(rows.length,5);assert.equal(rows.reduce((s,c)=>s+Number(c.credits),0),11);assert.equal(rows[0].name,'数学基础');assert.equal(rows.at(-1).name,'体育课程');
});
