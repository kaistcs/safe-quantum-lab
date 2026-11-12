import {routes,signals,vector,policy,pairs,exclusions} from "./scenarios.js";
import {experiment,syntheticLabel} from "./model.js";

// 모든 화면 상태는 이 페이지에만 유지한다.
const byId=id=>document.getElementById(id);
const models=experiment(); // 페이지를 열 때 같은 합성 자료로 모델을 다시 학습한다.
const modelNames={linear:"일반 AI",circuit:"양자 특징 AI",analytic:"일반 수식 대조군"};
const percent=n=>(100*n).toFixed(1); // 점수와 비율은 읽기 쉬운 퍼센트로 표기한다.
const pp=n=>Math.abs(100*n).toFixed(1)+"%p";
let routeIndex=0, stepIndex=0, mode="both", inputs=[]; // 선택한 단계와 사용자가 바꾼 관측값이다.
let timer=null, narrative="", speechActive=false; // 재생 및 음성의 현재 상태다.
const speech=window.speechSynthesis; // 브라우저 표준 음성 재생기를 사용한다.
let recording=null; // 기기에 한국어 음성이 없어도 고정 예제는 들을 수 있다.
const controls=[]; // 관측값을 바꿀 슬라이더를 신호 순서대로 보관한다.

// 문서에서 사용할 요소를 간결하게 만들되 문구는 텍스트로 넣는다.
function element(tag,text,className) {
 const node=document.createElement(tag); // 브라우저가 요소를 생성한다.
 if(text) node.textContent=text; // HTML로 해석하지 않고 문자 그대로 표시한다.
 if(className) node.className=className; // 화면에서 쓰는 색과 크기를 선택한다.
 return node;
}

// 입력 신호는 몸 상태, 기상, 경로, 장치 그룹으로 접을 수 있다.
for(const group of new Set(signals.map(([group])=>group))) {
 const details=element("details",null,"signal-group"); // 각 그룹을 독립적으로 연다.
 details.open=group==="몸 상태"; // 처음에는 첫 그룹만 펼친다.
 details.append(element("summary",group)); // 그룹 이름은 키보드로도 열 수 있다.
 signals.forEach(([section,label],i)=>{
  if(section!==group) return; // 이 그룹에 해당하는 입력만 그린다.
  const row=element("label",null,"signal"); // 글자를 누르면 입력에 초점을 준다.
  const slider=element("input"); // 낮음과 높음 사이의 합성 관측을 조정한다.
  Object.assign(slider,{type:"range",min:0,max:100,value:0}); // 0~100 범위를 고정한다.
  const output=element("output","0"); // 현재 슬라이더 수치를 표시한다.
  slider.addEventListener("input",()=>{
   inputs[i]=Number(slider.value)/100; // 회로에 넣기 전에 0~1로 바꾼다.
   output.value=slider.value; // 슬라이더 옆 숫자를 갱신한다.
   update(); // 두 모델과 안전 정책을 즉시 다시 적용한다.
  });
  controls[i]={slider,output}; // 단계가 바뀔 때 이 입력을 갱신한다.
  row.append(element("span",label+(exclusions.has(i)?" (안전 규칙)":"")),slider,output); // 정책 신호의 역할을 표시한다.
  details.append(row);
 });
 byId("signals").append(details);
}
routes.forEach((route,i)=>byId("route").add(new Option(route.name,String(i)))); // 시나리오 메뉴를 채운다.

// 음성 목록을 새로 읽어 한국어 음성이 있을 때만 재생한다.
function koreanVoice() {
 return speech?.getVoices().find(voice=>/^ko(?:[-_]|$)/i.test(voice.lang)&&voice.localService)
  ??speech?.getVoices().find(voice=>/^ko(?:[-_]|$)/i.test(voice.lang)); // 로컬 한국어 음성을 우선한다.
}
function voiceReady() {
 const voice=koreanVoice(); // 운영체제와 브라우저가 제공한 한국어 음성만 선택한다.
 byId("voice-status").textContent=voice?"한국어 음성: "+voice.name:"현재 판단을 읽으려면 브라우저 한국어 음성이 필요합니다. 예제와 성적표 녹음은 바로 들을 수 있습니다.";
}
speech?.addEventListener("voiceschanged",voiceReady); // 일부 브라우저는 음성 목록을 늦게 전달한다.
voiceReady();
function stopVoice() {
 speechActive=false; // 단계 재생을 막고 있던 음성 상태를 해제한다.
 recording?.pause(); // 녹음과 동적 음성이 동시에 나오지 않게 한다.
 speech?.cancel(); // 진행 중이거나 대기 중인 낭독을 중단한다.
}
function playRecording(filename) {
 stopVoice(); // 먼저 재생되던 음성을 끈다.
 recording=new Audio("./"+filename); // 서버에 있는 고정 한국어 TTS 파일을 재생한다.
 speechActive=true;
 recording.onended=()=>{speechActive=false;byId("voice-status").textContent="녹음 안내 완료";};
 recording.play().then(()=>{byId("voice-status").textContent="한국어 예제 음성 재생 중";})
  .catch(()=>{speechActive=false;byId("voice-status").textContent="음성을 재생하지 못했습니다. 화면 설명을 이용하세요.";});
}
function speak(message) {
 const voice=koreanVoice(); // 재생 시점에 음성 목록을 다시 확인한다.
 if(!voice||!window.SpeechSynthesisUtterance) {voiceReady();return;} // 화면 설명은 계속 이용할 수 있다.
 stopVoice(); // 이전 안내와 새 안내가 겹치지 않게 한다.
 const utterance=new SpeechSynthesisUtterance(message); // 현재 설명을 한 문단의 음성 요청으로 만든다.
 Object.assign(utterance,{voice,lang:voice.lang,rate:.9}); // 한국어로 조금 느리게 읽는다.
 speechActive=true;
 utterance.onend=()=>{speechActive=false;byId("voice-status").textContent="음성 안내 완료";}; // 다음 자동 단계를 허용한다.
 utterance.onerror=()=>{speechActive=false;byId("voice-status").textContent="음성을 재생하지 못했습니다. 화면 설명을 이용하세요.";}; // 실패를 화면에 알린다.
 byId("voice-status").textContent="한국어 음성으로 설명하는 중";
 speech.speak(utterance);
}

// 경보 기준과 현재 점수를 함께 그려 기준선 통과 여부를 보여 준다.
function metric(model,score) {
 const panel=element("article",null,"metric"+(model.key==="circuit"?" quantum":"")); // 방식별 색을 고정한다.
 const bar=element("div",null,"bar"); // 막대 위에 경보 기준을 얹는다.
 const fill=element("i"), mark=element("b"); // 현재 점수와 별도의 기준선이다.
 fill.style.width=percent(score)+"%"; // 막대 길이를 점수에 맞춘다.
 mark.style.left=percent(model.threshold)+"%"; // 검증에서 정한 기준을 표시한다.
 bar.setAttribute("aria-hidden","true"); // 숫자와 판정은 아래에 텍스트로 제공한다.
 bar.append(fill,mark);
 panel.append(element("h3",modelNames[model.key]),element("div",percent(score)+"%","value"),bar,
  element("strong",score>=model.threshold?"경보 후보":"기준 미달"),
  element("p","이 방식의 기준 "+percent(model.threshold)+"%","small"));
 return panel;
}

function update() {
 const [title,desc]=routes[routeIndex].steps[stepIndex]; // 현재 위치의 장면 설명을 불러온다.
 const warning=policy(inputs); // 공식 통제 같은 우선 규칙을 모델과 별도로 판단한다.
 const [normal,quantum,analytic]=models.map(model=>model.predict(inputs)); // 같은 순간의 입력으로 세 점수를 계산한다.
 const a=normal>=models[0].threshold,b=quantum>=models[1].threshold; // 방식별로 검증에서 정한 기준을 적용한다.
 const strongest=pairs.reduce((best,pair)=>inputs[pair[0]]*inputs[pair[1]]>inputs[best[0]]*inputs[best[1]]?pair:best); // 현재 함께 높은 신호 쌍을 찾는다.
 const [first,second]=strongest.map(i=>signals[i][1]); // 신호 번호를 읽을 수 있는 이름으로 바꾼다.
 byId("stage-title").textContent=title;
 byId("stage-desc").textContent=desc;
 byId("policy").hidden=!warning;
 byId("policy").textContent=warning;
 const scored=[normal,quantum]; // 화면의 두 방식은 같은 순서로 유지한다.
 byId("scores").replaceChildren(...models.slice(0,2).flatMap((model,i)=>mode==="both"||model.key===mode?[metric(model,scored[i])]:[]));
 const verdict=a===b?(a?"두 방식 모두 경보 후보":"두 방식 모두 기준 미달"):(b?"양자 특징 AI만 경보 후보":"일반 AI만 경보 후보");
 byId("insight-title").textContent=verdict; // 두 결과의 의미를 숫자 위에 표시한다.
 const together=strongest.every(i=>inputs[i]>.25)?first+"과 "+second+" 신호가 함께 올라 있습니다. ":""; // 함께 높을 때만 신호를 언급한다.
 const event=syntheticLabel(inputs); // 현재 관측에 대한 합성 시험 정답을 확인한다.
 const verdictMeaning=event?(a||b?"합성 정답은 위험 사건입니다. 경보를 낸 방식이 이 장면을 탐지했습니다.":"합성 정답은 위험 사건입니다. 두 방식이 이 장면을 놓쳤습니다.")
  :(a||b?"합성 정답은 정상입니다. 이 장면의 경보는 오경보로 집계됩니다.":"합성 정답은 정상입니다.");
 const explanation=together+"일반 AI "+percent(normal)+"%, 양자 특징 AI "+percent(quantum)+"%로 점수 차이는 "+pp(quantum-normal)+"입니다. "+verdictMeaning;
 byId("insight-text").textContent=explanation;
 const counterfactual=[...inputs]; // 한 신호만 낮추고 나머지 조건은 그대로 둔다.
 counterfactual[strongest[0]]=0;
 const [normalLower,quantumLower]=models.slice(0,2).map(model=>model.predict(counterfactual)); // 두 AI를 같은 바뀐 입력으로 다시 계산한다.
 const why=together
  ? first+"만 0으로 낮추고 "+second+"를 그대로 두면 일반 AI는 "+percent(normal)+"%에서 "+percent(normalLower)+"%, 양자 특징 AI는 "+percent(quantum)+"%에서 "+percent(quantumLower)+"%로 바뀝니다. 일반 AI는 각 신호를 따로 입력받고, 양자 특징 AI는 두 신호의 조합도 입력받습니다. 같은 결합은 일반 수식으로도 계산할 수 있습니다."
  :"함께 높은 신호 쌍이 없습니다. 비 오는 하산길의 ‘비와 급경사 중첩’ 단계에서 한 신호를 낮췄을 때의 차이를 확인할 수 있습니다.";
 byId("why-text").textContent=why;
 byId("analytic").textContent="일반 수식 대조군 "+percent(analytic)+"%, 양자 회로 "+percent(quantum)+"%. 두 구현은 같은 결합 특징을 계산하므로 이 실험의 판독 결과가 일치합니다.";
 narrative=(warning?warning+" ":"")+title+". "+desc+" "+verdict+". "+explanation.replaceAll("%p"," 퍼센트포인트")+" "+why; // 화면과 같은 근거를 음성으로 읽는다.
}

function loadStep(index,announce=false) {
 stepIndex=index; // 사용자가 이동하거나 타이머가 진행한 단계를 저장한다.
 const route=routes[routeIndex]; // 한 산행의 모든 단계를 가져온다.
 inputs=vector(route.steps[index][2]); // 편집값 대신 해당 장면의 가상 관측을 적용한다.
 controls.forEach(({slider,output},i)=>{slider.value=String(Math.round(inputs[i]*100));output.value=slider.value;}); // 입력과 화면을 동기화한다.
 byId("route-photo").src="./"+route.image;
 byId("stage-counter").textContent="산행 단계 "+(index+1)+" / "+route.steps.length;
 byId("steps").replaceChildren(...route.steps.map(([name],i)=>{
  const button=element("button",(i+1)+". "+name); // 번호와 장면 이름을 함께 표시한다.
  button.setAttribute("aria-current",String(i===index)); // 현재 단계의 강조를 보조 기술에도 알려 준다.
  button.onclick=()=>{pause();stopVoice();loadStep(i);}; // 사용자가 선택하면 자동 진행을 멈춘다.
  return button;
 }));
 update(); // 바뀐 입력을 계산한다.
 if(announce&&byId("auto-voice").checked) speak(narrative); // 요청한 경우에만 자동으로 읽는다.
}

function pause() {
 clearInterval(timer); // 실행 중인 반복 호출을 중단한다.
 timer=null;
 byId("play").disabled=false;
 byId("pause").disabled=true;
 byId("play-status").textContent="일시정지";
}
byId("play").onclick=()=>{
 if(timer!==null) return; // 버튼을 여러 번 눌러도 재생을 하나만 유지한다.
 byId("play").disabled=true;
 byId("pause").disabled=false;
 byId("play-status").textContent="재생 중";
 if(byId("auto-voice").checked) speak(narrative); // 사용자 클릭에서 첫 음성을 시작한다.
 timer=setInterval(()=>{
  if(speechActive&&byId("auto-voice").checked) return; // 음성 설명이 끝날 때까지 장면을 유지한다.
  if(stepIndex+1===routes[routeIndex].steps.length) {
   pause();byId("play-status").textContent="마지막 단계에 도착했습니다.";return; // 결과를 열어 둔다.
  }
  loadStep(stepIndex+1,true);
 },6500); // 음성을 끈 경우 약 6.5초마다 다음 장면을 보여 준다.
};
byId("pause").onclick=()=>{pause();stopVoice();}; // 재생과 음성을 함께 멈춘다.
byId("reset").onclick=()=>{pause();stopVoice();loadStep(0);byId("play-status").textContent="";}; // 처음 장면으로 돌아간다.
byId("route").onchange=()=>{pause();stopVoice();routeIndex=Number(byId("route").value);loadStep(0);byId("play-status").textContent="";}; // 새 시나리오는 첫 장면부터 시작한다.
byId("mode").onclick=event=>{
 const button=event.target.closest("button[data-mode]"); // 실제 방식 버튼에만 응답한다.
 if(!button) return;
 mode=button.dataset.mode; // 계산은 같은 입력으로 유지하고 표시 범위만 선택한다.
 for(const choice of byId("mode").querySelectorAll("button")) choice.setAttribute("aria-pressed",String(choice===button));
 update();
};
byId("speak").onclick=()=>speak(narrative); // 현재 산행 판단을 다시 들을 수 있다.
byId("stop-voice").onclick=()=>{byId("auto-voice").checked=false;stopVoice();byId("voice-status").textContent="음성 안내를 껐습니다.";}; // 이후 자동 음성도 해제한다.

const [baseline,circuit,control]=models; // 시험 수치를 비교할 세 방식이다.
const recallChange=circuit.recall-baseline.recall; // 같은 시험에서 재현율의 차이를 계산한다.
const falseChange=circuit.falseAlarm-baseline.falseAlarm; // 오경보율 변화도 함께 계산한다.
const delta=n=>pp(n)+(n>0?" 증가":n<0?" 감소":" 차이 없음"); // 개선과 악화를 같은 방식으로 표시한다.
const summary="합성 시험에서 일반 AI 대비 양자 특징 AI의 사건 탐지율은 "+delta(recallChange)+", 정상 오경보율은 "+delta(falseChange)+"입니다. 일반 수식 대조군은 양자 특징 AI와 같은 결과였습니다.";
byId("benchmark-summary").textContent=summary;
for(const model of [baseline,circuit,control]) {
 const row=element("tr"); // 수치와 비교 기준을 표에 넣는다.
 for(const value of [modelNames[model.key],percent(model.recall)+"%",percent(model.falseAlarm)+"%",percent(model.threshold)+"%"]) row.append(element("td",value));
 byId("benchmark-rows").append(row);
}
byId("speak-example").onclick=()=>playRecording("comparison-ko.wav"); // 입력값과 무관한 고정 예제다.
byId("speak-benchmark").onclick=()=>playRecording("benchmark-ko.wav"); // 이 버전의 고정 시험 성적을 읽는다.
loadStep(0); // 브라우저가 열리면 첫 단계와 비교 결과를 표시한다.
