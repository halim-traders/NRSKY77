const STORAGE_KEY = "nr_trading_journal_v1";
const $ = (id) => document.getElementById(id);
const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
let state = loadState();
let calendarCursor = (()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),1);})();
let selectedCalendarDate = today();
let toastTimer;

function defaultState(){return {pinHash:null,recoveryHash:null,profile:{name:"NR Trader",currency:"USD",initialBalance:1000,balanceAdjustment:0},trades:[],cashflows:[]};}
function normalizeState(saved){saved=saved&&typeof saved==="object"?saved:{};const d=defaultState();return {...d,...saved,profile:{...d.profile,...(saved.profile||{}),balanceAdjustment:number(saved.profile?.balanceAdjustment)},trades:Array.isArray(saved.trades)?saved.trades:[],cashflows:Array.isArray(saved.cashflows)?saved.cashflows:[]};}
function loadState(){try{return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"));}catch(e){return defaultState();}}
function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){toast("Gagal menyimpan data. Penyimpanan browser mungkin penuh atau diblokir.");}}
function money(value){const currency=state.profile.currency||"USD";try{return new Intl.NumberFormat("en-US",{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);}catch(e){return "$"+(Number(value)||0).toFixed(2);}}
function number(value){return Number(value)||0;}
function round2(v){return Math.round((Number(v)||0)*100)/100;}
function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function getClosed(){return state.trades.filter(t=>t.pnl!==null&&t.pnl!==undefined&&t.pnl!=="");}
function tradeResult(t){if(t.pnl===null||t.pnl===undefined||t.pnl==="")return "open";return number(t.pnl)>0?"win":number(t.pnl)<0?"loss":"breakeven";}
function currentBalance(){
  const closed=getClosed();
  const net=closed.reduce((a,t)=>a+number(t.pnl),0);
  const deposits=state.cashflows.filter(c=>c.type==="deposit").reduce((a,c)=>a+number(c.amount),0);
  const withdrawals=state.cashflows.filter(c=>c.type==="withdrawal").reduce((a,c)=>a+number(c.amount),0);
  return round2(number(state.profile.initialBalance)+number(state.profile.balanceAdjustment)+deposits-withdrawals+net);
}
function stats(){const closed=getClosed(),wins=closed.filter(t=>number(t.pnl)>0),losses=closed.filter(t=>number(t.pnl)<0),be=closed.filter(t=>number(t.pnl)===0);const grossWin=wins.reduce((a,t)=>a+number(t.pnl),0),grossLoss=Math.abs(losses.reduce((a,t)=>a+number(t.pnl),0)),net=closed.reduce((a,t)=>a+number(t.pnl),0);const deposits=state.cashflows.filter(c=>c.type==="deposit").reduce((a,c)=>a+number(c.amount),0),withdrawals=state.cashflows.filter(c=>c.type==="withdrawal").reduce((a,c)=>a+number(c.amount),0);return {closed,wins,losses,be,grossWin,grossLoss,net,winRate:closed.length?wins.length/closed.length*100:0,profitFactor:grossLoss?grossWin/grossLoss:(grossWin?Infinity:0),avg:closed.length?net/closed.length:0,avgWin:wins.length?grossWin/wins.length:0,avgLoss:losses.length?losses.reduce((a,t)=>a+number(t.pnl),0)/losses.length:0,balance:currentBalance(),deposits,withdrawals};}
function streakStats(closedTrades=getClosed()){const ordered=[...closedTrades].sort((a,b)=>String(tradeReportDate(a)).localeCompare(String(tradeReportDate(b))));let currentWins=0,currentLosses=0,maxWins=0,maxLosses=0;for(const trade of ordered){const pnl=number(trade.pnl);if(pnl>0){currentWins++;currentLosses=0;maxWins=Math.max(maxWins,currentWins);}else if(pnl<0){currentLosses++;currentWins=0;maxLosses=Math.max(maxLosses,currentLosses);}else{currentWins=0;currentLosses=0;}}const total=ordered.length;return {maxWins,maxLosses,total,winPercent:total?maxWins/total*100:0,lossPercent:total?maxLosses/total*100:0};}
function formatDate(d){if(!d)return "—";return new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
// ===== Login / PIN / Recovery Code =====
// Alur:
//  1) Belum punya PIN  -> buat PIN -> tampil Recovery Code -> "Saya Sudah Simpan" -> masuk
//  2) Sudah punya PIN  -> isi PIN -> masuk.  Lupa? tekan "Lupa PIN?"
//  3) Lupa PIN         -> isi Recovery Code + PIN baru -> masuk (data jurnal tetap aman)
const uid=()=>{try{if(crypto.randomUUID)return crypto.randomUUID();}catch(e){}return "t"+Date.now().toString(36)+Math.random().toString(36).slice(2,10);};
function sha256Fallback(bytes){
  // Cadangan jika crypto.subtle tidak tersedia (mis. halaman dibuka lewat http:// non-localhost).
  const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  const K=[],H=[];
  for(let n=2,c=0;c<64;n++){let prime=true;for(let i=2;i*i<=n;i++)if(n%i===0){prime=false;break;}
    if(prime){if(c<8)H[c]=(Math.pow(n,1/2)%1*4294967296)|0;K[c++]=(Math.pow(n,1/3)%1*4294967296)|0;}}
  const l=bytes.length,total=((l+9+63)>>6)<<6,buf=new Uint8Array(total);
  buf.set(bytes);buf[l]=0x80;
  const dv=new DataView(buf.buffer);dv.setUint32(total-8,Math.floor(l*8/4294967296));dv.setUint32(total-4,(l*8)>>>0);
  const w=new Array(64);
  for(let o=0;o<total;o+=64){
    for(let i=0;i<16;i++)w[i]=dv.getInt32(o+i*4);
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotr(a,7)^rotr(a,18)^(a>>>3))+w[i-7]+(rotr(b,17)^rotr(b,19)^(b>>>10)))|0;}
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){
      const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+w[i])|0;
      const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))|0;
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    [a,b,c,d,e,f,g,h].forEach((v,i)=>{H[i]=(H[i]+v)|0;});
  }
  return H.map(x=>(x>>>0).toString(16).padStart(8,"0")).join("");
}
async function hashPin(pin){
  const bytes=new TextEncoder().encode(pin);
  if(window.crypto&&crypto.subtle){try{const hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");}catch(e){}}
  return sha256Fallback(bytes);
}
function makeRecoveryCode(){const bytes=crypto.getRandomValues(new Uint8Array(8));return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();}
const normalizeCode=s=>String(s||"").toUpperCase().replace(/[^0-9A-F]/g,"");
const formatCode=c=>normalizeCode(c).replace(/(.{4})(?=.)/g,"$1-");
const PIN_RULE=/^\d{4,6}$/;

let pinMode="login",pendingSetup=null,currentRecoveryCode="";
const PIN_MODES={
  setup:  {title:"Selamat Datang",sub:"Buat PIN 4–6 angka untuk mengamankan jurnalmu",pin:"Buat PIN",confirm:true,code:false,btn:"Buat PIN",forgot:false,back:false},
  login:  {title:"NR Trading Journal",sub:"Masukkan PIN untuk masuk",pin:"PIN",confirm:false,code:false,btn:"Masuk",forgot:true,back:false},
  recover:{title:"Lupa PIN?",sub:"Masukkan Recovery Code yang pernah kamu simpan, lalu buat PIN baru",pin:"PIN Baru",confirm:true,code:true,btn:"Simpan PIN Baru & Masuk",forgot:false,back:true}
};
function setPinMode(mode){
  pinMode=mode;
  const m=PIN_MODES[mode];
  $("pinTitle").textContent=m.title;
  $("pinSubtitle").textContent=m.sub;
  $("pinInput").placeholder=m.pin;
  $("pinConfirm").placeholder=mode==="recover"?"Ulangi PIN Baru":"Ulangi PIN";
  $("pinConfirm").classList.toggle("hidden",!m.confirm);
  $("recoveryInput").classList.toggle("hidden",!m.code);
  $("forgotPinBtn").classList.toggle("hidden",!m.forgot);
  $("cancelRecoveryBtn").classList.toggle("hidden",!m.back);
  $("pinSubmit").textContent=m.btn;
  ["pinInput","pinConfirm","recoveryInput"].forEach(id=>{$(id).value="";});
  $("pinError").textContent="";
  if(!$("pinScreen").classList.contains("hidden"))setTimeout(()=>$(m.code?"recoveryInput":"pinInput").focus(),50);
}
function showPin(){
  pendingSetup=null;currentRecoveryCode="";
  $("pinScreen").classList.remove("hidden");
  $("app").classList.add("hidden");
  $("firstRecoveryBox").classList.add("hidden");
  $("pinForm").classList.remove("hidden");
  setPinMode(state.pinHash?"login":"setup");
}
function showRecoveryCode(code,legacy=false){
  currentRecoveryCode=code;
  $("firstRecoveryValue").textContent=formatCode(code);
  $("firstRecoveryTitle").textContent=legacy?"Recovery Code Belum Dibuat":"Simpan Recovery Code";
  $("firstRecoveryText").textContent=legacy
    ?"Akun ini belum punya Recovery Code. Simpan kode ini agar kamu bisa membuat PIN baru jika lupa PIN."
    :"Kode ini dipakai untuk membuat PIN baru jika kamu lupa PIN. Salin atau unduh, lalu simpan di tempat aman.";
  $("firstRecoveryMessage").textContent="";
  $("continueAfterRecoveryBtn").textContent="Saya Sudah Simpan, Masuk";
  $("pinTitle").textContent=legacy?"Satu Langkah Lagi":"PIN Berhasil Dibuat";
  $("pinSubtitle").textContent="Simpan Recovery Code sebelum masuk";
  $("pinForm").classList.add("hidden");
  $("firstRecoveryBox").classList.remove("hidden");
}
async function unlockApp(){
  ["pinInput","pinConfirm","recoveryInput"].forEach(id=>{$(id).value="";});
  $("pinError").textContent="";
  $("pinScreen").classList.add("hidden");$("app").classList.remove("hidden");
  $("sideTraderName").textContent=state.profile.name||"NR Trader";
  $("todayLabel").textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  renderAll();showPage("dashboard");
}
$("pinForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const fail=msg=>{$("pinError").textContent=msg;};
  fail("");
  const pin=$("pinInput").value;

  if(pinMode==="recover"){
    const code=normalizeCode($("recoveryInput").value);
    if(code.length!==16)return fail("Recovery Code terdiri dari 16 karakter (angka 0–9 dan huruf A–F).");
    if(!state.recoveryHash||await hashPin(code)!==state.recoveryHash)return fail("Recovery Code tidak cocok. Periksa lagi kode yang kamu simpan.");
    if(!PIN_RULE.test(pin))return fail("PIN baru harus 4–6 angka.");
    if(pin!==$("pinConfirm").value)return fail("Ulangi PIN tidak sama.");
    state.pinHash=await hashPin(pin);saveState();
    await unlockApp();toast("PIN baru tersimpan. Data jurnalmu aman.");
    return;
  }
  if(!PIN_RULE.test(pin))return fail("PIN harus 4–6 angka.");

  if(pinMode==="setup"){
    if(pin!==$("pinConfirm").value)return fail("Ulangi PIN tidak sama.");
    const code=makeRecoveryCode();
    // PIN baru disimpan setelah pengguna menekan "Saya Sudah Simpan" supaya tidak ada akun tanpa recovery code tersimpan.
    pendingSetup={pinHash:await hashPin(pin),recoveryHash:await hashPin(code)};
    showRecoveryCode(code,false);
    return;
  }

  // login
  if(await hashPin(pin)!==state.pinHash){fail("PIN salah. Coba lagi.");$("pinInput").value="";$("pinInput").focus();return;}
  if(!state.recoveryHash){ // akun lama tanpa Recovery Code
    const code=makeRecoveryCode();
    pendingSetup={recoveryHash:await hashPin(code)};
    showRecoveryCode(code,true);
    return;
  }
  await unlockApp();
});
$("firstCopyRecoveryBtn").addEventListener("click",async()=>{if(!currentRecoveryCode)return;try{await navigator.clipboard.writeText(formatCode(currentRecoveryCode));$("firstRecoveryMessage").textContent="Recovery Code berhasil disalin.";}catch(e){$("firstRecoveryMessage").textContent="Tidak bisa menyalin otomatis. Gunakan Download Code.";}});
$("firstDownloadRecoveryBtn").addEventListener("click",()=>{if(currentRecoveryCode)downloadBlob(formatCode(currentRecoveryCode),"nr-recovery-code.txt","text/plain;charset=utf-8");});
$("continueAfterRecoveryBtn").addEventListener("click",async()=>{
  if(!pendingSetup)return;
  Object.assign(state,pendingSetup);pendingSetup=null;saveState();
  $("firstRecoveryBox").classList.add("hidden");$("pinForm").classList.remove("hidden");
  await unlockApp();toast("Siap! Jurnalmu sudah aman.");
});
$("forgotPinBtn").addEventListener("click",()=>{
  if(!state.recoveryHash){
    $("pinError").innerHTML="Akun ini belum punya Recovery Code, jadi PIN tidak bisa direset dari sini. Coba ingat PIN-nya, lalu buat Recovery Code di <b>Settings → Security</b> setelah masuk.";
    return;
  }
  setPinMode("recover");
});
$("cancelRecoveryBtn").addEventListener("click",()=>setPinMode("login"));
$("lockBtn").addEventListener("click",showPin);
// Input PIN hanya angka; Recovery Code otomatis diberi tanda "-" dan huruf kapital.
["pinInput","pinConfirm"].forEach(id=>$(id).addEventListener("input",e=>{e.target.value=e.target.value.replace(/\D/g,"");}));
$("recoveryInput").addEventListener("input",e=>{e.target.value=formatCode(e.target.value).slice(0,19);});
function showPage(name){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$("page-"+name).classList.add("active");document.querySelectorAll(".nav-link[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));const titles={dashboard:"Dashboard",journal:"Trading Journal",analytics:"Analytics",calendar:"Trading Calendar",account:"Account & Balance",settings:"Settings"};$("topPageTitle").textContent=titles[name]||name;if(name==="dashboard")drawGrowthChart();if(name==="calendar")renderCalendar();if(name==="analytics")renderAnalytics();$("sidebar").classList.remove("open");}
document.querySelectorAll(".nav-link[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.goto)));
$("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
function renderAll(){renderDashboard();renderJournal();renderAccount();renderAnalytics();renderCashHistory();renderCalendar();$("accountName").value=state.profile.name||"";$("initialBalanceInput").value=number(state.profile.initialBalance).toFixed(2);$("currentBalanceInput").value=currentBalance().toFixed(2);$("currencyInput").value=state.profile.currency||"USD";}
function setPnl(el,val){el.textContent=money(val);el.classList.toggle("positive",val>0);el.classList.toggle("negative",val<0);}
function renderDashboard(){const s=stats(),streak=streakStats(s.closed),initial=number(state.profile.initialBalance),balanceGrowthPct=initial?s.balance/initial*100-100:0,netPct=initial?s.net/initial*100:0;$("dashLossStreak").textContent=streak.maxLosses+"x";$("dashWinStreak").textContent=streak.maxWins+"x";$("dashLossStreakCaption").textContent=`${streak.maxLosses} dari ${streak.total} closed trades (${streak.lossPercent.toFixed(2)}%)`;$("dashWinStreakCaption").textContent=`${streak.maxWins} dari ${streak.total} closed trades (${streak.winPercent.toFixed(2)}%)`;$("statBalance").textContent=money(s.balance);$("statBalanceGrowth").textContent=`Pertumbuhan dari modal awal: ${balanceGrowthPct>0?"+":""}${balanceGrowthPct.toFixed(2)}%`;$("statBalanceGrowth").classList.toggle("positive",balanceGrowthPct>0);$("statBalanceGrowth").classList.toggle("negative",balanceGrowthPct<0);setPnl($("statProfit"),s.net);$("statProfitCaption").textContent=`${s.closed.length} closed trades · ${netPct>0?"+":""}${netPct.toFixed(2)}% dari modal awal`;$("statProfitCaption").classList.toggle("positive",netPct>0);$("statProfitCaption").classList.toggle("negative",netPct<0);$("statWinRate").textContent=s.winRate.toFixed(1)+"%";$("statWinCount").textContent=`${s.wins.length} wins / ${s.losses.length} losses`;$("statTrades").textContent=state.trades.length;$("statOpenTrades").textContent=`${state.trades.length-s.closed.length} open positions`;$("donutRate").textContent=s.winRate.toFixed(0)+"%";$("legendWin").textContent=s.wins.length;$("legendLoss").textContent=s.losses.length;$("legendBE").textContent=s.be.length;$("winDonut").style.background=`conic-gradient(var(--green) 0 ${s.winRate*3.6}deg,var(--red) ${s.winRate*3.6}deg ${(s.winRate+(s.closed.length?s.losses.length/s.closed.length*100:0))*3.6}deg,#555 0)`;$("dashPF").textContent=Number.isFinite(s.profitFactor)?s.profitFactor.toFixed(2):"∞";$("dashAvg").textContent=money(s.avg);const recent=[...state.trades].sort((a,b)=>tradeReportDate(b).localeCompare(tradeReportDate(a))).slice(0,5);$("recentTrades").innerHTML=recent.length?recent.map(t=>tradeRow(t,false)).join(""):'<tr><td colspan="7" class="empty-cell">Belum ada transaksi.</td></tr>';drawGrowthChart();}
function tradePips(t){
  const value=Number(t.pips);
  return Number.isFinite(value)&&t.pips!==""&&t.pips!==null&&t.pips!==undefined?value:null;
}
function formatPips(v){
  const n=Number(v);
  if(!Number.isFinite(n))return "—";
  const formatted=new Intl.NumberFormat("en-US",{maximumFractionDigits:8,useGrouping:false}).format(n);
  return `${n>0?"+":""}${formatted} pips`;
}
// Nilai pada baris transaksi ditampilkan sesuai angka desimal yang diketik di Add Trade.
function formatTradePips(t){
  if(t.pips===""||t.pips===null||t.pips===undefined)return "—";
  const raw=String(t.pips).trim();
  const n=Number(raw);
  if(!Number.isFinite(n))return "—";
  return `${n>0?"+":""}${raw} pips`;
}
function tradeReportDate(t){return t.exitDate||t.date||"";}
function monthKey(date){return String(date||"").slice(0,7);}
function monthLabel(key){return new Date(key+"-01T00:00:00").toLocaleDateString("id-ID",{month:"long",year:"numeric"});}
function monthStats(key){const trades=state.trades.filter(t=>monthKey(tradeReportDate(t))===key);const pips=trades.map(tradePips).filter(v=>v!==null);const closed=trades.filter(t=>tradeResult(t)!=="open");const pnl=closed.reduce((a,t)=>a+number(t.pnl),0);return {trades,pips,totalPips:pips.reduce((a,v)=>a+v,0),avgPips:pips.length?pips.reduce((a,v)=>a+v,0)/pips.length:0,pnl,closed};}
function capitalAtMonthStart(key){const beforeTrades=getClosed().filter(t=>monthKey(tradeReportDate(t))<key).reduce((a,t)=>a+number(t.pnl),0);const beforeCash=state.cashflows.filter(c=>monthKey(c.date)<key).reduce((a,c)=>a+(c.type==="deposit"?number(c.amount):-number(c.amount)),0);return number(state.profile.initialBalance)+number(state.profile.balanceAdjustment)+beforeCash+beforeTrades;}
function tradeRow(t,actions=true){
  const result=tradeResult(t),pnl=t.pnl===""||t.pnl===null?"—":money(t.pnl),pips=tradePips(t);
  if(!actions){
    return `<tr><td>${formatDate(tradeReportDate(t))}</td><td class="trade-pair">${escapeHTML(t.pair)}</td><td class="${t.type==="BUY"?"type-buy":"type-sell"}">${t.type}</td><td>${number(t.lot).toFixed(2)}</td><td class="${number(t.pnl)>0?"positive":number(t.pnl)<0?"negative":""}">${pnl}</td><td class="${pips>0?"positive":pips<0?"negative":""}">${pips===null?"—":formatTradePips(t)}</td><td><span class="status status-${result}">${result.toUpperCase()}</span></td></tr>`;
  }
  return `<tr>
    <td>${formatDate(t.date)}</td>
    <td>${t.exitDate?formatDate(t.exitDate):"—"}</td>
    <td class="trade-pair">${escapeHTML(t.pair)}</td>
    <td class="${t.type==="BUY"?"type-buy":"type-sell"}">${t.type}</td>
    <td>${number(t.lot).toFixed(2)}</td>
    <td>${t.entry||"—"}</td>
    <td>${t.sl||"—"}</td>
    <td>${t.tp||"—"}</td>
    <td class="${number(t.pnl)>0?"positive":number(t.pnl)<0?"negative":""}">${pnl}</td>
    <td class="${pips>0?"positive":pips<0?"negative":""}">${pips===null?"—":formatTradePips(t)}</td>
    <td><span class="status status-${result}">${result.toUpperCase()}</span></td>
    <td><div class="row-actions"><button data-edit="${t.id}">Edit</button><button data-delete="${t.id}">Delete</button></div></td>
  </tr>`;
}
// Titik saldo berurutan: modal awal (+koreksi) lalu trade closed & cash flow sesuai tanggalnya.
// Titik terakhir selalu sama dengan Current Balance.
function balanceTimeline(){
  const ev=[];
  getClosed().forEach(t=>ev.push({d:tradeReportDate(t)||"",a:number(t.pnl),o:1}));
  state.cashflows.forEach(c=>ev.push({d:c.date||"",a:c.type==="deposit"?number(c.amount):-number(c.amount),o:0}));
  ev.sort((x,y)=>x.d.localeCompare(y.d)||x.o-y.o);
  let bal=number(state.profile.initialBalance)+number(state.profile.balanceAdjustment);
  const pts=[bal];ev.forEach(e=>{bal+=e.a;pts.push(bal);});
  return pts;
}
function drawGrowthChart(){const canvas=$("growthChart"),ctx=canvas.getContext("2d"),pts=balanceTimeline();const empty=pts.length<2;$("chartEmpty").style.display=empty?"grid":"none";if(empty){ctx.clearRect(0,0,canvas.width,canvas.height);return;}const w=canvas.clientWidth,h=canvas.clientHeight,dpr=window.devicePixelRatio||1;if(!w||!h)return;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);const pad={l:58,r:12,t:15,b:28},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;let min=Math.min(...pts),max=Math.max(...pts);if(min===max){min-=1;max+=1;}const x=i=>pad.l+(i/(pts.length-1))*cw,y=v=>pad.t+(max-v)/(max-min)*ch;ctx.font="10px DM Sans";ctx.strokeStyle="#292929";ctx.fillStyle="#858585";ctx.lineWidth=1;for(let i=0;i<4;i++){let yy=pad.t+i*ch/3;ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();ctx.fillText(money(max-(max-min)*i/3),2,yy+3);}ctx.beginPath();pts.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.lineTo(x(pts.length-1),h-pad.b);ctx.lineTo(x(0),h-pad.b);ctx.closePath();const grad=ctx.createLinearGradient(0,pad.t,0,h-pad.b);grad.addColorStop(0,"#f5a00055");grad.addColorStop(1,"#f5a00000");ctx.fillStyle=grad;ctx.fill();ctx.beginPath();pts.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.strokeStyle="#f5a000";ctx.lineWidth=2;ctx.stroke();ctx.fillStyle="#f5a000";pts.forEach((v,i)=>{if(i===pts.length-1){ctx.beginPath();ctx.arc(x(i),y(v),3.5,0,Math.PI*2);ctx.fill();}});ctx.fillStyle="#858585";ctx.fillText("Start",pad.l,h-7);ctx.fillText("Latest",w-48,h-7);}
function renderJournal(){
  const q=$("searchTrades").value.toLowerCase(),pair=$("filterPair").value,res=$("filterResult").value,month=$("filterDate").value;
  const pairs=[...new Set(state.trades.map(t=>t.pair))].sort();
  const current=$("filterPair").value;
  $("filterPair").innerHTML='<option value="">Semua pair</option>'+pairs.map(p=>`<option>${escapeHTML(p)}</option>`).join("");
  $("filterPair").value=current;
  const list=[...state.trades].filter(t=>
    (!q||t.pair.toLowerCase().includes(q)||(t.notes||"").toLowerCase().includes(q))&&
    (!pair||t.pair===pair)&&
    (!res||tradeResult(t)===res)&&
    (!month||tradeReportDate(t).startsWith(month))
  ).sort((a,b)=>tradeReportDate(b).localeCompare(tradeReportDate(a)));
  $("journalRows").innerHTML=list.length?list.map(t=>tradeRow(t,true)).join(""):'<tr><td colspan="12" class="empty-cell">Tidak ada transaksi yang cocok.</td></tr>';
  $("tradeCountLabel").textContent=`${list.length} dari ${state.trades.length} transaksi`;
  $("journalTotalPill").textContent=`${state.trades.length} TRADE`;
  document.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editTradeInline(b.dataset.edit)));
  document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteTrade(b.dataset.delete)));
}
["searchTrades","filterPair","filterResult","filterDate"].forEach(id=>$(id).addEventListener(id==="searchTrades"?"input":"change",renderJournal));
$("resetFilters").addEventListener("click",()=>{$("searchTrades").value="";$("filterPair").value="";$("filterResult").value="";$("filterDate").value="";renderJournal();});

function resetTradeForm(){
  $("tradeForm").reset();
  $("tradeId").value="";
  $("tradeDate").value=today();
  $("tradeType").value="BUY";
  $("tradeFormMode").textContent="NEW TRADE";
  $("saveTradeBtn").textContent="Simpan Trade";
  $("cancelTrade").classList.add("hidden");
  $("tradeValidation").textContent="";
}

function editTradeInline(id){
  const t=state.trades.find(x=>x.id===id);
  if(!t)return;
  $("tradeId").value=t.id;
  $("tradeDate").value=t.date||today();
  $("tradePair").value=t.pair||"";
  $("tradeType").value=t.type||"BUY";
  $("tradeLot").value=t.lot??"";
  $("tradeEntry").value=t.entry??"";
  $("tradeExit").value=t.exit??"";
  $("tradeExitDate").value=t.exitDate??"";
  $("tradeSL").value=t.sl??"";
  $("tradeTP").value=t.tp??"";
  $("tradePnl").value=t.pnl??"";
  $("tradePips").value=t.pips??"";
  $("tradeStrategy").value=t.strategy??"";
  $("tradeNotes").value=t.notes??"";
  $("tradeFormMode").textContent="EDIT TRADE";
  $("saveTradeBtn").textContent="Update Trade";
  $("cancelTrade").classList.remove("hidden");
  $("tradeValidation").textContent="";
  focusTradeForm();
}

function validateTradeForm(){
  const pair=$("tradePair").value,entry=Number($("tradeEntry").value),sl=$("tradeSL").value===""?null:Number($("tradeSL").value),tp=$("tradeTP").value===""?null:Number($("tradeTP").value);
  if(!pair||!Number.isFinite(entry))return "Lengkapi pair dan Entry Price.";
  const exitD=$("tradeExitDate").value,entryD=$("tradeDate").value;
  if(exitD&&entryD&&exitD<entryD)return "Tgl Exit tidak boleh lebih awal dari Tgl Entry.";
  if(sl!==null&&Number.isFinite(sl)){
    if($("tradeType").value==="BUY"&&sl>=entry)return "Untuk BUY, Stop Loss harus di bawah Entry Price.";
    if($("tradeType").value==="SELL"&&sl<=entry)return "Untuk SELL, Stop Loss harus di atas Entry Price.";
  }
  if(tp!==null&&Number.isFinite(tp)){
    if($("tradeType").value==="BUY"&&tp<=entry)return "Untuk BUY, Take Profit harus di atas Entry Price.";
    if($("tradeType").value==="SELL"&&tp>=entry)return "Untuk SELL, Take Profit harus di bawah Entry Price.";
  }
  return "";
}

function focusTradeForm(){
  showPage("journal");
  setTimeout(()=>{
    $("tradeEntryPanel").scrollIntoView({behavior:"smooth",block:"start"});
    $("tradePair").focus();
  },80);
}

function openTradeForm(){
  resetTradeForm();
  focusTradeForm();
}

// Tombol Add Trade di header selalu membuka halaman Trading Journal.
$("quickAddBtn").addEventListener("click",openTradeForm);
$("addTradeBtn").addEventListener("click",openTradeForm);

$("cancelTrade").addEventListener("click",resetTradeForm);

$("tradeForm").addEventListener("submit",e=>{
  e.preventDefault();
  const validation=validateTradeForm();
  if(validation){$("tradeValidation").textContent=validation;$("tradeValidation").className="trade-validation has-error";return;}
  const id=$("tradeId").value,pnlValue=$("tradePnl").value;
  const trade={
    id:id||uid(),
    date:$("tradeDate").value,
    pair:$("tradePair").value,
    type:$("tradeType").value,
    lot:number($("tradeLot").value),
    entry:$("tradeEntry").value,
    exit:$("tradeExit").value,
    exitDate:$("tradeExitDate").value,
    sl:$("tradeSL").value,
    tp:$("tradeTP").value,
    pnl:pnlValue===""?"":number(pnlValue),
    pips:$('tradePips').value===""?"":number($('tradePips').value),
    strategy:$("tradeStrategy").value.trim(),
    notes:$("tradeNotes").value.trim()
  };
  if(!trade.pair||!trade.date||trade.lot<=0){toast("Lengkapi tanggal, pair, dan lot size.");return;}
  if(id)state.trades=state.trades.map(t=>t.id===id?trade:t);else state.trades.push(trade);
  saveState();
  selectedCalendarDate=tradeReportDate(trade)||trade.date;
  const tradeDay=new Date(selectedCalendarDate+"T00:00:00");
  calendarCursor=new Date(tradeDay.getFullYear(),tradeDay.getMonth(),1);
  renderAll();
  resetTradeForm();
  toast(id?"Trade berhasil diperbarui.":"Trade berhasil ditambahkan.");
});

function deleteTrade(id){if(!confirm("Hapus transaksi ini?"))return;state.trades=state.trades.filter(t=>t.id!==id);saveState();renderAll();toast("Transaksi dihapus.");}

function renderAnalytics(){const s=stats(),closed=[...s.closed].sort((a,b)=>tradeReportDate(a).localeCompare(tradeReportDate(b))),streak=streakStats(closed);$("anaPF").textContent=Number.isFinite(s.profitFactor)?s.profitFactor.toFixed(2):"∞";$("anaAvgWin").textContent=money(s.avgWin);$("anaAvgLoss").textContent=money(s.avgLoss);const best=closed.length?Math.max(...closed.map(t=>number(t.pnl))):0,worst=closed.length?Math.min(...closed.map(t=>number(t.pnl))):0;$("anaBest").textContent=money(best);$("anaWorst").textContent=money(worst);$("anaExpectancy").textContent=money(s.avg);$("anaClosed").textContent=closed.length;$("anaWinStreak").textContent=streak.maxWins;$("anaLossStreak").textContent=streak.maxLosses;renderMonthlyReturns();drawMonthlyChart();}
function renderMonthlyReturns(){const months=[...new Set(getClosed().map(t=>monthKey(tradeReportDate(t)) ))].filter(Boolean).sort().reverse();$("monthlyReturnRows").innerHTML=months.length?months.map(key=>{const m=monthStats(key),capital=capitalAtMonthStart(key),pct=capital?m.pnl/capital*100:0;return `<tr><td>${monthLabel(key)}</td><td>${money(capital)}</td><td class="${m.pnl>0?"positive":m.pnl<0?"negative":""}">${money(m.pnl)}</td><td class="${pct>0?"positive":pct<0?"negative":""}">${pct>0?"+":""}${pct.toFixed(2)}%</td><td>${m.trades.length}</td></tr>`;}).join(""):'<tr><td colspan="5" class="empty-cell">Belum ada data bulanan.</td></tr>';}

function drawMonthlyChart(){
  const canvas=$("monthlyChart"),ctx=canvas.getContext("2d"),closed=getClosed();
  $("monthlyEmpty").style.display=closed.length?"none":"grid";
  if(!closed.length){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=window.devicePixelRatio||1;
  if(!w||!h)return;
  canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);
  const map={};
  closed.forEach(t=>{const key=monthKey(tradeReportDate(t));if(key)map[key]=(map[key]||0)+number(t.pnl);});
  const entries=Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8);
  const pad={l:12,r:12,t:24,b:30},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  const vals=entries.map(x=>x[1]),max=Math.max(0,...vals),min=Math.min(0,...vals),span=(max-min)||1;
  const y=v=>pad.t+(max-v)/span*ch,zero=y(0);
  ctx.font="10px DM Sans";ctx.textAlign="center";
  ctx.strokeStyle="#333";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,zero);ctx.lineTo(w-pad.r,zero);ctx.stroke();
  const gap=cw/entries.length,bw=Math.min(35,gap*.55);
  entries.forEach(([m,v],i)=>{
    const cx=pad.l+i*gap+gap/2,top=Math.min(y(v),zero),bh=Math.max(Math.abs(y(v)-zero),1);
    ctx.fillStyle=v>=0?"#24c78a":"#ef626d";ctx.fillRect(cx-bw/2,top,bw,bh);
    ctx.fillStyle="#999";
    const d=new Date(m+"-01T00:00:00");
    ctx.fillText(d.toLocaleDateString("id-ID",{month:"short"})+" "+String(d.getFullYear()).slice(2),cx,h-9);
    if(gap>=64){ctx.fillStyle=v>=0?"#24c78a":"#ef626d";ctx.fillText(money(v),cx,v>=0?top-5:top+bh+11);}
  });
  ctx.textAlign="left";
}
function renderCalendar(){
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
  $("calendarMonth").textContent=calendarCursor.toLocaleDateString("id-ID",{month:"long",year:"numeric"});
  const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),offset=(first+6)%7;
  let html=["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map(d=>`<div class="calendar-cell day-name">${d}</div>`).join("");
  for(let i=0;i<offset;i++)html+='<div class="calendar-cell empty"></div>';
  for(let d=1;d<=days;d++){
    const key=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dayTrades=state.trades.filter(t=>tradeReportDate(t)===key&&tradeResult(t)!=="open");
    const pnl=dayTrades.reduce((a,t)=>a+number(t.pnl),0);
    const cls=dayTrades.length?(pnl>0?"profit":pnl<0?"loss":""):"";
    html+=`<button class="calendar-cell ${cls} ${selectedCalendarDate===key?"selected":""}" data-date="${key}"><span class="day-number">${d}</span>${dayTrades.length?`<span class="day-result ${pnl>=0?"positive":"negative"}">${pnl>=0?"+":""}${money(pnl)}</span>`:""}</button>`;
  }
  $("calendarGrid").innerHTML=html;
  document.querySelectorAll("[data-date]").forEach(b=>b.addEventListener("click",()=>{selectedCalendarDate=b.dataset.date;renderCalendar();renderCalendarDetail();}));
  renderCalendarDetail();
}
function renderCalendarDetail(){
  const list=state.trades.filter(t=>tradeReportDate(t)===selectedCalendarDate);
  const closed=list.filter(t=>tradeResult(t)!=="open");
  const pnl=closed.reduce((a,t)=>a+number(t.pnl),0);
  const pips=list.map(tradePips).filter(v=>v!==null);
  const totalPips=pips.reduce((a,v)=>a+v,0),avgPips=pips.length?totalPips/pips.length:0;
  const key=selectedCalendarDate.slice(0,7),m=monthStats(key);
  $("calendarDetailTitle").textContent="Daily Summary · "+formatDate(selectedCalendarDate);
  $("calendarDetail").innerHTML=list.length?`<div class="daily-summary-metrics">
    <div><span>Daily P/L</span><b class="${pnl>0?"positive":pnl<0?"negative":""}">${money(pnl)}</b></div>
    <div><span>Total Pips</span><b class="${totalPips>0?"positive":totalPips<0?"negative":""}">${formatPips(totalPips)}</b></div>
    <div><span>Average Pips / Trade</span><b>${pips.length?formatPips(avgPips):"—"}</b></div>
    <div><span>Closed Trades</span><b>${closed.length}</b></div>
  </div>
  <div class="table-scroll"><table><thead><tr><th>Pair</th><th>Position</th><th>Entry</th><th>TP</th><th>P/L</th><th>Pips</th><th>Status</th></tr></thead>
  <tbody>${list.map(t=>{const tp=tradePips(t);return `<tr><td>${escapeHTML(t.pair)}</td><td>${t.type}</td><td>${t.entry||"—"}</td><td>${t.tp||"—"}</td><td class="${number(t.pnl)>0?"positive":number(t.pnl)<0?"negative":""}">${t.pnl===""?"Open":money(t.pnl)}</td><td class="${tp>0?"positive":tp<0?"negative":""}">${tp===null?"—":formatTradePips(t)}</td><td>${tradeResult(t)}</td></tr>`;}).join("")}</tbody></table></div>`:"Tidak ada transaksi pada tanggal ini.";
  const monthlyBox=$("monthlyPipsSummary");
  monthlyBox.innerHTML=`<div class="monthly-summary-heading"><h3>Monthly Pips · ${monthLabel(key)}</h3><span>${m.trades.length} trades · ${m.closed.length} closed</span></div>
  <div class="daily-summary-metrics monthly-metrics">
    <div><span>Total Pips Bulan Ini</span><b class="${m.totalPips>0?"positive":m.totalPips<0?"negative":""}">${formatPips(m.totalPips)}</b></div>
    <div><span>Rata-rata Pips / Trade</span><b>${m.pips.length?formatPips(m.avgPips):"—"}</b></div>
    <div><span>Profit / Loss</span><b class="${m.pnl>0?"positive":m.pnl<0?"negative":""}">${money(m.pnl)}</b></div>
  </div>`;
}
$("prevMonth").addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);selectedCalendarDate=`${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth()+1).padStart(2,"0")}-01`;renderCalendar();});
$("nextMonth").addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);selectedCalendarDate=`${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth()+1).padStart(2,"0")}-01`;renderCalendar();});
function renderAccount(){
  const s=stats();
  $("accountInitial").textContent=money(state.profile.initialBalance);
  $("accountCurrent").textContent=money(currentBalance());
  $("accountDeposit").textContent=money(s.deposits);
  $("accountWithdrawal").textContent=money(s.withdrawals);
}
function renderCashHistory(){$("cashHistory").innerHTML=state.cashflows.length?'<strong class="muted" style="font-size:11px">Recent cash flow</strong>'+[...state.cashflows].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(c=>`<div class="cash-item ${c.type}"><span>${c.type==="deposit"?"Deposit":"Withdrawal"} · ${formatDate(c.date)}</span><b>${c.type==="deposit"?"+":"−"}${money(c.amount)}</b></div>`).join(""):'<span class="muted" style="font-size:11px">Belum ada cash flow.</span>';}
function exportCSV(){const rows=[["Date","Exit Date","Pair","Position","Lot","Entry","Exit Price","Stop Loss","Take Profit","Profit Loss","Pips","Strategy","Notes","Status"],...state.trades.map(t=>[t.date,t.exitDate||"",t.pair,t.type,t.lot,t.entry,t.exit||"",t.sl,t.tp,t.pnl,tradePips(t),t.strategy,t.notes,tradeResult(t)])];const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");downloadBlob("\uFEFF"+csv,"nr-trading-journal.csv","text/csv;charset=utf-8");}
function downloadBlob(content,name,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
// Account & Balance: saldo akhir dapat dikoreksi langsung. Nilai modal awal disesuaikan
// agar riwayat P/L, deposit, dan withdrawal tetap konsisten.
$("balanceForm").addEventListener("submit",e=>{
  e.preventDefault();
  const name=$("accountName").value.trim()||"NR Trader";
  const initial=Number($("initialBalanceInput").value);
  const desired=Number($("currentBalanceInput").value);
  const currency=$("currencyInput").value;
  if(!Number.isFinite(initial)||initial<0){toast("Initial Balance harus berupa angka 0 atau lebih.");return;}
  if(!Number.isFinite(desired)||desired<0){toast("Current Balance harus berupa angka 0 atau lebih.");return;}

  const cashNet=state.cashflows.reduce((a,c)=>a+(c.type==="deposit"?number(c.amount):-number(c.amount)),0);
  const tradeNet=getClosed().reduce((a,t)=>a+number(t.pnl),0);
  state.profile.name=name;
  state.profile.currency=currency;
  state.profile.initialBalance=initial;
  // Simpan koreksi saldo terpisah agar Initial Balance tetap bisa diedit
  // tanpa merusak histori trade, deposit, dan withdrawal.
  state.profile.balanceAdjustment=round2(desired-(initial+cashNet+tradeNet));

  saveState();
  renderAll();
  toast("Account berhasil disimpan. Saldo Dashboard sudah diperbarui.");
});
$("cashForm").addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number($("cashAmount").value),date=$("cashDate").value;
  if(!Number.isFinite(amount)||amount<=0||!date){toast("Lengkapi jumlah dan tanggal cash flow.");return;}
  if($("cashType").value==="withdrawal"&&amount>currentBalance()){toast("Withdrawal melebihi saldo saat ini.");return;}
  state.cashflows.push({id:Date.now(),type:$("cashType").value,amount,date,note:$("cashNote").value.trim()});
  saveState();e.target.reset();$("cashDate").value=today();renderAll();toast("Cash flow berhasil disimpan.");
});
$("journalExport").addEventListener("click",exportCSV);$("dashboardExport").addEventListener("click",exportCSV);
$("backupBtn").addEventListener("click",()=>downloadBlob(JSON.stringify(state,null,2),"nr-trading-backup.json","application/json"));
$("importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data.profile||!Array.isArray(data.trades)||!Array.isArray(data.cashflows))throw new Error();if(!confirm("Import akan mengganti seluruh data jurnal saat ini. Lanjutkan?"))return;state=normalizeState(data);saveState();renderAll();showPin();toast("Backup berhasil diimpor. Masukkan PIN.");}catch(err){toast("File backup tidak valid.");}e.target.value="";});
$("clearDataBtn").addEventListener("click",()=>{
  const balance=round2(currentBalance());
  if(!confirm(`Hapus seluruh riwayat trade dan cash flow?\n\nSaldo ${money(balance)} akan dipertahankan dan menjadi Initial Balance baru. Profil, PIN, dan Recovery Code juga tetap aman.`))return;
  state.trades=[];state.cashflows=[];state.profile.initialBalance=balance;state.profile.balanceAdjustment=0;
  saveState();renderAll();toast("Riwayat dihapus. Saldo "+money(balance)+" tetap tersimpan.");
});
$("recoveryCodeBtn").addEventListener("click",async()=>{
  if(state.recoveryHash&&!confirm("Buat Recovery Code baru? Kode lama tidak akan berlaku lagi."))return;
  const code=makeRecoveryCode();state.recoveryHash=await hashPin(code);currentRecoveryCode=code;saveState();
  $("recoveryCodeValue").textContent=formatCode(code);$("recoveryCodeBox").classList.remove("hidden");
  $("recoverySettingsMessage").textContent="Recovery Code baru dibuat. Simpan di tempat aman; kode lama sudah tidak berlaku.";
});
$("copyRecoveryBtn").addEventListener("click",async()=>{if(!currentRecoveryCode)return;try{await navigator.clipboard.writeText(formatCode(currentRecoveryCode));toast("Recovery Code berhasil disalin.");}catch(e){toast("Tidak bisa menyalin otomatis. Gunakan Download Code.");}});
$("downloadRecoveryBtn").addEventListener("click",()=>{if(currentRecoveryCode)downloadBlob(formatCode(currentRecoveryCode),"nr-recovery-code.txt","text/plain;charset=utf-8");});
$("changePinForm").addEventListener("submit",async e=>{e.preventDefault();const old=$("oldPin").value,n=$("newPin").value,c=$("confirmNewPin").value;if(await hashPin(old)!==state.pinHash){$("pinChangeMessage").textContent="PIN saat ini salah.";return;}if(!/^\d{4,6}$/.test(n)){$("pinChangeMessage").textContent="PIN baru harus 4–6 angka.";return;}if(n!==c){$("pinChangeMessage").textContent="Konfirmasi PIN tidak cocok.";return;}state.pinHash=await hashPin(n);saveState();e.target.reset();$("pinChangeMessage").textContent="PIN berhasil diperbarui." ;});
window.addEventListener("resize",()=>{if(!$("app").classList.contains("hidden")){drawGrowthChart();drawMonthlyChart();}});
if($("cashDate"))$("cashDate").value=today();
["oldPin","newPin","confirmNewPin"].forEach(id=>$(id).addEventListener("input",e=>{e.target.value=e.target.value.replace(/\D/g,"");}));
showPin();
