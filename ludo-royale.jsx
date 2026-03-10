import { useState, useMemo, useCallback } from "react";

const CELL = 38, GAP = 1, BPX = 15 * (CELL + GAP) + GAP;
const C = {
  red: { bg:'#D32F2F', lt:'#EF5350', dk:'#B71C1C' },
  green: { bg:'#2E7D32', lt:'#66BB6A', dk:'#1B5E20' },
  yellow: { bg:'#F9A825', lt:'#FFEE58', dk:'#F57F17' },
  blue: { bg:'#1565C0', lt:'#42A5F5', dk:'#0D47A1' },
};
const gp = (r,c) => [GAP+c*(CELL+GAP), GAP+r*(CELL+GAP)];
const ORDER = ['red','green','yellow','blue'];

const HOME_BASE = {
  red:[[2,2],[2,3],[3,2],[3,3]], green:[[2,11],[2,12],[3,11],[3,12]],
  yellow:[[11,11],[11,12],[12,11],[12,12]], blue:[[11,2],[11,3],[12,2],[12,3]],
};
const HOME_COLS = {
  red:[[7,1],[7,2],[7,3],[7,4],[7,5]], green:[[1,7],[2,7],[3,7],[4,7],[5,7]],
  yellow:[[7,13],[7,12],[7,11],[7,10],[7,9]], blue:[[13,7],[12,7],[11,7],[10,7],[9,7]],
};
const STARTS = { red:[6,1], green:[1,8], yellow:[8,13], blue:[13,6] };
const SAFE = [[6,1],[2,6],[1,8],[6,12],[8,13],[12,8],[13,6],[8,2]];
const SAFE_SET = new Set(SAFE.map(s=>s.join(',')));

const TRACK=[
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];
const SI = { red:0, green:13, yellow:26, blue:39 };
const SAFE_IDX = new Set([0,8,13,21,26,34,39,47]);

function isPath(r,c){return(r<=5&&c>=6&&c<=8)||(r>=9&&c>=6&&c<=8)||(r>=6&&r<=8&&c<=5)||(r>=6&&r<=8&&c>=9)}

function getTkPos(color, tk) {
  if(tk.st==='home'){const[r,c]=HOME_BASE[color][tk.id];const[x,y]=gp(r,c);return[x+CELL/2,y+CELL/2]}
  if(tk.st==='active'){const[r,c]=TRACK[tk.tp];const[x,y]=gp(r,c);return[x+CELL/2,y+CELL/2]}
  if(tk.st==='hcol'){const[r,c]=HOME_COLS[color][tk.hp];const[x,y]=gp(r,c);return[x+CELL/2,y+CELL/2]}
  if(tk.st==='fin'){const o={red:[-14,-14],green:[14,-14],yellow:[14,14],blue:[-14,14]};const[x,y]=gp(7,7);return[x+CELL/2+o[color][0],y+CELL/2+o[color][1]]}
  return[0,0];
}

const initTk = () => Object.fromEntries(ORDER.map(c=>[c,[0,1,2,3].map(i=>({id:i,st:'home',tp:-1,hp:-1}))]));

// Pawn SVG path component
function Pawn({cx,cy,color,moveable,onClick}){
  const col=C[color];
  return(
    <g style={{cursor:moveable?'pointer':'default'}} onClick={moveable?onClick:undefined}>
      {moveable && <>
        <circle cx={cx} cy={cy+2} r={0} fill="none" stroke="#FFF" strokeWidth={2.5}>
          <animate attributeName="r" values="17;22;17" dur="0.7s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.9;0.3;0.9" dur="0.7s" repeatCount="indefinite"/>
        </circle>
      </>}
      {/* Shadow */}
      <ellipse cx={cx+1} cy={cy+10} rx={10} ry={4.5} fill="rgba(0,0,0,0.18)"/>
      {/* Base */}
      <ellipse cx={cx} cy={cy+6} rx={10} ry={4.5} fill={col.dk}/>
      <ellipse cx={cx} cy={cy+5} rx={10} ry={4.5} fill={col.bg}/>
      {/* Body */}
      <path d={`M${cx-8},${cy+3.5} Q${cx-6},${cy-5} ${cx-4.5},${cy-8} L${cx+4.5},${cy-8} Q${cx+6},${cy-5} ${cx+8},${cy+3.5} Z`}
        fill={col.bg} stroke={col.dk} strokeWidth={0.7}/>
      {/* Neck ring */}
      <ellipse cx={cx} cy={cy-7} rx={5.5} ry={2.2} fill={col.dk} opacity={0.45}/>
      {/* Head */}
      <circle cx={cx} cy={cy-12} r={6.5} fill={col.bg} stroke={col.dk} strokeWidth={0.8}/>
      {/* Head shine */}
      <circle cx={cx-2} cy={cy-14} r={2.5} fill="rgba(255,255,255,0.5)"/>
      {/* Body shine */}
      <path d={`M${cx-3},${cy+2} Q${cx-2},${cy-4} ${cx-1.5},${cy-7} L${cx+0.5},${cy-7} Q${cx},${cy-4} ${cx+1},${cy+2} Z`}
        fill="rgba(255,255,255,0.18)"/>
      {/* Invisible hit area for clicks */}
      <rect x={cx-15} y={cy-22} width={30} height={36} fill="transparent" style={{cursor:moveable?'pointer':'default'}}/>
    </g>
  );
}

export default function LudoRoyale(){
  const[tokens,setTokens]=useState(initTk);
  const[turn,setTurn]=useState('red');
  const[dice,setDice]=useState(null);
  const[rolling,setRolling]=useState(false);
  const[msg,setMsg]=useState("Red's turn — Roll the dice!");
  const[moveIds,setMoveIds]=useState([]);

  const getValid=useCallback((color,val)=>{
    const tks=tokens[color]; const moves=[]; const si=SI[color];
    tks.forEach(tk=>{
      if(tk.st==='home'&&val===6){
        if(!tks.some(t=>t.id!==tk.id&&t.st==='active'&&t.tp===si)) moves.push({id:tk.id,type:'enter'});
      }
      if(tk.st==='active'){
        const s=(tk.tp-si+52)%52; const ns=s+val;
        if(ns<52){const np=(si+ns)%52; if(!tks.some(t=>t.id!==tk.id&&t.st==='active'&&t.tp===np)) moves.push({id:tk.id,type:'move',to:np})}
        else if(ns<57){const hp=ns-52; if(hp>=5)moves.push({id:tk.id,type:'fin',hp});
        else if(!tks.some(t=>t.id!==tk.id&&t.st==='hcol'&&t.hp===hp))moves.push({id:tk.id,type:'hcol',hp})}
      }
      if(tk.st==='hcol'){const np=tk.hp+val; if(np>=5)moves.push({id:tk.id,type:'fin',hp:5});
      else if(!tks.some(t=>t.id!==tk.id&&t.st==='hcol'&&t.hp===np))moves.push({id:tk.id,type:'hcolm',hp:np})}
    });
    return moves;
  },[tokens]);

  const rollDice=useCallback(()=>{
    if(rolling)return; setRolling(true); setMoveIds([]);
    let c=0;
    const iv=setInterval(()=>{
      setDice(Math.floor(Math.random()*6)+1);
      if(++c>10){clearInterval(iv); const v=Math.floor(Math.random()*6)+1; setDice(v); setRolling(false);
        const moves=getValid(turn,v);
        if(!moves.length){setMsg(`${turn.charAt(0).toUpperCase()+turn.slice(1)} rolled ${v} — no moves.`);
          setTimeout(()=>{const ni=(ORDER.indexOf(turn)+1)%4;setTurn(ORDER[ni]);setDice(null);setMsg(`${ORDER[ni].charAt(0).toUpperCase()+ORDER[ni].slice(1)}'s turn — Roll the dice!`)},1000)}
        else{setMoveIds(moves.map(m=>m.id));setMsg(`Rolled ${v}! Tap a glowing pawn to move.`)}
      }
    },65);
  },[rolling,turn,getValid]);

  const doMove=useCallback((tokenId)=>{
    if(!moveIds.includes(tokenId))return; const v=dice; const moves=getValid(turn,v);
    const move=moves.find(m=>m.id===tokenId); if(!move)return;
    setTokens(prev=>{
      const next=JSON.parse(JSON.stringify(prev)); const tk=next[turn].find(t=>t.id===tokenId);
      if(move.type==='enter'){tk.st='active';tk.tp=SI[turn]}
      if(move.type==='move'){tk.tp=move.to}
      if(move.type==='hcol'){tk.st='hcol';tk.tp=-1;tk.hp=move.hp}
      if(move.type==='hcolm'){tk.hp=move.hp}
      if(move.type==='fin'){tk.st='fin';tk.tp=-1;tk.hp=5}
      if(tk.st==='active'){const[tr,tc]=TRACK[tk.tp];if(!SAFE_SET.has(`${tr},${tc}`)){
        for(const oc of ORDER.filter(x=>x!==turn))for(const ot of next[oc])
          if(ot.st==='active'&&ot.tp===tk.tp){ot.st='home';ot.tp=-1}}}
      return next;
    });
    setMoveIds([]);
    if(v===6){setDice(null);setMsg(`${turn.charAt(0).toUpperCase()+turn.slice(1)} rolled 6 — bonus turn!`)}
    else{const ni=(ORDER.indexOf(turn)+1)%4;setTurn(ORDER[ni]);setDice(null);
      setMsg(`${ORDER[ni].charAt(0).toUpperCase()+ORDER[ni].slice(1)}'s turn — Roll the dice!`)}
  },[dice,turn,moveIds,getValid]);

  const nextTurn=useCallback(()=>{
    const ni=(ORDER.indexOf(turn)+1)%4;setTurn(ORDER[ni]);setDice(null);setMoveIds([]);
    setMsg(`${ORDER[ni].charAt(0).toUpperCase()+ORDER[ni].slice(1)}'s turn — Roll the dice!`);
  },[turn]);

  // Board (static)
  const board=useMemo(()=>{
    const e=[];
    e.push(<rect key="bg" x={0} y={0} width={BPX} height={BPX} fill="#FAF6ED" rx={6} stroke="#B8860B" strokeWidth={2}/>);
    // Home bases
    for(const[color,[sr,sc]]of Object.entries({red:[0,0],green:[0,9],blue:[9,0],yellow:[9,9]})){
      const col=C[color]; const[bx,by]=gp(sr,sc); const sz=6*(CELL+GAP)-GAP; const ins=CELL*0.72;
      e.push(<rect key={`hb-${color}`} x={bx} y={by} width={sz} height={sz} fill={col.bg} rx={6}/>);
      e.push(<rect key={`hw-${color}`} x={bx+ins} y={by+ins} width={sz-ins*2} height={sz-ins*2} fill="#FFF" rx={8} stroke={col.dk} strokeWidth={1.5}/>);
      for(const[r,c]of HOME_BASE[color]){const[x,y]=gp(r,c);
        e.push(<circle key={`ho-${color}-${r}${c}`} cx={x+CELL/2} cy={y+CELL/2} r={12} fill="#FFF" stroke={col.dk} strokeWidth={1.5}/>);
        e.push(<circle key={`hi-${color}-${r}${c}`} cx={x+CELL/2} cy={y+CELL/2} r={7} fill={col.bg} opacity={0.3}/>);
      }
    }
    // Path cells
    for(let r=0;r<15;r++)for(let c=0;c<15;c++){if(!isPath(r,c))continue;const[x,y]=gp(r,c);
      e.push(<rect key={`p-${r}-${c}`} x={x} y={y} width={CELL} height={CELL} fill="#FFF" stroke="#C5C5C5" strokeWidth={0.5} rx={2}/>)}
    // Home columns
    for(const[color,cells]of Object.entries(HOME_COLS))for(const[r,c]of cells){const[x,y]=gp(r,c);
      e.push(<rect key={`hc-${color}-${r}${c}`} x={x+2} y={y+2} width={CELL-4} height={CELL-4} fill={C[color].bg} rx={3} opacity={0.8}/>)}
    // Start cells
    for(const[color,[r,c]]of Object.entries(STARTS)){const[x,y]=gp(r,c);
      e.push(<rect key={`st-${color}`} x={x} y={y} width={CELL} height={CELL} fill={C[color].bg} rx={2}/>)}
    // Safe stars
    for(const[r,c]of SAFE){const[x,y]=gp(r,c);const isSt=Object.values(STARTS).some(([sr,sc])=>sr===r&&sc===c);
      e.push(<text key={`sf-${r}${c}`} x={x+CELL/2} y={y+CELL/2+2} textAnchor="middle" dominantBaseline="middle" fontSize={isSt?17:15} fill={isSt?"#FFF":"#999"} fontWeight="bold">★</text>)}
    // Center
    const[cx,cy]=gp(6,6);const cs=3*CELL+2*GAP;const mx=cx+cs/2,my=cy+cs/2;
    e.push(<rect key="cw" x={cx} y={cy} width={cs} height={cs} fill="#FFF"/>);
    e.push(<polygon key="ct-r" points={`${cx},${cy} ${mx},${my} ${cx},${cy+cs}`} fill={C.red.bg} opacity={0.88}/>);
    e.push(<polygon key="ct-g" points={`${cx},${cy} ${mx},${my} ${cx+cs},${cy}`} fill={C.green.bg} opacity={0.88}/>);
    e.push(<polygon key="ct-y" points={`${cx+cs},${cy} ${mx},${my} ${cx+cs},${cy+cs}`} fill={C.yellow.bg} opacity={0.88}/>);
    e.push(<polygon key="ct-b" points={`${cx},${cy+cs} ${mx},${my} ${cx+cs},${cy+cs}`} fill={C.blue.bg} opacity={0.88}/>);
    e.push(<rect key="cb" x={cx} y={cy} width={cs} height={cs} fill="none" stroke="#777" strokeWidth={1.5}/>);
    e.push(<circle key="cc" cx={mx} cy={my} r={12} fill="#FFF" stroke="#888" strokeWidth={1}/>);
    // Arrows
    for(const[r,c,t]of[[6,0,'→'],[0,8,'↓'],[8,14,'←'],[14,6,'↑']]){const[x,y]=gp(r,c);
      e.push(<text key={`ar-${r}${c}`} x={x+CELL/2} y={y+CELL/2+1} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="#AAA">{t}</text>)}
    return e;
  },[]);

  // Tokens (pawns)
  const pawns=useMemo(()=>{
    const e=[];const pm={};
    for(const color of ORDER)for(const tk of tokens[color]){
      const[cx,cy]=getTkPos(color,tk);const pk=`${Math.round(cx)},${Math.round(cy)}`;
      if(!pm[pk])pm[pk]=0;const off=pm[pk]*3;pm[pk]++;
      const moveable=color===turn&&moveIds.includes(tk.id);
      e.push(<Pawn key={`pk-${color}-${tk.id}`} cx={cx+off} cy={cy+off} color={color} moveable={moveable} onClick={()=>doMove(tk.id)}/>);
    }
    return e;
  },[tokens,turn,moveIds,doMove]);

  const dotMap={1:[[30,30]],2:[[16,16],[44,44]],3:[[16,16],[30,30],[44,44]],4:[[16,16],[44,16],[16,44],[44,44]],5:[[16,16],[44,16],[30,30],[16,44],[44,44]],6:[[16,16],[44,16],[16,30],[44,30],[16,44],[44,44]]};

  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(180deg,#0c1222,#162032,#0c1222)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:8,fontFamily:"'Segoe UI',system-ui,sans-serif",gap:8}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap');`}</style>

      <h1 style={{fontFamily:'Fredoka,sans-serif',fontSize:'clamp(1.3rem,4vw,2rem)',fontWeight:700,color:'#FFF',letterSpacing:3,margin:0}}>
        🎲 LUDO<span style={{background:'linear-gradient(135deg,#fbbf24,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>ROYALE</span>
      </h1>

      {/* Player bar */}
      <div style={{display:'flex',gap:5,flexWrap:'wrap',justifyContent:'center'}}>
        {ORDER.map(p=>(
          <div key={p} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:16,
            background:p===turn?'rgba(251,191,36,0.12)':'rgba(255,255,255,0.04)',
            border:`1.5px solid ${p===turn?'#fbbf24':'transparent'}`,
            boxShadow:p===turn?'0 0 10px rgba(251,191,36,0.2)':'none',
            fontFamily:'Fredoka,sans-serif',fontSize:12,fontWeight:600,color:p===turn?'#FFF':'#94a3b8'}}>
            <span style={{width:9,height:9,borderRadius:'50%',background:C[p].bg}}/>
            {p.charAt(0).toUpperCase()+p.slice(1)}
            {p===turn&&<span>🎲</span>}
          </div>
        ))}
      </div>

      {/* Board — takes maximum space */}
      <div style={{background:'linear-gradient(145deg,#C8A84E,#8B6914,#A07828)',borderRadius:10,padding:4,
        boxShadow:'0 8px 30px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.2)',
        width:'min(96vw, calc(96vh - 180px))',height:'min(96vw, calc(96vh - 180px))',
        maxWidth:700,maxHeight:700,aspectRatio:'1'}}>
        <svg viewBox={`0 0 ${BPX} ${BPX}`} style={{display:'block',width:'100%',height:'100%',borderRadius:6}}>
          {board}
          {pawns}
        </svg>
      </div>

      {/* Controls */}
      <div style={{display:'flex',alignItems:'center',gap:12,background:'rgba(255,255,255,0.06)',
        borderRadius:14,padding:'8px 20px',border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{animation:rolling?'spin 0.07s infinite alternate':'none',cursor:!dice&&!rolling?'pointer':'default'}}
          onClick={!dice&&!rolling?rollDice:undefined}>
          <svg width={48} height={48} viewBox="0 0 60 60">
            <rect x={1} y={1} width={58} height={58} rx={10} fill="#FFFDF5" stroke="#8B7355" strokeWidth={2}/>
            {dice?(dotMap[dice]||[]).map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={5.5} fill="#2C1810"/>)
              :<text x={30} y={35} textAnchor="middle" fontSize={26} fill="#8B7355">?</text>}
          </svg>
        </div>
        <style>{`@keyframes spin{0%{transform:rotate(-14deg)}100%{transform:rotate(14deg)}}`}</style>

        {!dice?(
          <button onClick={rollDice} disabled={rolling} style={{padding:'8px 20px',borderRadius:10,border:'none',
            background:'linear-gradient(135deg,#fbbf24,#f59e0b)',color:'#1a1a1a',fontFamily:'Fredoka,sans-serif',
            fontSize:14,fontWeight:700,cursor:rolling?'not-allowed':'pointer',letterSpacing:1,
            boxShadow:'0 3px 12px rgba(251,191,36,0.3)',opacity:rolling?0.4:1}}>
            {rolling?'Rolling...':'ROLL DICE'}
          </button>
        ):(
          <button onClick={nextTurn} style={{padding:'8px 20px',borderRadius:10,border:'none',
            background:'linear-gradient(135deg,#475569,#334155)',color:'#FFF',fontFamily:'Fredoka,sans-serif',
            fontSize:14,fontWeight:700,cursor:'pointer',letterSpacing:1}}>
            NEXT TURN →
          </button>
        )}

        <span style={{color:'#94a3b8',fontSize:12,fontWeight:500,maxWidth:180,textAlign:'center',lineHeight:1.3}}>{msg}</span>
      </div>

      <div style={{display:'flex',gap:14,color:'#4a5568',fontSize:11}}>
        <span>★ Safe Point</span><span>▶ Home Column</span><span>🏠 Center = Finish</span>
      </div>
    </div>
  );
}
