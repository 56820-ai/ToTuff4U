// Arcade Atlas leaderboard — top three Neon scores for each game.
// Retry commit: keep the medal rows and game-thumbnail presentation.
const ARCADE_ATLAS_API="https://br-flat-grass-bdhxbnam-arcadeapi.compute.c-8.us-east-2.aws.neon.tech";
const IMAGE_ROOT="/ToTuff4U/duckmath-site/assets/img/";
const MEDALS=["🥇","🥈","🥉"];
function gameImageCandidates(row){
 const key=String(row.game_key||row.game_title||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
 return [row.game_image,key?IMAGE_ROOT+"games/"+key+".webp":"",key?IMAGE_ROOT+key+".webp":"",IMAGE_ROOT+"duck.webp"].filter(Boolean);
}
function formatLeaderboardScore(value){
 if(value===null||value===undefined)return "—";
 const raw=String(value);
 if(/^\d+(\.\d+)?$/.test(raw)){const parts=raw.split(".");const whole=Number(parts[0]).toLocaleString("en-US");return parts[1]?whole+"."+parts[1].slice(0,3):whole;}
 return raw;
}
function makeScoreCard(row,rank){
 const card=document.createElement("article");card.className="score-card";
 const rankEl=document.createElement("div");rankEl.className="rank-medal";rankEl.textContent=MEDALS[rank-1]||String(rank);
 const imageWrap=document.createElement("div");imageWrap.className="game-icon-container";
 const image=document.createElement("img");image.className="game-icon";image.alt=(row.game_title||"Game")+" game image";
 const candidates=gameImageCandidates(row);let index=0;image.onerror=()=>{index++;if(index<candidates.length)image.src=candidates[index];};image.src=candidates[0];imageWrap.append(image);
 const text=document.createElement("div");text.className="card-text-align";
 const player=document.createElement("h3");player.className="card-text player-name";player.textContent=row.player_name||"Unknown player";
 const game=document.createElement("p");game.className="card-text game-name";game.textContent=row.game_title||"Unknown game";
 const date=document.createElement("p");date.className="card-text score-date";date.textContent=row.created_at?new Date(row.created_at).toLocaleDateString():"";
 text.append(player,game,date);
 const score=document.createElement("div");score.className="leaderboard-score";score.textContent=formatLeaderboardScore(row.score);
 card.append(rankEl,imageWrap,text,score);return card;
}
async function loadArcadeAtlasLeaderboard(){
 const list=document.getElementById("leaderboard-list");if(!list)return;
 const status=document.createElement("p");status.className="leaderboard-status";status.textContent="Loading live scores…";list.append(status);
 try{
  const response=await fetch(ARCADE_ATLAS_API+"/scores",{method:"GET",headers:{Accept:"application/json"},cache:"no-store"});
  if(!response.ok)throw new Error("Leaderboard request failed ("+response.status+").");
  const rows=await response.json();if(!Array.isArray(rows))throw new Error("Invalid leaderboard response.");
  status.remove();if(!rows.length){status.textContent="No scores have been submitted yet.";list.append(status);return;}
  const grouped=new Map();
  rows.forEach(row=>{const key=String(row.game_key||row.game_title||"other");if(!grouped.has(key))grouped.set(key,[]);if(grouped.get(key).length<3)grouped.get(key).push(row);});
  grouped.forEach(gameRows=>{
   const heading=document.createElement("h2");heading.className="leaderboard-game";heading.textContent=gameRows[0].game_title||"Game";list.append(heading);
   gameRows.forEach((row,index)=>list.append(makeScoreCard(row,index+1)));
  });
 }catch(error){console.error("Arcade Atlas leaderboard:",error);status.textContent="The live leaderboard is temporarily unavailable. Please refresh to try again.";}
}
document.addEventListener("DOMContentLoaded",loadArcadeAtlasLeaderboard);
