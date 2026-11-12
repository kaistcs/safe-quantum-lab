import {circuitState} from "./model.js";

// HTML의 조절 장치와 설명 영역을 이름으로 찾는다.
const get=id=>document.getElementById(id);
const rain=get("guide-rain"), slope=get("guide-slope"); // 두 입력을 서로 독립적으로 바꾼다.
const pct=n=>(100*n).toFixed(1)+"%"; // 확률을 100번 중 몇 번인지 읽기 쉽게 표시한다.

function explain() {
 const a=Number(rain.value)/100, b=Number(slope.value)/100; // 슬라이더 값을 0~1로 바꾼다.
 get("guide-rain-value").value=rain.value;
 get("guide-slope-value").value=slope.value;
 const pA=Math.sin(Math.PI*a/2)**2, pB=Math.sin(Math.PI*b/2)**2; // RY만 적용한 각 큐비트의 1 확률이다.
 get("guide-rotate").textContent="입력이 커질수록 1이 나올 확률이 커집니다. 지금 돌리기 직후에는 비가 1일 확률이 "+pct(pA)+", 경사가 1일 확률이 "+pct(pB)+"입니다.";
 get("guide-flip").textContent="비가 0인 경우에는 경사 쪽을 그대로 둡니다. 비가 1인 경우에는 경사 쪽의 0과 1을 서로 바꿉니다.";
 const probabilities=circuitState(a,b).map(value=>value**2); // 실제 모델과 같은 진폭을 제곱해 확률을 얻는다.
 const zero=probabilities[0]+probabilities[1], one=probabilities[2]+probabilities[3]; // 경사 쪽의 두 결과만 묶는다.
 get("guide-read").textContent="계산 뒤 경사 쪽이 0일 확률은 "+pct(zero)+", 1일 확률은 "+pct(one)+"입니다. 두 확률의 차이 "+(zero-one).toFixed(3)+"을 AI에 추가로 줍니다. 산행 위험도는 그 뒤 AI가 계산합니다.";
 get("guide-prob").replaceChildren(...probabilities.map((value,i)=>{
  const cell=document.createElement("div"); // 네 가지 경우를 한 칸씩 보여 준다.
  cell.textContent=["00","10","01","11"][i]+"   "+pct(value); // 계산의 비트 순서를 화면 라벨과 맞춘다.
  return cell;
 }));
}

function explainMemory() {
 const n=Number(get("guide-qubits").value), count=2**n; // 각 큐비트마다 가능한 결과 수가 두 배가 된다.
 const size=new Intl.NumberFormat("ko-KR").format(count); // 큰 숫자에 천 단위 쉼표를 넣는다.
 const bytes=new Intl.NumberFormat("ko-KR").format(count*16); // 복소수 진폭 하나를 16바이트로 잡은 예다.
 get("guide-memory").textContent=n+"큐비트는 진폭 "+size+"개가 필요합니다. 진폭 하나에 16바이트를 쓰면 목록만 약 "+bytes+"바이트입니다. 큐비트가 한 개 늘 때마다 두 배가 됩니다.";
}
rain.oninput=explain; // 신호를 움직이면 계산과 설명을 갱신한다.
slope.oninput=explain;
get("guide-qubits").onchange=explainMemory; // 이 선택은 메모리 예제만 바꾼다.
explain();
explainMemory();
