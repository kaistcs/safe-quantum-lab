import {exclusions,pairs,signals} from "./scenarios.js";

// RY는 두 진폭을 회전시켜 입력값을 양자 상태에 부호화한다.
function rotate(state,bit,angle) {
 const c=Math.cos(angle/2), s=Math.sin(angle/2); // 회전 행렬의 성분을 구한다.
 for(let i=0;i<state.length;i++) { // 목표 비트가 0인 진폭을 한 번씩 처리한다.
  if(i & bit) continue; // 짝의 두 번째 진폭을 중복 처리하지 않는다.
  const j=i|bit, a=state[i], b=state[j]; // 비트 하나만 다른 진폭을 묶는다.
  state[i]=c*a-s*b; // 회전 뒤의 첫 진폭이다.
  state[j]=s*a+c*b; // 회전 뒤의 두 번째 진폭이다.
 }
}
// 두 큐비트의 회로를 4개 진폭으로 계산한다.
export function circuitState(a,b) {
 const state=[1,0,0,0]; // 초기 상태는 |00⟩이다.
 rotate(state,1,Math.PI*a); // 첫 관측값을 첫 큐비트에 넣는다.
 rotate(state,2,Math.PI*b); // 두 번째 관측값을 둘째 큐비트에 넣는다.
 [state[1],state[3]]=[state[3],state[1]]; // 첫 비트가 1일 때 둘째 비트를 반전한다.
 return state; // 결과별 확률을 계산할 네 진폭을 돌려준다.
}
// 둘째 큐비트가 0인 결과의 확률에서 1인 결과의 확률을 뺀다.
export function circuitPair(a,b) {
 const state=circuitState(a,b); // 입력 회전과 조건부 뒤집기를 순서대로 계산한다.
 return state[0]**2+state[1]**2-state[2]**2-state[3]**2; // 이 차이를 AI의 추가 특징으로 사용한다.
}
// 이 회로는 고전 수식으로 동일하게 계산할 수 있다.
export const analyticPair=(a,b)=>Math.cos(Math.PI*a)*Math.cos(Math.PI*b);
// 합성 실험에서만 사용하는 정답 정의를 시뮬레이션에도 표시한다.
export const syntheticLabel=input=>pairs.some(([a,b])=>input[a]*input[b]>.46);
// 같은 원시 입력에서 모델별 특징만 바꾼다.
export function features(input,method) {
 const base=input.filter((_,index)=>!exclusions.has(index)); // 즉시 정책 신호를 빼고 학습한다.
 if(method==="linear") return base; // 일반 기준 모델은 관측값을 그대로 쓴다.
 const transform=method==="circuit"?circuitPair:analyticPair; // 두 결합 특징의 구현을 선택한다.
 return [...base,...pairs.map(([a,b])=>transform(input[a],input[b]))]; // 일반 입력에 결합 특징을 더한다.
}
// 고정 시드는 동일한 비교를 반복할 수 있게 한다.
function random(seed) {
 return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;};
}
// 실측 사고가 없으므로 합성 사건을 정의하고 그 한계를 화면에 밝힌다.
export function sampleSet(seed,count) {
 const next=random(seed); // 학습, 기준 설정, 시험은 서로 다른 시드를 쓴다.
 return Array.from({length:count},()=>{
  const x=signals.map(()=>next()**2); // 대부분의 신호가 낮고 간혹 높은 사례를 만든다.
  const label=Number(syntheticLabel(x)); // 설계한 가상 사건이며 사고 실측 라벨은 아니다.
  return {x,label}; // 세 모델에 같은 관측과 정답을 전달한다.
 });
}
// 마지막 단계의 분류기는 세 방식 모두 로지스틱 회귀다.
const sigmoid=x=>1/(1+Math.exp(-x));
function score(w,x) {
 return sigmoid(x.reduce((sum,value,i)=>sum+w[i+1]*value,w[0])); // 가중합을 0~1 점수로 바꾼다.
}
// 정답과 예측의 오차를 줄이는 방향으로 가중치를 갱신한다.
function fit(samples,method) {
 const rows=samples.map(({x,label})=>({f:features(x,method),label})); // 회로 계산은 학습 전에 한 번 수행한다.
 const w=Array(rows[0].f.length+1).fill(0); // 절편과 가중치를 같은 값에서 시작한다.
 for(let epoch=0;epoch<160;epoch++) { // 세 방식에 같은 학습 횟수를 적용한다.
  const gradient=Array(w.length).fill(0); // 이번 갱신의 평균 오차 방향을 모은다.
  for(const {f,label} of rows) {
   const error=score(w,f)-label; // 교차 엔트로피의 점수 미분이다.
   gradient[0]+=error; // 절편의 기울기를 누적한다.
   f.forEach((value,i)=>gradient[i+1]+=error*value); // 특징별 기울기를 누적한다.
  }
  gradient.forEach((value,i)=>w[i]-=.65*(value/rows.length+(i?.004*w[i]:0))); // 동일한 학습률과 규제를 적용한다.
 }
 return x=>score(w,features(x,method)); // 새 입력에서 점수를 계산하는 함수를 반환한다.
}
// 같은 검증 오경보 예산을 사용해 방식별 경보 기준을 정한다.
function cutoff(validation,predict) {
 const negatives=validation.filter(row=>!row.label).map(row=>predict(row.x)).sort((a,b)=>a-b); // 정상 검증 점수를 정렬한다.
 return negatives[Math.ceil(negatives.length*.90)-1]+1e-9; // 검증 정상의 상위 약 10%를 경보 예산으로 둔다.
}
// 시험 정답으로 사건 탐지율과 오경보율을 실제 집계한다.
function measure(test,predict,threshold) {
 const positives=test.filter(row=>row.label); // 합성 사건을 분리한다.
 const negatives=test.filter(row=>!row.label); // 합성 정상 사례를 분리한다.
 return {recall:positives.filter(row=>predict(row.x)>=threshold).length/positives.length,
         falseAlarm:negatives.filter(row=>predict(row.x)>=threshold).length/negatives.length};
}
// 시간 순서의 가상 입력을 점수화할 모델과 시험 결과를 함께 만든다.
export function experiment() {
 const train=sampleSet(901,1400), validation=sampleSet(902,550), test=sampleSet(903,800); // 분리된 합성 표본이다.
 return ["linear","circuit","analytic"].map(key=>{
  const predict=fit(train,key); // 각 방식의 모델을 학습한다.
  const threshold=cutoff(validation,predict); // 시험과 별도의 데이터에서 경보 기준을 결정한다.
  return {key,predict,threshold,...measure(test,predict,threshold)}; // 재현 가능한 수치만 노출한다.
 });
}
