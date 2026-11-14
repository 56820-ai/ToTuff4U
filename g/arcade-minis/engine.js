(() => {
"use strict";
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),mode=document.body.dataset.mode;
const scoreEl=document.getElementById("score"),statusEl=document.getElementById("status"),helpEl=document.getElementById("help");
let w=900,h=560,score=0,over=false,started=false,last=0,keys={},touchX=0;
function resize(){const r=canvas.getBoundingClientRect();const d=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.floor(r.width*d));canvas.height=Math.max(1,Math.floor(r.height*d));ctx.setTransform(d,0,0,d,0,0);w=r.width;h=r.height;}
addEventListener("resize",resize);resize();
const rand=(a,b)=>Math.random()*(b-a)+a,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function setScore(n){score=Math.max(0,Math.floor(n));scoreEl.textContent=score;}
function text(t,x,y,size=22,color="#fff",align="left"){ctx.fillStyle=color;ctx.font="700 "+size+"px system-ui";ctx.textAlign=align;ctx.fillText(t,x,y);}
function rect(x,y,a,b,c){ctx.fillStyle=c;ctx.fillRect(x,y,a,b);}
function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function bg(){rect(0,0,w,h,"#091329");}
function finish(msg){over=true;statusEl.textContent=msg+" — press R or tap Restart";document.getElementById("restart").hidden=false;}
function reset(){score=0;over=false;started=true;last=0;statusEl.textContent="";document.getElementById("restart").hidden=true;init();}
document.getElementById("restart").onclick=reset;
addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();if(e.key.toLowerCase()==="r"&&over)reset();});
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
canvas.addEventListener("pointerdown",e=>{const r=canvas.getBoundingClientRect();touchX=e.clientX-r.left;keys[touchX<r.width/2?"arrowleft":"arrowright"]=true;});
addEventListener("pointerup",()=>{keys.arrowleft=false;keys.arrowright=false;});
let state={};
function init(){
 if(mode==="racer")state={lane:1,ob:[],tick:0,road:0};
 if(mode==="hopper")state={x:w/2,y:h-90,vy:0,plats:[],camera:0,ground:h-40};
 if(mode==="asteroids")state={x:w/2,y:h-65,bullets:[],rocks:[],tick:0};
 if(mode==="maze")state={map:["##########","#..#.....#","#..#.#...#","#....#.#.#","###..#.#.#","#....#...#","#.####.###","#........#","#.##.##..#","##########"],x:1,y:1,gems:[[3,1],[7,2],[2,5],[7,7],[5,8]],exit:[8,8],moves:0};
 if(mode==="colors")state={target:Math.floor(rand(0,6)),time:30,tiles:Array.from({length:9},()=>Math.floor(rand(0,6))),tick:0};
 if(mode==="racer")state.ob=[];
 if(mode==="hopper"){state.plats=[{x:w/2-70,y:h-35,w:140},{x:w/2-30,y:h-130,w:110},{x:w/2+80,y:h-225,w:100},{x:w/2-150,y:h-320,w:100}];state.y=h-90;}
}
const colors=["#ff477e","#35d9ff","#ffd447","#a78bfa","#4ade80","#ff914d"];
function drawRacer(dt){
 const s=state,roadW=Math.min(460,w*.72),left=(w-roadW)/2,laneW=roadW/3;
 s.road=(s.road+dt*260)%70;rect(left,0,roadW,h,"#172c39");
 for(let y=-70+s.road;y<h;y+=70)for(let i=1;i<3;i++)rect(left+i*laneW-3,y,6,38,"#9bb4bf");
 s.tick+=dt;if(s.tick>Math.max(.32,.85-score/1000)){s.tick=0;s.ob.push({lane:Math.floor(rand(0,3)),y:-60});}
 for(const o of s.ob){o.y+=dt*(260+Math.min(220,score*.35));rect(left+o.lane*laneW+laneW*.2,o.y,laneW*.6,46,"#ff5b61");rect(left+o.lane*laneW+laneW*.28,o.y+7,laneW*.44,10,"#ffc5ca");}
 s.ob=s.ob.filter(o=>o.y<h+60);
 if(keys.arrowleft||keys.a){s.lane=Math.max(0,s.lane-1);keys.arrowleft=keys.a=false;}if(keys.arrowright||keys.d){s.lane=Math.min(2,s.lane+1);keys.arrowright=keys.d=false;}
 const px=left+s.lane*laneW+laneW/2,py=h-86;rect(px-19,py,38,62,"#44d7ff");rect(px-12,py+8,24,15,"#e8fbff");
 if(s.ob.some(o=>o.lane===s.lane&&o.y+46>py+8&&o.y<py+55)){finish("Crash! Score: "+score);return;}
 setScore(score+dt*10);
 text("← → / A D to switch lanes",w/2,30,15,"#b7d8e8","center");
}
function drawHopper(dt){
 const s=state;rect(0,h-28,w,28,"#1b594c");
 if(keys.arrowleft||keys.a)s.x-=300*dt;if(keys.arrowright||keys.d)s.x+=300*dt;
 if((keys[" "]||keys.arrowup||keys.w)&&Math.abs(s.vy)<1&&s.y>h-120)s.vy=-520;
 s.vy+=1100*dt;s.y+=s.vy*dt;s.x=clamp(s.x,14,w-14);
 for(const p of s.plats){if(s.vy>0&&s.y+18>=p.y&&s.y+18<=p.y+16&&s.x>p.x-10&&s.x<p.x+p.w+10){s.y=p.y-18;s.vy=-500;}}
 if(s.y<h*.38){const dy=h*.38-s.y;s.y=h*.38;s.camera+=dy;for(const p of s.plats)p.y+=dy;setScore(s.camera/8);}
 s.plats=s.plats.filter(p=>p.y<h+30);while(s.plats.length<7){const top=Math.min(...s.plats.map(p=>p.y));s.plats.push({x:rand(10,w-120),y:top-rand(75,115),w:rand(75,125)});}
 for(const p of s.plats)rect(p.x,p.y,p.w,12,"#55e6a5");
 circle(s.x,s.y,17,"#ffd447");rect(s.x-11,s.y-4,22,5,"#14233b");
 if(s.y>h+30){finish("You fell! Height: "+score);return;}
 text("Move: ← → / A D · Jump: Space / ↑",w/2,30,15,"#b7d8e8","center");
}
function drawAsteroids(dt){
 const s=state;s.tick+=dt;if(s.tick>.7){s.tick=0;s.rocks.push({x:rand(25,w-25),y:-25,r:rand(13,27),v:rand(90,180)});}
 if(keys.arrowleft||keys.a)s.x-=330*dt;if(keys.arrowright||keys.d)s.x+=330*dt;s.x=clamp(s.x,20,w-20);
 if(keys[" "]&&(!s.lastShot||performance.now()-s.lastShot>230)){s.bullets.push({x:s.x,y:s.y-20});s.lastShot=performance.now();}
 for(const b of s.bullets)b.y-=470*dt;s.bullets=s.bullets.filter(b=>b.y>-20);
 for(const r of s.rocks)r.y+=r.v*dt;
 for(const b of s.bullets){const i=s.rocks.findIndex(r=>Math.hypot(r.x-b.x,r.y-b.y)<r.r+5);if(i>=0){s.rocks.splice(i,1);b.y=-40;setScore(score+10);}}
 s.rocks=s.rocks.filter(r=>r.y<h+35);
 for(const r of s.rocks){circle(r.x,r.y,r.r,"#9b87ff");circle(r.x-5,r.y-5,r.r*.25,"#d9d1ff");if(Math.hypot(r.x-s.x,r.y-s.y)<r.r+14){finish("Ship destroyed! Score: "+score);return;}}
 rect(s.x-14,s.y-12,28,27,"#48e3ff");ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(s.x,s.y-31);ctx.lineTo(s.x-10,s.y-10);ctx.lineTo(s.x+10,s.y-10);ctx.fill();
 for(const b of s.bullets)rect(b.x-2,b.y-8,4,13,"#ffdf65");
 text("Move: ← → / A D · Fire: Space",w/2,30,15,"#b7d8e8","center");
}
function drawMaze(){
 const s=state,cell=Math.min((w-30)/10,(h-90)/10),ox=(w-cell*10)/2,oy=(h-cell*10)/2;
 for(let y=0;y<10;y++)for(let x=0;x<10;x++)rect(ox+x*cell,oy+y*cell,cell-2,cell-2,s.map[y][x]==="#"?"#344d73":"#11243e");
 for(const [gx,gy] of s.gems)circle(ox+gx*cell+cell/2,oy+gy*cell+cell/2,cell*.18,"#ffd447");
 rect(ox+s.exit[0]*cell+cell*.2,oy+s.exit[1]*cell+cell*.2,cell*.6,cell*.6,"#4ade80");
 circle(ox+s.x*cell+cell/2,oy+s.y*cell+cell/2,cell*.28,"#ff5e9b");
 let dx=0,dy=0;if(keys.arrowleft||keys.a){dx=-1;keys.arrowleft=keys.a=false;}else if(keys.arrowright||keys.d){dx=1;keys.arrowright=keys.d=false;}else if(keys.arrowup||keys.w){dy=-1;keys.arrowup=keys.w=false;}else if(keys.arrowdown||keys.s){dy=1;keys.arrowdown=keys.s=false;}
 if(dx||dy){const nx=s.x+dx,ny=s.y+dy;if(s.map[ny]?.[nx]!== "#"){s.x=nx;s.y=ny;s.moves++;const i=s.gems.findIndex(g=>g[0]===nx&&g[1]===ny);if(i>=0){s.gems.splice(i,1);setScore(score+25);}if(nx===s.exit[0]&&ny===s.exit[1]&&s.gems.length===0)finish("Maze cleared!");}}
 text("Collect every gem, then reach the green exit",w/2,34,15,"#b7d8e8","center");text("Gems left: "+s.gems.length,w/2,h-18,16,"#ffd447","center");
}
function drawColors(dt){
 const s=state;s.time-=dt;if(s.time<=0){s.time=0;finish("Time's up! Score: "+score);return;}
 s.tick+=dt;rect(0,0,w,h,"#101b37");text("TAP THE TARGET COLOR",w/2,68,26,"#fff","center");text(colors[s.target].toUpperCase(),w/2,116,23,colors[s.target],"center");
 const size=Math.min(100,(w-90)/3),gap=15,startX=(w-(size*3+gap*2))/2,startY=160;
 s.tiles.forEach((c,i)=>{const x=startX+(i%3)*(size+gap),y=startY+Math.floor(i/3)*(size+gap);rect(x,y,size,size,colors[c]);ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.strokeRect(x,y,size,size);});
 text("Time: "+Math.ceil(s.time)+"s",w/2,h-28,19,"#fff","center");
 if(s.tick>.75){s.tick=0;s.target=Math.floor(rand(0,6));}
}
function init(){if(mode==="racer")state={lane:1,ob:[],tick:0,road:0};if(mode==="hopper"){state={x:w/2,y:h-90,vy:0,camera:0,plats:[{x:w/2-70,y:h-35,w:140},{x:w/2-30,y:h-130,w:110},{x:w/2+80,y:h-225,w:100},{x:w/2-150,y:h-320,w:100}]};}if(mode==="asteroids")state={x:w/2,y:h-65,bullets:[],rocks:[],tick:0};if(mode==="maze")state={map:["##########","#..#.....#","#..#.#...#","#....#.#.#","###..#.#.#","#....#...#","#.####.###","#........#","#.##.##..#","##########"],x:1,y:1,gems:[[3,1],[7,2],[2,5],[7,7],[5,8]],exit:[8,8]};if(mode==="colors")state={target:Math.floor(rand(0,6)),time:30,tiles:Array.from({length:9},()=>Math.floor(rand(0,6))),tick:0};}
function frame(t){if(!last)last=t;const dt=Math.min(.04,(t-last)/1000);last=t;bg();if(!over&&started){if(mode==="racer")drawRacer(dt);if(mode==="hopper")drawHopper(dt);if(mode==="asteroids")drawAsteroids(dt);if(mode==="maze")drawMaze();if(mode==="colors")drawColors(dt);}else if(!started){text(document.title,w/2,h/2-22,32,"#fff","center");text("Press Start to play",w/2,h/2+25,18,"#b7d8e8","center");}requestAnimationFrame(frame);}
document.getElementById("start").onclick=()=>{reset();};
canvas.addEventListener("click",e=>{if(mode!=="colors"||!started||over)return;const r=canvas.getBoundingClientRect(),size=Math.min(100,(w-90)/3),gap=15,sx=(w-(size*3+gap*2))/2,sy=160;const col=Math.floor((e.clientX-r.left-sx)/(size+gap)),row=Math.floor((e.clientY-r.top-sy)/(size+gap));if(col<0||col>2||row<0||row>2)return;const idx=row*3+col;if(state.tiles[idx]===state.target){setScore(score+10);state.target=Math.floor(rand(0,6));}else{setScore(Math.max(0,score-5));}}
);
init();requestAnimationFrame(frame);
})();