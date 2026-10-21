(function (root) {
  'use strict';
  // Decimal inputs become exact rational numbers. Display rounding never decides feasibility.
  function gcd(a,b){a=a<0n?-a:a;b=b<0n?-b:b;while(b){const t=b;b=a%b;a=t;}return a||1n;}
  class Q {
    constructor(n,d=1n){if(!d)throw new Error('计算分母不能为零');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);this.n=n/g;this.d=d/g;}
    static from(x){if(x instanceof Q)return x;let s=String(x).trim();if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)||s.length>24)throw new Error('请输入有效数字（不使用科学计数法）');s=s.replace(/^([+-]?)\./,'$10.');const [a,b='']=s.split('.');if(b.length>12)throw new Error('小数位数请不超过 12 位');const sign=a.startsWith('-')?-1n:1n;return new Q(sign*BigInt(a.replace(/^[+-]/,'')+b),10n**BigInt(b.length));}
    add(x){x=Q.from(x);return new Q(this.n*x.d+x.n*this.d,this.d*x.d);}
    sub(x){x=Q.from(x);return new Q(this.n*x.d-x.n*this.d,this.d*x.d);}
    mul(x){x=Q.from(x);return new Q(this.n*x.n,this.d*x.d);}
    div(x){x=Q.from(x);return new Q(this.n*x.d,this.d*x.n);}
    cmp(x){x=Q.from(x);const v=this.n*x.d-x.n*this.d;return v<0n?-1:v>0n?1:0;}
    value(){return Number(this.n)/Number(this.d);}
  }
  const zero=Q.from(0);
  const empty=x=>x===null||x===undefined||String(x).trim()==='';
  function num(x,label){if(empty(x))throw new Error('请填写'+label);try{return Q.from(x);}catch(e){throw new Error(label+'：'+e.message);}}
  function nonnegative(x,label){const q=num(x,label);if(q.cmp(0)<0)throw new Error(label+'不能为负数');return q;}
  function validateRule(r){
    const scale=nonnegative(r.scale,'绩点满分');if(scale.cmp(0)<=0)throw new Error('绩点满分必须大于 0');
    const pass=num(r.passScore,'及格分数');if(pass.cmp(0)<0||pass.cmp(100)>0||!Number.isInteger(pass.value()))throw new Error('及格分数必须是 0–100 的整数');
    if(r.mode==='linear'){
      const base=nonnegative(r.base,'及格对应绩点'),step=nonnegative(r.step,'每分增加绩点');
      if(base.add(Q.from(100).sub(pass).mul(step)).cmp(scale)>0)throw new Error('线性规则算出的满分绩点超过设置的绩点满分，请调整规则');
    }else if(r.mode==='bands'){
      if(!Array.isArray(r.bands)||!r.bands.length)throw new Error('请填写完整的分数段');
      let prevMax=zero,prevGpa=zero;
      r.bands.forEach((b,i)=>{const lo=nonnegative(b.min,'第 '+(i+1)+' 段下限'),hi=nonnegative(b.max,'第 '+(i+1)+' 段上限'),g=nonnegative(b.gpa,'第 '+(i+1)+' 段绩点');
        if(lo.cmp(prevMax)!==0)throw new Error('第 '+(i+1)+' 段存在区间缺失、重叠或顺序错误');
        if(hi.cmp(lo)<=0||hi.cmp(100)>0)throw new Error('第 '+(i+1)+' 段上限须大于下限且不超过 100');
        if(g.cmp(scale)>0||g.cmp(prevGpa)<0)throw new Error('分段绩点须随成绩不降低，且不超过满分');prevMax=hi;prevGpa=g;});
      if(prevMax.cmp(100)!==0)throw new Error('分数段须完整覆盖 0–100');
    }else throw new Error('请选择百分制换算方式');
    const names=new Set();for(const row of r.ratings||[]){const name=String(row.name||'').trim();if(!name||names.has(name))throw new Error('等级名称不能为空或重复');names.add(name);if(nonnegative(row.gpa,'等级 '+name+' 的绩点').cmp(scale)>0)throw new Error('等级绩点不能超过绩点满分');}
    return r;
  }
  function gradePoint(score,r){const s=num(score,'成绩');if(s.cmp(0)<0||s.cmp(100)>0)throw new Error('百分制成绩必须在 0–100 之间');
    if(r.mode==='linear')return s.cmp(r.passScore)<0?zero:Q.from(r.base).add(s.sub(r.passScore).mul(r.step));
    const i=r.bands.findIndex((b,i)=>s.cmp(b.min)>=0&&(s.cmp(b.max)<0||(i===r.bands.length-1&&s.cmp(100)===0)));
    if(i<0)throw new Error('该成绩没有对应的分数段');return Q.from(r.bands[i].gpa);
  }
  function validateCourse(c,r,index){const label='第 '+(index+1)+' 门课程';if(!String(c.name||'').trim())throw new Error(label+'：请填写课程名称');
    if(num(c.credits,label+'学分').cmp(0)<=0)throw new Error(label+'：学分必须大于 0');
    if(c.type==='numeric'){if(!empty(c.fixed))gradePoint(c.fixed,r);}
    else if(c.type==='rating'){if(!(r.ratings||[]).length)throw new Error(label+'：请先配置等级绩点');if(!empty(c.fixed)&&!r.ratings.some(v=>v.name===c.fixed))throw new Error(label+'：等级“'+c.fixed+'”没有对应绩点');}
    else throw new Error(label+'：请选择评分方式');return c;
  }
  function solve(input){
    const r=validateRule(input.rule),C=nonnegative(input.historyCredits,'已修总学分'),T=nonnegative(input.target,'目标累计绩点');
    if(T.cmp(r.scale)>0)throw new Error('目标累计绩点不能超过绩点满分');
    const exact=!empty(input.historyPoints);let P,current;
    if(exact){P=nonnegative(input.historyPoints,'历史学分绩点合计');if(P.cmp(C.mul(r.scale))>0)throw new Error('历史学分绩点合计超过已修学分×绩点满分');current=C.cmp(0)>0?P.div(C):zero;}
    else {current=C.cmp(0)>0?nonnegative(input.currentGpa,'当前累计绩点'):zero;if(current.cmp(r.scale)>0)throw new Error('当前累计绩点不能超过绩点满分');P=current.mul(C);}
    const courses=input.courses||[];if(!courses.length)throw new Error('请至少添加一门待计入课程');if(courses.length>500)throw new Error('单次最多计算 500 门课程');
    const rows=courses.map((c,i)=>{validateCourse(c,r,i);const credits=Q.from(c.credits);let gp,score,fixed=false;
      if(c.type==='rating'){const grade=empty(c.fixed)?[...r.ratings].sort((a,b)=>Q.from(b.gpa).cmp(a.gpa))[0]:r.ratings.find(x=>x.name===c.fixed);score=grade.name;gp=Q.from(grade.gpa);fixed=!empty(c.fixed);}
      else {fixed=!empty(c.fixed);score=fixed?Number(c.fixed):100;gp=gradePoint(score,r);}
      return {id:c.id,name:String(c.name).trim(),credits,type:c.type,score,gp,fixed};});
    const N=rows.reduce((a,c)=>a.add(c.credits),zero),total=C.add(N),required=T.mul(total).sub(P);
    const sum=()=>rows.reduce((a,c)=>a.add(c.credits.mul(c.gp)),zero);
    const maxPoints=sum(),max=P.add(maxPoints).div(total),free=rows.filter(x=>x.type==='numeric'&&!x.fixed);
    const freeRatings=rows.filter(x=>x.type==='rating'&&!x.fixed),variables=rows.filter(x=>!x.fixed);
    const settled=rows.filter(x=>x.fixed).reduce((a,c)=>a.add(c.credits.mul(c.gp)),zero);
    const freeCredits=free.reduce((a,c)=>a.add(c.credits),zero);
    const feasible=max.cmp(T)>=0;
    // Blank grades are variables, just like blank numerical scores. Balance both by GPA.
    const numericChoices=[];for(let score=Number(r.passScore);score<=100;score++){const gp=gradePoint(score,r);if(!numericChoices.length||gp.cmp(numericChoices.at(-1).gp)!==0)numericChoices.push({score,gp});}
    const allRatings=[...(r.ratings||[])].map(g=>({score:g.name,gp:Q.from(g.gpa)})).sort((a,b)=>a.gp.cmp(b.gp));
    const positiveRatings=allRatings.filter(g=>g.gp.cmp(0)>0);
    const ratingChoices=(positiveRatings.length?positiveRatings:allRatings).filter((g,i,a)=>!i||g.gp.cmp(a[i-1].gp)!==0);
    const choices=c=>c.type==='numeric'?numericChoices:ratingChoices;
    const minimum=settled.add(variables.reduce((a,c)=>a.add(c.credits.mul(choices(c)[0].gp)),zero));
    if(feasible&&variables.length){
      const ceilings=[...new Map(variables.flatMap(c=>choices(c)).map(x=>[x.gp.n+'/'+x.gp.d,x.gp])).values()].sort((a,b)=>a.cmp(b));
      const applyCeiling=ceiling=>{for(const c of variables){const options=choices(c);let i=0;while(i+1<options.length&&options[i+1].gp.cmp(ceiling)<=0)i++;c.choice=i;c.score=options[i].score;c.gp=options[i].gp;}return sum();};
      let lo=0,hi=ceilings.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(P.add(applyCeiling(ceilings[mid])).cmp(T.mul(total))>=0)hi=mid;else lo=mid+1;}
      let contribution=applyCeiling(ceilings[lo]);
      // Reduce the highest GPA that can be lowered while preserving the exact target.
      while(true){let candidate=null,next=null;
        for(const c of variables){if(!c.choice)continue;const option=choices(c)[c.choice-1],changed=contribution.sub(c.credits.mul(c.gp.sub(option.gp)));
          if(P.add(changed).cmp(T.mul(total))>=0&&(!candidate||c.gp.cmp(candidate.gp)>0)){candidate=c;next={option,changed};}}
        if(!candidate)break;candidate.choice--;candidate.score=next.option.score;candidate.gp=next.option.gp;contribution=next.changed;
      }
    }
    const proposed=sum(),forecast=P.add(proposed).div(total),ratingPoints=freeRatings.reduce((a,c)=>a.add(c.credits.mul(c.gp)),zero);
    return {feasible,exactHistory:exact||C.cmp(0)===0,current:current.value(),historyCredits:C.value(),historyPoints:P.value(),newCredits:N.value(),totalCredits:total.value(),target:T.value(),max:max.value(),forecast:forecast.value(),requiredPoints:required.value(),requiredSemesterGpa:required.div(N).value(),remainingPoints:required.sub(settled).sub(ratingPoints).value(),freeCredits:freeCredits.value(),freeCount:free.length,freeRatingCount:freeRatings.length,allFixed:!variables.length,minimumSuffices:P.add(minimum).cmp(T.mul(total))>=0,gap:feasible?0:T.sub(max).value(),rows:rows.map(c=>({id:c.id,name:c.name,type:c.type,fixed:c.fixed,credits:c.credits.value(),gp:c.gp.value(),points:c.credits.mul(c.gp).value(),score:feasible||c.fixed?c.score:null}))};
  }
  function importRows(raw){
    const headerIndex=raw.findIndex(row=>row.some(x=>String(x??'').trim()==='学分')&&row.some(x=>['课程名称','课程','科目'].includes(String(x??'').trim())));
    if(headerIndex<0)throw new Error('第一张工作表需要“课程名称”和“学分”表头');
    const h=raw[headerIndex].map(x=>String(x??'').trim()),find=names=>h.findIndex(x=>names.includes(x));
    const ni=find(['课程名称','课程','科目']),ci=find(['学分']),ti=find(['评分方式','成绩类型']),fi=find(['预计成绩','固定成绩','成绩']);
    const rows=[];for(let i=headerIndex+1;i<raw.length;i++){const row=raw[i];if(row.every(x=>empty(x)))continue;let type=ti<0?'':String(row[ti]??'').trim();type=['百分制','分数','numeric'].includes(type)?'numeric':['等级','等级制','五级制','rating'].includes(type)?'rating':'';
      rows.push({sourceRow:i+1,name:String(row[ni]??'').trim(),credits:String(row[ci]??'').trim(),type,fixed:fi<0?'':String(row[fi]??'').trim()});}
    if(!rows.length)throw new Error('表头之后没有课程数据');if(rows.length>500)throw new Error('单次最多导入 500 门课程');return rows;
  }
  function example(){return {"currentGpa":"3.8","historyCredits":"40","historyPoints":"152","target":"4.0","rule":{"scale":"5","mode":"linear","passScore":"60","base":"1","step":"0.1","bands":[{"min":"0","max":"60","gpa":"0"},{"min":"60","max":"70","gpa":"1"},{"min":"70","max":"80","gpa":"2"},{"min":"80","max":"90","gpa":"3"},{"min":"90","max":"100","gpa":"4"}],"ratings":[{"name":"优秀","gpa":"4.5"},{"name":"良好","gpa":"3.5"},{"name":"中等","gpa":"2.5"}]},"courses":[{"id":"demo-0","name":"数学基础","credits":"3","type":"numeric","fixed":""},{"id":"demo-1","name":"程序设计","credits":"3","type":"numeric","fixed":""},{"id":"demo-2","name":"语言课程","credits":"2","type":"numeric","fixed":""},{"id":"demo-3","name":"综合实践","credits":"2","type":"rating","fixed":""},{"id":"demo-4","name":"体育课程","credits":"1","type":"rating","fixed":""}]};}
  const api={solve,validateRule,validateCourse,gradePoint,importRows,example,Q};root.GpaCore=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
