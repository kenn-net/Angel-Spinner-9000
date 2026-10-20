const symbols = ["❤️","🌹","⭐","🍒","☕","💎","💌","🧸","🎀"];
const compliments = [
  "Your smile makes even an ordinary day much much better",
  "You listen in a way that makes people feel heard",
  "You're a joy to have as a friend",
  "You're more appreciated than you know",
  "You're a genuinely thoughtful person",
  "You make ordinary days feel a little brighter",
  "You're someone people can count on",
  "You're kinder than you realize",
  "You're someone people can count on",
  "You're more talented than you give yourself credit for",
  "You're doing your best, and that counts",
  "I'm genuinely glad I got to know you",
  "Thanks for being someone I can be myself around",
  "You make even the most random conversations memorable",
  "You're a good friend, and I hope life treats you kindly"
];
const SAVE_KEY = "friendshipSlotGame_v1";
const DAILY_SPINS = 3;
const DAILY_BONUS_SPIN_LIMIT = 2;
// Paste your deployed Google Apps Script Web App URL here.
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxrSl5yroei1M-wGKQgsOKXUyliM5I7ft9ThkeF4OY4gOXbjS_bQr7MnkoV53AtoQF0OA/exec";
const DEFAULT_STATE = { spins: DAILY_SPINS, points: 0, wins: 0, bonusSpins: 0 };

function getLocalDateKey(date = new Date()){
  // Uses the player's local calendar date, e.g. "2026-10-16".
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadGameState(){
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if(saved && typeof saved === "object"){
      const today = getLocalDateKey();
      const sameDay = saved.lastPlayedDate === today;

      return {
        spins: sameDay && Number.isFinite(saved.spins) ? Math.max(0, saved.spins) : DAILY_SPINS,
        points: Number.isFinite(saved.points) ? Math.max(0, saved.points) : 0,
        wins: Number.isFinite(saved.wins) ? Math.max(0, saved.wins) : 0,
        bonusSpins: sameDay && Number.isFinite(saved.bonusSpins)
          ? Math.min(DAILY_BONUS_SPIN_LIMIT, Math.max(0, saved.bonusSpins))
          : 0,
        lastPlayedDate: today
      };
    }
  } catch (error) {
    console.warn("Could not load saved game data:", error);
  }
  return { ...DEFAULT_STATE, lastPlayedDate: getLocalDateKey() };
}

let { spins, points, wins, bonusSpins, lastPlayedDate } = loadGameState();
let busy = false;
const $ = id => document.getElementById(id);

function saveGameState(){
  try {
    lastPlayedDate = getLocalDateKey();
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      spins, points, wins, bonusSpins, lastPlayedDate
    }));
  } catch (error) {
    console.warn("Could not save game data locally:", error);
  }
}

function refreshDailySpins(){
  const today = getLocalDateKey();
  if(lastPlayedDate !== today){
    spins = DAILY_SPINS;
    bonusSpins = 0;
    lastPlayedDate = today;
    saveGameState();
  }
}

function update(){
  // Refresh daily spins, then persist and update the UI.
  refreshDailySpins();
  saveGameState();
  $("spins").textContent = spins;
  $("points").textContent = points;
  $("wins").textContent = wins;
  $("spinBtn").disabled = busy || spins <= 0;
  document.querySelectorAll("[data-cost]").forEach(btn => btn.disabled = points < Number(btn.dataset.cost));
  const next = [10,20,35,50].find(n => points < n);
  $("progressBar").style.width = Math.min(100, points/50*100) + "%";
  $("progressText").textContent = next ? `${points} points saved · ${next-points} more until the next shop reward.` : `${points} points saved · You can redeem any shop reward!`;
}

function award(title, text, pts=0){
  // Award points and increment wins, then update the result display
  points += pts; wins++;
  $("resultTitle").textContent = title;
  $("resultText").textContent = text + (pts ? ` (+${pts} Friend Points)` : "");
}

function randomSymbol(){
  // Return a random symbol from the symbols array
  return symbols[Math.floor(Math.random()*symbols.length)]
}


async function logSlotResult(record){
  if (!GOOGLE_SHEETS_WEB_APP_URL ||
      GOOGLE_SHEETS_WEB_APP_URL === "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") {
    console.info("Google Sheets logging is not configured yet.", record);
    return;
  }

  try {
    // no-cors avoids a browser CORS preflight for the Apps Script endpoint.
    // The response is opaque, so this confirms only that the request was sent,
    // not that Google Sheets successfully appended the row.
    await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(record)
    });
  } catch (error) {
    console.warn("Could not send this slot result to Google Sheets:", error);
  }
}

async function logRedemption(record){
  if (!GOOGLE_SHEETS_WEB_APP_URL ||
      GOOGLE_SHEETS_WEB_APP_URL === "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") {
    console.info("Google Sheets redemption logging is not configured yet.", record);
    return;
  }
  try {
    await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...record, recordType: "redemption" })
    });
  } catch (error) {
    console.warn("Could not send this redemption to Google Sheets:", error);
  }
}

function spin(){
  // Refresh daily spins before checking whether a spin is available.
  refreshDailySpins();
  // Handle the spin action: animate reels and determine the outcome
  if(busy || spins<=0) return;
  busy=true; spins--; update();
  const reels=[ $("r0"), $("r1"), $("r2") ];
  reels.forEach(el=>el.classList.add("spin"));
  let ticks=0;
  const timer=setInterval(()=>{
    reels.forEach(el=>el.textContent=randomSymbol());
    ticks++;
    if(ticks>=48){
      clearInterval(timer);
      const result=[randomSymbol(),randomSymbol(),randomSymbol()];
      reels.forEach((el,i)=>{el.textContent=result[i];el.classList.remove("spin")});
      const pointsBeforeSpin = points;
      settle(result);
      busy=false;
      update();
      // Log the completed spin without blocking the game UI.
      logSlotResult({
        timestamp: new Date().toISOString(),
        symbols: result,
        resultTitle: $("resultTitle").textContent,
        resultMessage: $("resultText").textContent,
        pointsEarned: points - pointsBeforeSpin,
        totalPoints: points,
        spinsRemaining: spins,
        bonusSpinsEarnedToday: bonusSpins,
        totalPrizesWon: wins
      });
    }
  },85);
}

function settle(a){
  // Determine the outcome of the spin and award points accordingly
  const counts={}; a.forEach(s=>counts[s]=(counts[s]||0)+1);
  const triple=a[0]===a[1]&&a[1]===a[2];
  if(triple){
    const s=a[0];
    if(s==="💎"){award("JACKPOT!! 💎💎💎","A mystery treat or fun activity is yours. 🎁",50)}
    else if(s==="❤️"){award("BONUS ❤️❤️❤️","You choose what you want me to do! 🎉",25)}
    else if(s==="🌹"){award("A ROSE FOR A REAL ONE 🌹🌹🌹","Redeem a heartfelt appreciation note. 💌",15)}
    else if(s==="☕"){award("A DRINK TO REMEMBER ☕☕☕","You’ve won a treat: any drink of your choice. ☕🎉",15)}
    else if(s==="🍒"){award("CAMERA ROLL BONUS 🍒🍒🍒","A funny selfie or photo is coming your way. 📸",10)}
    else if(s==="💌"){award("A NOTE FOR MY FRIEND 💌💌💌","You’ve won a voice note to remind you that you’re appreciated. 💌",15)}
    else if(s==="🧸"){award("YOU’VE GOT A LITTLE FRIEND 🧸🧸🧸","Redeem a stuffed toy that reminds me of you. 🎁",15)}
    else if(s==="🎀"){award("SURPRISE, ANGEL 🎀🎀🎀","You get to choose a fun little surprise from me. 🎁",20)}
    else if(s==="⭐"){
      const gained=bonusSpins<DAILY_BONUS_SPIN_LIMIT;
      if(gained){bonusSpins++;spins++;award("BONUS STAR ⭐⭐⭐","A bonus spin has been added! (Daily bonus-spin cap: 2.)",10)}
      else award("THREE WISHING STARS ⭐⭐⭐","You've reached today's bonus-spin cap, so here's extra sparkle instead. ✨",10);
    }
  }else{
    const pair=Object.values(counts).some(n=>n===2);
    if(pair) award("A LITTLE WIN 🎉","Two symbols match! Here’s a message: "+compliments[Math.floor(Math.random()*compliments.length)],5);
    else award("A LITTLE NOTE FOR YOU 💌",compliments[Math.floor(Math.random()*compliments.length)],1);
  }
  if(spins===0) $("resultText").textContent += " That’s all today’s spins—come back tomorrow for more slot machine!. 🎉";
}



// Event listeners for spin and reset buttons, and shop reward buttons
$("spinBtn").addEventListener("click",spin);
$("resetBtn").addEventListener("click",()=>{
  if(busy)return;
  spins=3;points=0;wins=0;bonusSpins=0;
  $("resultTitle").textContent="Ready, little angel?";
  $("resultText").textContent="Game reset! Tap spin and see what your fortune has in store! 🍀";
  [$("r0"),$("r1"),$("r2")].forEach((el,i)=>el.textContent=["❤️","🌹","⭐"][i]);
  update();
});
document.querySelectorAll("[data-cost]").forEach(btn=>btn.addEventListener("click",()=>{
  const cost=Number(btn.dataset.cost), prize=btn.dataset.prize;
  if(!Number.isFinite(cost) || cost < 0 || points < cost)return;
  points-=cost;
  $("resultTitle").textContent="Reward redeemed! 🎀";
  $("resultText").textContent=`You've redeemed your reward: ${prize}. The reward is yours for the taking! 🎉`;
  update();
  logRedemption({
    timestamp: new Date().toISOString(),
    reward: prize,
    pointsSpent: cost,
    remainingPoints: points,
    spinsRemaining: spins,
    bonusSpinsEarnedToday: bonusSpins,
    totalPrizesWon: wins
  });
}));
update();
