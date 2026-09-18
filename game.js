const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString();
const defaultState = { points: 0, totalEarned: 0, clicks: 0, clickPower: 1, sound: true, upgrades: [], helpers: {}, achievements: [], lastSaved: Date.now(), eventReady: true, eventCooldown: 0 };
let state = loadState();
let lastTick = Date.now();
let toastTimeout;

const upgrades = [
  { id:'blessing', icon:'🙏', name:'Blessing in Disguise', desc:'Clicks are 2× more powerful.', cost:25, effect:()=>{ state.clickPower *= 2; } },
  { id:'tzedakah', icon:'🪙', name:'Tzedakah Box', desc:'Clicks are 3× more powerful.', cost:180, effect:()=>{ state.clickPower *= 3; } },
  { id:'song', icon:'🎶', name:'Song at the Table', desc:'All helpers produce 25% more.', cost:900, effect:()=>{ state.helperMultiplier *= 1.25; } },
  { id:'study', icon:'📖', name:'A Little Learning', desc:'Clicks are 5× more powerful.', cost:4200, effect:()=>{ state.clickPower *= 5; } },
  { id:'community', icon:'🏘️', name:'Community Spirit', desc:'All production is doubled.', cost:18000, effect:()=>{ state.helperMultiplier *= 2; } }
];
const helpers = [
  { id:'neighbor', icon:'🤝', name:'Helpful Neighbor', desc:'A neighbor lends a hand.', base:15, power:0.5 },
  { id:'baker', icon:'🍞', name:'Challah Baker', desc:'Fresh challah, fresh points.', base:100, power:4 },
  { id:'teacher', icon:'🧑‍🏫', name:'Torah Teacher', desc:'Sharing wisdom all day long.', base:650, power:22 },
  { id:'synagogue', icon:'🏛️', name:'Community Center', desc:'A place for everyone.', base:4000, power:110 },
  { id:'mensch', icon:'💛', name:'Professional Mensch', desc:'Kindness at an incredible scale.', base:25000, power:560 }
];
const quotes = [
  ['The world is sustained by three things: Torah, service, and acts of loving-kindness.','Pirkei Avot 1:2'],
  ['It is not your duty to finish the work, but neither are you free to neglect it.','Pirkei Avot 2:16'],
  ['Who is wise? One who learns from every person.','Pirkei Avot 4:1'],
  ['The highest form of wisdom is kindness.','Talmud, Berakhot 17a']
];
const achievements = [
  ['first','🌱','First Light','Do your first mitzvah.'], ['ten','✨','Getting Started','Reach 10 points.'], ['hundred','💯','Triple Digits','Reach 100 points.'], ['thousand','🌟','A Thousand Lights','Reach 1,000 points.'], ['clicker','👆','Busy Hands','Click 100 times.'], ['helper','🤝','It Takes a Village','Buy your first helper.'], ['upgrade','🪄','Level Up','Buy your first upgrade.'], ['million','🏆','Community Legend','Reach 1,000,000 points.'], ['shabbat','🕯️','Friday Feeling','Light the community candles.'], ['mensch','💛','Certified Mensch','Own a Professional Mensch.'], ['collector','🎒','Collector','Own 10 helpers.'], ['zen','🧘','Steady as You Go','Earn 100 points per second.']
];
const milestoneSteps = [100,1000,10000,100000,1000000];
state.helperMultiplier = state.helperMultiplier || 1;

function loadState() { try { return {...defaultState, ...(JSON.parse(localStorage.getItem('jewishClickerSave')) || {})}; } catch { return {...defaultState}; } }
function save() { state.lastSaved = Date.now(); localStorage.setItem('jewishClickerSave', JSON.stringify(state)); }
function totalHelpers() { return Object.values(state.helpers).reduce((a,b)=>a+b,0); }
function helperRate() { return helpers.reduce((sum,h)=>sum+(state.helpers[h.id]||0)*h.power,0) * (state.helperMultiplier || 1); }
function helperCost(h) { return Math.floor(h.base * Math.pow(1.15, state.helpers[h.id]||0)); }
function gain(amount) { state.points += amount; state.totalEarned += amount; }
function showToast(message) { const t=$('toast'); t.textContent=message; t.classList.add('show'); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>t.classList.remove('show'),2400); }
function render() {
  const rate=helperRate(); $('score').textContent=fmt(state.points); $('perSecond').textContent=fmt(rate); $('clickPower').textContent=fmt(state.clickPower);
  $('totalClicks').textContent=fmt(state.clicks); $('totalEarned').textContent=fmt(state.totalEarned); $('buildingsOwned').textContent=totalHelpers();
  const next=milestoneSteps.find(x=>state.points<x) || 1000000, previous=milestoneSteps[milestoneSteps.indexOf(next)-1] || 0;
  $('milestoneLabel').textContent=fmt(next)+' points'; $('progressText').textContent=fmt(state.points)+' / '+fmt(next); $('progressBar').style.width=Math.min(100,Math.max(0,(state.points-previous)/(next-previous)*100))+'%';
  $('helperCount').textContent=totalHelpers(); $('upgradeCount').textContent=state.upgrades.length;
  renderUpgrades(); renderHelpers(); renderAchievements();
}
function renderUpgrades() { $('upgradeList').innerHTML=upgrades.map(u=>{const bought=state.upgrades.includes(u.id), can=state.points>=u.cost; return `<div class="upgrade-item ${!bought&&can?'can-buy':''}"><div class="item-icon">${u.icon}</div><div class="item-info"><strong>${u.name}</strong><span>${u.desc}</span></div><button class="buy-button" data-upgrade="${u.id}" ${bought?'disabled':''}>${bought?'Unlocked':'✦ '+fmt(u.cost)}</button></div>`}).join(''); }
function renderHelpers() { $('helperList').innerHTML=helpers.map(h=>{const count=state.helpers[h.id]||0,cost=helperCost(h),can=state.points>=cost; return `<div class="helper-item ${can?'can-buy':''}"><div class="item-icon">${h.icon}</div><div class="item-info"><strong>${h.name}</strong><span>${h.desc} · +${h.power}/sec</span></div><div><button class="buy-button" data-helper="${h.id}">✦ ${fmt(cost)}</button><span class="count">${count} owned</span></div></div>`}).join(''); }
function isAchievementUnlocked(id) { const p=state.points; return {first:state.clicks>=1,ten:p>=10,hundred:p>=100,thousand:p>=1000,clicker:state.clicks>=100,helper:totalHelpers()>=1,upgrade:state.upgrades.length>=1,million:p>=1000000,shabbat:state.eventReady===false,mensch:(state.helpers.mensch||0)>=1,collector:totalHelpers()>=10,zen:helperRate()>=100}[id]; }
function renderAchievements() { const unlocked=achievements.filter(a=>isAchievementUnlocked(a[0])).length; $('achievementCount').textContent=unlocked+'/12'; $('achievementProgress').textContent=unlocked; $('achievementList').innerHTML=achievements.map(a=>`<div class="achievement ${isAchievementUnlocked(a[0])?'unlocked':''}"><span class="badge">${a[1]}</span><strong>${a[2]}</strong><span>${a[3]}</span></div>`).join(''); }
function clickMitzvah(e) { const amount=state.clickPower; gain(amount); state.clicks++; $('mitzvahButton').classList.remove('pop'); void $('mitzvahButton').offsetWidth; $('mitzvahButton').classList.add('pop'); const f=document.createElement('span'); f.className='float'; f.textContent='+'+fmt(amount); f.style.left=(e.clientX||window.innerWidth/2)+'px'; f.style.top=(e.clientY||250)+'px'; $('floatingLayer').appendChild(f); setTimeout(()=>f.remove(),900); if(state.clicks===1) showToast('Your first mitzvah! The light begins.'); render(); }
function buyUpgrade(id) { const u=upgrades.find(x=>x.id===id); if(!u || state.upgrades.includes(id) || state.points<u.cost) return; state.points-=u.cost; state.upgrades.push(id); u.effect(); showToast(u.name+' unlocked!'); render(); save(); }
function buyHelper(id) { const h=helpers.find(x=>x.id===id), cost=helperCost(h); if(!h || state.points<cost) return; state.points-=cost; state.helpers[id]=(state.helpers[id]||0)+1; showToast(h.name+' joined the community!'); render(); save(); }
function communityMoment() { if(!state.eventReady) return; gain(100+helperRate()*10); state.eventReady=false; state.eventCooldown=Date.now()+60000; $('eventTitle').textContent='Candles are glowing'; $('eventDescription').textContent='You made space for warmth and light. + a generous blessing!'; $('eventEmoji').textContent='✨'; $('eventButton').innerHTML='Moment complete <span>✓</span>'; showToast('The community is glowing! + bonus points'); render(); save(); }
function updateEvent() { if(!state.eventReady && Date.now()>=state.eventCooldown) { state.eventReady=true; $('eventTitle').textContent='Light the candles'; $('eventDescription').textContent='A little glow goes a long way. Come back often for community moments.'; $('eventEmoji').textContent='🕯️'; $('eventButton').innerHTML='Light candles <span>→</span>'; } if(!state.eventReady) { const left=Math.ceil((state.eventCooldown-Date.now())/1000); $('eventTimer').textContent=left+'s'; } else $('eventTimer').textContent='ready'; }
$('mitzvahButton').addEventListener('click',clickMitzvah); $('eventButton').addEventListener('click',communityMoment); $('soundToggle').addEventListener('click',()=>{state.sound=!state.sound; $('soundToggle').textContent=state.sound?'🔔':'🔕'; save();}); $('quoteButton').addEventListener('click',()=>{ const q=quotes[Math.floor(Math.random()*quotes.length)]; $('quoteText').textContent=q[0]; document.querySelector('cite').textContent='— '+q[1]; });
$('resetButton').addEventListener('click',()=>{if(confirm('Start a new community from the beginning?')){localStorage.removeItem('jewishClickerSave'); state={...defaultState}; state.helperMultiplier=1; location.reload();}});
document.addEventListener('click',e=>{ const ub=e.target.closest('[data-upgrade]'), hb=e.target.closest('[data-helper]'); if(ub) buyUpgrade(ub.dataset.upgrade); if(hb) buyHelper(hb.dataset.helper); });
setInterval(()=>{ const now=Date.now(), seconds=(now-lastTick)/1000; lastTick=now; const amount=helperRate()*seconds; if(amount>0) gain(amount); render(); updateEvent(); save(); },1000);
render(); updateEvent();
