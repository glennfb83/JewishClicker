const $ = (id) => document.getElementById(id);
const format = (value) => Math.floor(value).toLocaleString();
const SAVE_KEY = 'jewishClickerSave';
const EVENT_LENGTH = 60_000;

const freshState = () => ({
  points: 0,
  totalEarned: 0,
  clicks: 0,
  clickPower: 1,
  helperMultiplier: 1,
  sound: true,
  upgrades: [],
  helpers: {},
  achievements: [],
  eventReady: true,
  eventCooldown: 0,
  lastSaved: Date.now()
});

let state = loadState();
let lastTick = Date.now();
let toastTimer;
let audioContext;

const upgrades = [
  { id: 'blessing', icon: '🙏', name: 'Blessing in Disguise', desc: 'Each click is worth twice as much.', cost: 25 },
  { id: 'tzedakah', icon: '🪙', name: 'Tzedakah Box', desc: 'Each click is worth three times as much.', cost: 180 },
  { id: 'song', icon: '🎶', name: 'Song at the Table', desc: 'Helpers produce 25% more points.', cost: 900 },
  { id: 'study', icon: '📖', name: 'A Little Learning', desc: 'Each click is worth five times as much.', cost: 4_200 },
  { id: 'community', icon: '🏘️', name: 'Community Spirit', desc: 'All helper production is doubled.', cost: 18_000 }
];

const helpers = [
  { id: 'neighbor', icon: '🤝', name: 'Helpful Neighbor', desc: 'A neighbor lends a hand.', base: 15, power: 0.5 },
  { id: 'baker', icon: '🍞', name: 'Challah Baker', desc: 'Fresh challah, fresh points.', base: 100, power: 4 },
  { id: 'teacher', icon: '🧑‍🏫', name: 'Torah Teacher', desc: 'Sharing wisdom all day long.', base: 650, power: 22 },
  { id: 'synagogue', icon: '🏛️', name: 'Community Center', desc: 'A place for everyone.', base: 4_000, power: 110 },
  { id: 'mensch', icon: '💛', name: 'Professional Mensch', desc: 'Kindness at an incredible scale.', base: 25_000, power: 560 }
];

const quotes = [
  ['The world is sustained by three things: Torah, service, and acts of loving-kindness.', 'Pirkei Avot 1:2'],
  ['It is not your duty to finish the work, but neither are you free to neglect it.', 'Pirkei Avot 2:16'],
  ['Who is wise? One who learns from every person.', 'Pirkei Avot 4:1'],
  ['The highest form of wisdom is kindness.', 'Talmud, Berakhot 17a']
];

const achievements = [
  ['first', '🌱', 'First Light', 'Do your first mitzvah.'],
  ['ten', '✨', 'Getting Started', 'Reach 10 points.'],
  ['hundred', '💯', 'Triple Digits', 'Reach 100 points.'],
  ['thousand', '🌟', 'Four Figures', 'Reach 1,000 points.'],
  ['clicker', '👆', 'Keep Clicking', 'Make 100 clicks.'],
  ['helper', '🤝', 'Many Hands', 'Hire your first helper.'],
  ['upgrade', '🛠️', 'A Little Better', 'Buy an upgrade.'],
  ['fiveHelpers', '🏘️', 'Growing Together', 'Hire five helpers.'],
  ['tenThousand', '🌅', 'Big Difference', 'Reach 10,000 points.'],
  ['allUpgrades', '🎓', 'Fully Equipped', 'Buy every upgrade.'],
  ['event', '🕯️', 'Light the Way', 'Join a community moment.'],
  ['million', '🏆', 'Professional Mensch', 'Reach 1,000,000 points.']
];

const milestones = [100, 1_000, 10_000, 100_000, 1_000_000];

function loadState() {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  const result = { ...freshState(), ...(saved && typeof saved === 'object' ? saved : {}) };
  result.points = Math.max(0, Number(result.points) || 0);
  result.totalEarned = Math.max(0, Number(result.totalEarned) || 0);
  result.clicks = Math.max(0, Number(result.clicks) || 0);
  result.clickPower = Math.max(1, Number(result.clickPower) || 1);
  result.helperMultiplier = Math.max(1, Number(result.helperMultiplier) || 1);
  result.upgrades = Array.isArray(result.upgrades) ? result.upgrades : [];
  result.achievements = Array.isArray(result.achievements) ? result.achievements : [];
  result.helpers = result.helpers && typeof result.helpers === 'object' ? result.helpers : {};
  return result;
}

function save() {
  state.lastSaved = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function addPoints(amount) {
  state.points += amount;
  state.totalEarned += amount;
}

function helperCount() {
  return helpers.reduce((total, helper) => total + (Number(state.helpers[helper.id]) || 0), 0);
}

function pointsPerSecond() {
  return helpers.reduce((total, helper) => total + (state.helpers[helper.id] || 0) * helper.power, 0) * state.helperMultiplier;
}

function helperCost(helper) {
  return Math.floor(helper.base * Math.pow(1.15, state.helpers[helper.id] || 0));
}

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2_400);
}

function playClick() {
  if (!state.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.08);
  } catch {
    // Audio is optional; the game should still work when the browser blocks it.
  }
}

function render() {
  const rate = pointsPerSecond();
  $('score').textContent = format(state.points);
  $('perSecond').textContent = format(rate);
  $('clickPower').textContent = format(state.clickPower);
  $('totalClicks').textContent = format(state.clicks);
  $('totalEarned').textContent = format(state.totalEarned);
  $('buildingsOwned').textContent = helperCount();
  $('helperCount').textContent = helperCount();
  $('upgradeCount').textContent = state.upgrades.length;

  const next = milestones.find((milestone) => state.points < milestone) || milestones.at(-1);
  const previous = milestones[milestones.indexOf(next) - 1] || 0;
  const progress = Math.max(0, Math.min(100, ((state.points - previous) / (next - previous)) * 100));
  $('milestoneLabel').textContent = `${format(next)} points`;
  $('progressText').textContent = `${format(state.points)} / ${format(next)}`;
  $('progressBar').style.width = `${progress}%`;

  renderUpgrades();
  renderHelpers();
  renderAchievements();
  updateEvent();
}

function renderUpgrades() {
  $('upgradeList').innerHTML = upgrades.map((upgrade) => {
    const bought = state.upgrades.includes(upgrade.id);
    const affordable = !bought && state.points >= upgrade.cost;
    return `<div class="upgrade-item ${affordable ? 'can-buy' : ''} ${bought ? 'bought' : ''}" data-upgrade="${upgrade.id}">
      <div class="item-icon">${upgrade.icon}</div>
      <div class="item-copy"><strong>${upgrade.name}</strong><span>${bought ? 'Unlocked' : upgrade.desc}</span></div>
      <button class="buy-button" type="button" ${bought || !affordable ? 'disabled' : ''}>${bought ? '✓' : format(upgrade.cost)}</button>
    </div>`;
  }).join('');
}

function renderHelpers() {
  $('helperList').innerHTML = helpers.map((helper) => {
    const count = state.helpers[helper.id] || 0;
    const cost = helperCost(helper);
    const affordable = state.points >= cost;
    return `<div class="helper-item ${affordable ? 'can-buy' : ''}" data-helper="${helper.id}">
      <div class="item-icon">${helper.icon}</div>
      <div class="item-copy"><strong>${helper.name} <small>×${count}</small></strong><span>${helper.desc} +${format(helper.power)}/sec</span></div>
      <button class="buy-button" type="button" ${affordable ? '' : 'disabled'}>${format(cost)}</button>
    </div>`;
  }).join('');
}

function isAchievementUnlocked(id) {
  return {
    first: state.clicks >= 1,
    ten: state.points >= 10,
    hundred: state.points >= 100,
    thousand: state.points >= 1_000,
    clicker: state.clicks >= 100,
    helper: helperCount() >= 1,
    upgrade: state.upgrades.length >= 1,
    fiveHelpers: helperCount() >= 5,
    tenThousand: state.points >= 10_000,
    allUpgrades: state.upgrades.length === upgrades.length,
    event: !state.eventReady,
    million: state.points >= 1_000_000
  }[id];
}

function renderAchievements() {
  const unlocked = achievements.filter(([id]) => isAchievementUnlocked(id)).length;
  $('achievementCount').textContent = `${unlocked}/${achievements.length}`;
  $('achievementProgress').textContent = unlocked;
  $('achievementList').innerHTML = achievements.map(([id, icon, name, description]) => `<div class="achievement-item ${isAchievementUnlocked(id) ? 'unlocked' : ''}">
    <span class="achievement-icon">${icon}</span><span><strong>${name}</strong><small>${description}</small></span>
  </div>`).join('');
}

function clickMitzvah() {
  addPoints(state.clickPower);
  state.clicks += 1;
  playClick();
  const button = $('mitzvahButton');
  button.classList.remove('pop');
  void button.offsetWidth;
  button.classList.add('pop');
  $('streakText').textContent = state.clicks > 1 ? `${format(state.clicks)} mitzvot and counting ✨` : 'A good start ✨';
  render();
  save();
}

function buyUpgrade(id) {
  const upgrade = upgrades.find((item) => item.id === id);
  if (!upgrade || state.upgrades.includes(id) || state.points < upgrade.cost) return;
  state.points -= upgrade.cost;
  state.upgrades.push(id);
  if (id === 'blessing') state.clickPower *= 2;
  if (id === 'tzedakah') state.clickPower *= 3;
  if (id === 'study') state.clickPower *= 5;
  if (id === 'song') state.helperMultiplier *= 1.25;
  if (id === 'community') state.helperMultiplier *= 2;
  showToast(`${upgrade.name} unlocked.`);
  render();
  save();
}

function buyHelper(id) {
  const helper = helpers.find((item) => item.id === id);
  if (!helper) return;
  const cost = helperCost(helper);
  if (state.points < cost) return;
  state.points -= cost;
  state.helpers[id] = (state.helpers[id] || 0) + 1;
  showToast(`${helper.name} joined the community.`);
  render();
  save();
}

function communityMoment() {
  if (!state.eventReady) return;
  addPoints(100 + pointsPerSecond() * 10);
  state.eventReady = false;
  state.eventCooldown = Date.now() + EVENT_LENGTH;
  $('eventTitle').textContent = 'The candles are glowing';
  $('eventDescription').textContent = 'Thanks for showing up. Come back when the next moment is ready.';
  $('eventButton').disabled = true;
  $('eventTimer').textContent = 'thank you';
  showToast('The community came together.');
  render();
  save();
}

function updateEvent() {
  if (!state.eventReady && Date.now() >= state.eventCooldown) {
    state.eventReady = true;
    $('eventTitle').textContent = 'Light the candles';
    $('eventDescription').textContent = 'A little glow goes a long way. Come back often for community moments.';
    $('eventButton').disabled = false;
    $('eventTimer').textContent = 'ready';
  } else if (!state.eventReady) {
    $('eventTimer').textContent = `${Math.ceil((state.eventCooldown - Date.now()) / 1000)}s`;
  }
}

$('mitzvahButton').addEventListener('click', clickMitzvah);
$('eventButton').addEventListener('click', communityMoment);
$('soundToggle').addEventListener('click', () => {
  state.sound = !state.sound;
  $('soundToggle').textContent = state.sound ? '🔔' : '🔕';
  $('soundToggle').setAttribute('aria-label', state.sound ? 'Turn sound off' : 'Turn sound on');
  save();
});
$('resetButton').addEventListener('click', () => {
  if (!confirm('Start a new community from the beginning?')) return;
  localStorage.removeItem(SAVE_KEY);
  state = freshState();
  lastTick = Date.now();
  render();
  save();
});
$('quoteButton').addEventListener('click', () => {
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  $('quoteText').textContent = quote[0];
  document.querySelector('cite').textContent = `— ${quote[1]}`;
});
document.addEventListener('click', (event) => {
  const upgrade = event.target.closest('[data-upgrade]');
  const helper = event.target.closest('[data-helper]');
  if (upgrade) buyUpgrade(upgrade.dataset.upgrade);
  if (helper) buyHelper(helper.dataset.helper);
});

setInterval(() => {
  const now = Date.now();
  const seconds = Math.min((now - lastTick) / 1_000, 5);
  lastTick = now;
  const passiveGain = pointsPerSecond() * seconds;
  if (passiveGain) addPoints(passiveGain);
  render();
  save();
}, 1_000);

$('soundToggle').textContent = state.sound ? '🔔' : '🔕';
render();
