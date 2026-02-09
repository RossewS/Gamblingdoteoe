import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Zap, Timer, Skull, Coins, Package, 
  TrendingUp, ShoppingCart, Star, Info,
  ChevronUp, RotateCcw, Target, Cpu,
  Volume2, VolumeX, BarChart3
} from 'lucide-react';

/**
 * CLICKER SIMULATOR - MASTER EDITION
 * "The Ultimate Release Version"
 * * Mekanikler:
 * - Combo & Crit Sistemi
 * - Skill Tree (3 Farklı Dal)
 * - Prestige Döngüsü
 * - Gelişmiş Crate & Gamble (Pity & Mutation)
 * - Ses ve Dokunsal Geri Bildirim
 */

const ASSETS = {
  clickTarget: "https://i.ibb.co/6RcKH1Hy/17400.png",
  gambleIntro: "https://i.ibb.co/GvPptxxH/17473.jpg",
  slotBg: "https://i.ibb.co/twPq3Fyz/17474.jpg",
  slotIcons: [
    "https://i.ibb.co/pBZkrC9y/15822.png",
    "https://i.ibb.co/8n0MhXMj/15821.png",
    "https://i.ibb.co/wNFhpkH2/15817.png"
  ],
  crateItems: [
    { name: "Sıradan", color: "#94a3b8", multi: 1.1, weight: 60 },
    { name: "Nadir", color: "#3b82f6", multi: 2.0, weight: 25 },
    { name: "Epik", color: "#a855f7", multi: 5.0, weight: 10 },
    { name: "Efsanevi", color: "#eab308", multi: 15.0, weight: 4 },
    { name: "Antik", color: "#ef4444", multi: 50.0, weight: 1 }
  ]
};

// --- SES MOTORU (Web Audio API) ---
const useAudio = () => {
  const [isMuted, setIsMuted] = useState(false);
  const play = useCallback((freq, type = 'sine', duration = 0.1, vol = 0.1) => {
    if (isMuted) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }, [isMuted]);

  return { play, isMuted, setIsMuted };
};

const formatNumber = (num) => {
  if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Q';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
  return Math.floor(num).toLocaleString();
};

export default function App() {
  const audio = useAudio();
  
  // --- CORE STATE ---
  const [score, setScore] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [autoRate, setAutoRate] = useState(0);
  const [eggMulti, setEggMulti] = useState(1.0);
  const [prestigeCoins, setPrestigeCoins] = useState(0);
  const [prestigeCount, setPrestigeCount] = useState(0);

  // --- COMBO & CRIT STATE ---
  const [combo, setCombo] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [isCrit, setIsCrit] = useState(false);

  // --- SKILL TREE STATE ---
  const [skills, setSkills] = useState({
    clickPower: 0, // Click path
    critChance: 0,
    autoEfficiency: 0, // Auto path
    pitySystem: 0, // Gamble path
    luckyDraw: 0
  });

  // --- BUFF & TIME STATE ---
  const [buff, setBuff] = useState({ active: false, endsAt: null, multi: 10 });
  const [timeLeft, setTimeLeft] = useState(0);

  // --- UI & OVERLAYS ---
  const [activeTab, setActiveTab] = useState('main'); // main, skill, prestige
  const [gambleStage, setGambleStage] = useState('idle');
  const [slotIndices, setSlotIndices] = useState([0, 0, 0]);
  const [pityCount, setPityCount] = useState(0);
  const [isOpeningCrate, setIsOpeningCrate] = useState(false);
  const [crateList, setCrateList] = useState([]);
  const [wonItem, setWonItem] = useState(null);
  const [vfx, setVfx] = useState([]);

  // --- DERIVED STATS (Memoized) ---
  const stats = useMemo(() => {
    const prestigeBonus = 1 + (prestigeCoins * 0.1);
    const skillClickBonus = 1 + (skills.clickPower * 0.2);
    const comboBonus = 1 + (Math.floor(combo / 10) * 0.1);
    const totalMulti = (buff.active ? buff.multi : 1) * eggMulti * prestigeBonus * skillClickBonus * comboBonus;
    const critChance = 0.05 + (skills.critChance * 0.03);
    const autoEfficiency = 1 + (skills.autoEfficiency * 0.15);
    
    return { totalMulti, critChance, autoEfficiency, comboBonus, prestigeBonus };
  }, [buff, eggMulti, prestigeCoins, skills, combo]);

  // --- PERSISTENCE ---
  useEffect(() => {
    const saved = localStorage.getItem('master_clicker_save');
    if (saved) {
      const data = JSON.parse(saved);
      setScore(data.score || 0);
      setClickPower(data.clickPower || 1);
      setAutoRate(data.autoRate || 0);
      setPrestigeCoins(data.prestigeCoins || 0);
      setSkills(data.skills || skills);
      setEggMulti(data.eggMulti || 1);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('master_clicker_save', JSON.stringify({
      score, clickPower, autoRate, prestigeCoins, skills, eggMulti
    }));
  }, [score, clickPower, autoRate, prestigeCoins, skills, eggMulti]);

  // --- GAME LOOPS ---
  useEffect(() => {
    const ticker = setInterval(() => {
      if (gambleStage === 'idle') {
        const gain = (autoRate * stats.totalMulti * stats.autoEfficiency) / 10;
        setScore(prev => prev + gain);
      }
      if (buff.active && buff.endsAt) {
        const rem = Math.max(0, buff.endsAt - Date.now());
        setTimeLeft(rem);
        if (rem === 0) setBuff(b => ({ ...b, active: false }));
      }
      // Combo decay
      if (Date.now() - lastClickTime > 2000 && combo > 0) {
        setCombo(prev => Math.floor(prev * 0.8));
      }
    }, 100);
    return () => clearInterval(ticker);
  }, [autoRate, stats, buff, gambleStage, lastClickTime, combo]);

  // --- ACTIONS ---
  const handleMainClick = (e) => {
    if (gambleStage !== 'idle' || isOpeningCrate) return;
    
    const now = Date.now();
    setLastClickTime(now);
    setCombo(prev => Math.min(prev + 1, 100));
    setTotalClicks(prev => prev + 1);

    const critRoll = Math.random() < stats.critChance;
    setIsCrit(critRoll);
    
    const baseGain = clickPower * stats.totalMulti;
    const finalGain = critRoll ? baseGain * 5 : baseGain;
    
    setScore(prev => prev + finalGain);
    
    // VFX & Sound
    audio.play(critRoll ? 800 : 440, 'sine', 0.05, critRoll ? 0.2 : 0.1);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newVfx = {
      id: now,
      x, y,
      text: `+${formatNumber(finalGain)}`,
      isCrit: critRoll
    };
    setVfx(v => [...v, newVfx]);
    setTimeout(() => setVfx(v => v.filter(i => i.id !== now)), 1000);
    
    if (critRoll) setTimeout(() => setIsCrit(false), 200);
  };

  const buyUpgrade = (type) => {
    let cost = 0;
    if (type === 'click') {
      cost = Math.floor(15 * Math.pow(1.5, clickPower - 1));
      if (score >= cost) {
        setScore(s => s - cost);
        setClickPower(p => p + 1);
        audio.play(600, 'triangle');
      }
    } else {
      cost = Math.floor(100 * Math.pow(1.6, autoRate));
      if (score >= cost) {
        setScore(s => s - cost);
        setAutoRate(p => p + 1);
        audio.play(500, 'triangle');
      }
    }
  };

  const unlockSkill = (skillKey) => {
    const cost = (skills[skillKey] + 1) * 5; // Basit maliyet: her seviye 5 Prestige Coin
    if (prestigeCoins >= cost && skills[skillKey] < 5) {
      setPrestigeCoins(p => p - cost);
      setSkills(s => ({ ...s, [skillKey]: s[skillKey] + 1 }));
      audio.play(1000, 'square', 0.2);
    }
  };

  const triggerPrestige = () => {
    const reward = Math.floor(Math.sqrt(score / 1000000));
    if (reward > 0) {
      setPrestigeCoins(p => p + reward);
      setPrestigeCount(c => c + 1);
      setScore(0);
      setClickPower(1);
      setAutoRate(0);
      setEggMulti(1);
      setCombo(0);
      setActiveTab('main');
      audio.play(200, 'sawtooth', 0.5);
    }
  };

  // --- CRATE & GAMBLE LOGIC ---
  const openCrate = () => {
    if (score < 5000 || isOpeningCrate) return;
    setScore(s => s - 5000);
    setIsOpeningCrate(true);
    setWonItem(null);
    audio.play(300, 'sine', 0.5);

    const generated = Array.from({ length: 60 }, () => {
      const r = Math.random() * 100;
      let cumulative = 0;
      for (const item of ASSETS.crateItems) {
        cumulative += item.weight;
        if (r <= cumulative) return item;
      }
      return ASSETS.crateItems[0];
    });
    
    setCrateList(generated);
    setTimeout(() => {
      const winner = generated[55];
      setWonItem(winner);
      setEggMulti(winner.multi);
      setIsOpeningCrate(false);
      audio.play(winner.multi > 10 ? 1200 : 800, 'square', 0.3);
    }, 5500);
  };

  const startGamble = () => {
    if (score <= 0 || buff.active) return;
    const currentScore = score;
    setScore(0);
    setGambleStage('intro');
    audio.play(100, 'sawtooth', 1, 0.2);

    setTimeout(() => {
      setGambleStage('slots');
      runSlots(currentScore, 1);
    }, 2000);
  };

  const runSlots = (stashed, attempt) => {
    let spins = 0;
    const interval = setInterval(() => {
      setSlotIndices([Math.floor(Math.random() * 3), Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)]);
      audio.play(400 + (spins * 20), 'sine', 0.05, 0.05);
      spins++;
      
      if (spins > 10) {
        clearInterval(interval);
        // Pity check
        const isPity = skills.pitySystem > 0 && pityCount >= (11 - skills.pitySystem);
        const win = isPity || (Math.random() < (0.1 + skills.luckyDraw * 0.05));
        
        const final = win ? [1,1,1] : [0, 1, 2]; // Basit kazanma mantığı
        setSlotIndices(final);

        if (win) {
          setPityCount(0);
          const isMutation = Math.random() < 0.01;
          setBuff({ 
            active: true, 
            endsAt: Date.now() + 251000, 
            multi: isMutation ? 50 : 10 
          });
          setScore(stashed);
          setTimeout(() => setGambleStage('idle'), 2000);
        } else if (attempt < 10) {
          setPityCount(p => p + 1);
          setTimeout(() => runSlots(stashed, attempt + 1), 700);
        } else {
          setGambleStage('lose');
          setTimeout(() => setGambleStage('idle'), 3000);
        }
      }
    }, 100);
  };

  return (
    <div className={`min-h-screen bg-[#09090b] text-slate-100 flex flex-col font-sans overflow-hidden transition-all duration-700
      ${buff.active ? 'ring-[12px] ring-green-500/30 ring-inset shadow-[inset_0_0_100px_rgba(34,197,94,0.2)]' : ''}
      ${isCrit ? 'bg-white/5 scale-[1.005]' : ''}
    `}>
      
      {/* HEADER HUD */}
      <header className="sticky top-0 z-[60] bg-black/80 backdrop-blur-2xl border-b border-white/10 p-4 md:px-8 flex justify-between items-center shadow-2xl">
        <div className="flex gap-4 items-center">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-lg blur opacity-25 group-hover:opacity-50 transition"></div>
            <div className="relative bg-black rounded-lg p-2 flex items-center gap-3">
              <Coins className="text-yellow-400 w-6 h-6 animate-pulse" />
              <span className="text-2xl md:text-3xl font-black font-mono tracking-tighter text-yellow-50">{formatNumber(score)}</span>
            </div>
          </div>
          
          {combo > 0 && (
            <div className="flex flex-col animate-in slide-in-from-left">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Combo x{stats.comboBonus.toFixed(1)}</span>
              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${combo}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => audio.setIsMuted(!audio.isMuted)} className="p-2 hover:bg-white/5 rounded-full transition">
            {audio.isMuted ? <VolumeX className="w-5 h-5 text-slate-500" /> : <Volume2 className="w-5 h-5 text-blue-400" />}
          </button>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Multi</span>
            <span className="text-sm font-black text-blue-400">{stats.totalMulti.toFixed(1)}x</span>
          </div>
        </div>
      </header>

      {/* TABS NAVIGATION */}
      <nav className="flex bg-black/40 border-b border-white/5 p-1 z-50">
        <NavBtn active={activeTab === 'main'} onClick={() => setActiveTab('main')} icon={<Zap/>} label="Oyun" />
        <NavBtn active={activeTab === 'skill'} onClick={() => setActiveTab('skill')} icon={<Target/>} label="Yetenekler" />
        <NavBtn active={activeTab === 'prestige'} onClick={() => setActiveTab('prestige')} icon={<RotateCcw/>} label="Prestij" />
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto custom-scroll p-4 md:p-8 flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto w-full">
        
        {activeTab === 'main' && (
          <>
            {/* LEFT: UPGRADES */}
            <section className="flex-1 flex flex-col gap-4">
              <SectionTitle icon={<ShoppingCart/>} text="Geliştirmeler" />
              <div className="space-y-3">
                <UpgradeItem 
                  title="Güçlü Tıklama" icon={<Zap/>} lvl={clickPower} 
                  cost={Math.floor(15 * Math.pow(1.5, clickPower - 1))}
                  onBuy={() => buyUpgrade('click')}
                  canBuy={score >= Math.floor(15 * Math.pow(1.5, clickPower - 1))}
                />
                <UpgradeItem 
                  title="Otomatik Bot" icon={<Timer/>} lvl={autoRate} 
                  cost={Math.floor(100 * Math.pow(1.6, autoRate))}
                  onBuy={() => buyUpgrade('auto')}
                  canBuy={score >= Math.floor(100 * Math.pow(1.6, autoRate))}
                />
              </div>

              <SectionTitle icon={<BarChart3/>} text="İstatistikler" className="mt-4" />
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Crit Şansı" val={`%${(stats.critChance * 100).toFixed(0)}`} />
                <StatCard label="Auto Verim" val={`%${(stats.autoEfficiency * 100).toFixed(0)}`} />
                <StatCard label="Prestij Bonus" val={`%${(stats.prestigeBonus * 100 - 100).toFixed(0)}`} />
                <StatCard label="Tüm Tıklar" val={formatNumber(totalClicks)} />
              </div>
            </section>

            {/* CENTER: CLICKER */}
            <section className="flex-[1.5] flex flex-col items-center justify-start gap-12 py-10 relative">
              <div 
                className={`relative cursor-pointer select-none group transition-all duration-300
                  ${isCrit ? 'scale-110' : 'active:scale-95'}
                `} 
                onMouseDown={handleMainClick}
              >
                {/* Visual Feedback on Click */}
                {vfx.map(v => (
                  <div 
                    key={v.id} 
                    className={`absolute pointer-events-none font-black animate-out fade-out slide-out-to-top-20 duration-1000 z-50
                      ${v.isCrit ? 'text-yellow-400 text-2xl drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]' : 'text-blue-400 text-lg'}
                    `}
                    style={{ left: v.x, top: v.y }}
                  >
                    {v.text} {v.isCrit && 'CRIT!'}
                  </div>
                ))}

                <div className={`absolute inset-0 blur-[100px] rounded-full transition-all duration-1000 
                  ${buff.active ? 'bg-green-500/40 scale-150' : 'bg-blue-600/10'}
                  ${isCrit ? 'bg-yellow-500/30 blur-[120px]' : ''}
                `} />
                
                <img 
                  src={ASSETS.clickTarget} 
                  className={`w-48 md:w-64 lg:w-80 relative z-10 drop-shadow-[0_40px_60px_rgba(0,0,0,0.5)] transition-transform duration-75
                    ${isCrit ? 'brightness-150 rotate-3' : 'group-hover:scale-105'}
                  `} 
                  alt="Clicker" 
                />
              </div>

              <div className="w-full max-w-sm flex flex-col gap-4">
                <button 
                  onClick={startGamble}
                  disabled={score <= 0 || buff.active}
                  className={`w-full py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-2xl transition-all relative overflow-hidden group
                    ${buff.active 
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                      : 'bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 active:scale-95 text-white'}
                  `}
                >
                  <Skull className={`w-6 h-6 ${buff.active ? '' : 'group-hover:rotate-12 transition-transform'}`} />
                  {buff.active ? "BUFF AKTİF" : "KUMAR OYNA"}
                  {!buff.active && <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-500 skew-x-12" />}
                </button>
                <div className="flex justify-between items-center px-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Pity: {pityCount}/10</span>
                  <span className="text-[10px] font-bold text-red-500 uppercase animate-pulse">Risk: 100% Score</span>
                </div>
              </div>
            </section>

            {/* RIGHT: CRATES */}
            <section className="flex-1 flex flex-col gap-4">
              <SectionTitle icon={<Package/>} text="Kasa Odası" />
              <div className="bg-white/5 rounded-[40px] p-6 border border-white/10 flex flex-col items-center gap-6 shadow-inner">
                <div className="relative w-full h-32 bg-black/60 rounded-3xl overflow-hidden flex items-center border border-white/5">
                  <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-yellow-500/80 z-30 shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
                  <div 
                    className="flex gap-2 px-[50%] transition-transform duration-[5500ms] ease-[cubic-bezier(0.15,0,0.05,1)]"
                    style={{ transform: isOpeningCrate || wonItem ? `translateX(-${55 * 88}px)` : 'translateX(0px)' }}
                  >
                    {crateList.map((item, i) => (
                      <div key={i} className="w-20 h-20 flex-shrink-0 flex flex-col items-center justify-center bg-slate-900/80 rounded-2xl border-b-[6px] shadow-xl"
                        style={{ borderBottomColor: item.color }}>
                        <div className="w-8 h-10 bg-gradient-to-t from-white/10 to-transparent rounded-full border border-white/10 mb-1" />
                        <span className="text-[8px] font-black uppercase text-slate-500">{item.name}</span>
                        <span className="text-[11px] font-bold">{item.multi}x</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={openCrate}
                  disabled={score < 5000 || isOpeningCrate}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-30 rounded-2xl font-black text-white shadow-xl active:scale-95 transition-all"
                >
                  YUMURTA AÇ (5k)
                </button>

                {wonItem && !isOpeningCrate && (
                  <div className="text-center animate-in zoom-in slide-in-from-top-4">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-widest">Kazanılan Nesne</p>
                    <p className="text-2xl font-black drop-shadow-lg" style={{ color: wonItem.color }}>{wonItem.name} {wonItem.multi}x</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'skill' && (
          <section className="w-full max-w-4xl mx-auto flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Yetenek Ağacı</h2>
                <p className="text-slate-500 text-sm">Prestij paralarıyla kalıcı güçler kazan.</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 px-6 py-3 rounded-2xl flex items-center gap-3">
                <Coins className="text-yellow-500 w-6 h-6" />
                <span className="text-2xl font-black text-yellow-500 font-mono">{prestigeCoins}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SkillBranch title="Tıklama Yolu" color="text-blue-400">
                <SkillItem 
                  name="Saf Güç" desc="Click gücünü %20 artırır" lvl={skills.clickPower} 
                  onUnlock={() => unlockSkill('clickPower')} cost={(skills.clickPower+1)*5} canAfford={prestigeCoins >= (skills.clickPower+1)*5}
                />
                <SkillItem 
                  name="Kritik Odak" desc="Crit şansını %3 artırır" lvl={skills.critChance} 
                  onUnlock={() => unlockSkill('critChance')} cost={(skills.critChance+1)*5} canAfford={prestigeCoins >= (skills.critChance+1)*5}
                />
              </SkillBranch>
              
              <SkillBranch title="Otomasyon Yolu" color="text-purple-400">
                <SkillItem 
                  name="Veri Akışı" desc="Auto click verimini %15 artırır" lvl={skills.autoEfficiency} 
                  onUnlock={() => unlockSkill('autoEfficiency')} cost={(skills.autoEfficiency+1)*5} canAfford={prestigeCoins >= (skills.autoEfficiency+1)*5}
                />
              </SkillBranch>

              <SkillBranch title="Şans Yolu" color="text-red-400">
                <SkillItem 
                  name="Acıma Sistemi" desc="Slotlarda Pity sayacını hızlandırır" lvl={skills.pitySystem} 
                  onUnlock={() => unlockSkill('pitySystem')} cost={(skills.pitySystem+1)*5} canAfford={prestigeCoins >= (skills.pitySystem+1)*5}
                />
                <SkillItem 
                  name="Gümüş Dil" desc="Kazanma şansını %5 artırır" lvl={skills.luckyDraw} 
                  onUnlock={() => unlockSkill('luckyDraw')} cost={(skills.luckyDraw+1)*5} canAfford={prestigeCoins >= (skills.luckyDraw+1)*5}
                />
              </SkillBranch>
            </div>
          </section>
        )}

        {activeTab === 'prestige' && (
          <section className="w-full max-w-2xl mx-auto text-center flex flex-col items-center gap-8 py-12 animate-in zoom-in">
            <div className="w-32 h-32 bg-red-600/20 rounded-full flex items-center justify-center border-4 border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.3)]">
              <RotateCcw className="w-16 h-16 text-red-500 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Yeniden Doğuş</h2>
              <p className="text-slate-500 mt-2 max-w-md">
                Tüm ilerlemeni sıfırla ama kalıcı <span className="text-yellow-500 font-bold">Prestij Paraları</span> kazan. 
                Her para üretimine %10 kalıcı bonus verir.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] w-full max-w-sm">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Şu an kazanılan</div>
              <div className="text-5xl font-black text-yellow-500 font-mono mb-8">+{Math.floor(Math.sqrt(score / 1000000))}</div>
              
              <button 
                onClick={triggerPrestige}
                disabled={score < 1000000}
                className={`w-full py-5 rounded-2xl font-black text-lg shadow-2xl transition-all
                  ${score >= 1000000 ? 'bg-red-600 text-white hover:bg-red-500 active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}
                `}
              >
                {score >= 1000000 ? 'PRESTİJ YAP' : '1M KREDİ GEREKLİ'}
              </button>
            </div>
          </section>
        )}
      </main>

      {/* GAMBLE OVERLAYS (FULLSCREEN) */}
      {gambleStage === 'intro' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black animate-in fade-in duration-700">
          <img src={ASSETS.gambleIntro} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm" alt="Gamble Intro" />
          <div className="relative text-center">
            <h1 className="text-5xl md:text-8xl font-black text-red-600 italic tracking-tighter border-y-8 border-red-600 py-6 px-12 animate-pulse">RİSK BAŞLIYOR</h1>
            <p className="text-white font-mono mt-4 tracking-[1em] text-xs">YÜKLENİYOR...</p>
          </div>
        </div>
      )}

      {gambleStage === 'slots' && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950 p-6 overflow-hidden">
          <img src={ASSETS.slotBg} className="absolute inset-0 w-full h-full object-cover opacity-10" alt="Slots" />
          <div className="relative z-10 w-full max-w-md bg-zinc-900/90 p-10 rounded-[60px] border-4 border-yellow-600/50 shadow-[0_0_100px_rgba(202,138,4,0.2)] text-center">
            <h2 className="text-3xl font-black text-yellow-500 mb-10 italic uppercase tracking-widest">ALAN GENİŞLETME</h2>
            <div className="flex gap-4 justify-center mb-10">
              {slotIndices.map((idx, i) => (
                <div key={i} className="w-24 h-24 md:w-28 md:h-28 bg-black rounded-[32px] border-2 border-white/10 flex items-center justify-center p-4 shadow-inner">
                  <img src={ASSETS.slotIcons[idx]} className="w-full h-full object-contain" alt="icon" />
                </div>
              ))}
            </div>
            <div className="bg-black/40 rounded-full py-2 px-6 inline-flex items-center justify-center gap-3 border border-white/5">
              <span className="text-xs uppercase font-bold text-slate-500">Deneme</span>
              <span className="text-2xl font-black text-red-600 font-mono">{pityCount}/10</span>
            </div>
          </div>
        </div>
      )}

      {gambleStage === 'lose' && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 animate-in zoom-in duration-300">
          <Skull className="w-24 h-24 text-red-600 mb-6 drop-shadow-[0_0_40px_rgba(220,38,38,0.7)]" />
          <h1 className="text-5xl md:text-7xl font-black text-white text-center italic tracking-tighter uppercase">İFLAS ETTİN</h1>
          <p className="text-red-600 font-mono tracking-[1.5em] text-[10px] md:text-xs mt-8 uppercase font-bold">Her şey sıfırlandı</p>
        </div>
      )}

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

// --- SUB COMPONENTS ---

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl transition-all duration-300
        ${active ? 'bg-white/5 text-blue-400 font-black shadow-lg translate-y-[-2px]' : 'text-slate-500 hover:text-slate-300'}
      `}
    >
      {React.cloneElement(icon, { size: 18 })}
      <span className="text-xs uppercase tracking-widest">{label}</span>
    </button>
  );
}

function SectionTitle({ icon, text, className }) {
  return (
    <div className={`flex items-center gap-2 mb-2 ${className}`}>
      <span className="text-blue-500">{React.cloneElement(icon, { size: 18 })}</span>
      <h2 className="text-sm font-black uppercase tracking-tighter text-slate-300">{text}</h2>
    </div>
  );
}

function UpgradeItem({ title, icon, lvl, cost, onBuy, canBuy }) {
  return (
    <div 
      onClick={onBuy}
      className={`p-4 rounded-3xl border transition-all duration-200 group relative overflow-hidden
        ${canBuy ? 'bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer active:scale-95 shadow-lg' : 'bg-black/20 border-white/5 opacity-40 cursor-not-allowed'}
      `}
    >
      <div className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <div>
            <h4 className="font-black text-xs uppercase text-slate-200">{title}</h4>
            <p className="text-[10px] text-slate-500 font-bold">SEVİYE {lvl}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1 mb-1">
            <Coins className="w-3 h-3 text-yellow-500" />
            <span className="text-xs font-black font-mono">{formatNumber(cost)}</span>
          </div>
          <div className={`text-[8px] font-black px-3 py-1 rounded-full uppercase
            ${canBuy ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}
          `}>YÜKSELT</div>
        </div>
      </div>
      {canBuy && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />}
    </div>
  );
}

function StatCard({ label, val }) {
  return (
    <div className="bg-black/40 border border-white/5 p-3 rounded-2xl">
      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{label}</div>
      <div className="text-sm font-black text-white mt-1">{val}</div>
    </div>
  );
}

function SkillBranch({ title, color, children }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className={`text-xs font-black uppercase tracking-[0.2em] px-2 ${color}`}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SkillItem({ name, desc, lvl, onUnlock, cost, canAfford }) {
  return (
    <div className={`p-5 rounded-[32px] border transition-all 
      ${canAfford && lvl < 5 ? 'bg-white/5 border-white/10 cursor-pointer hover:bg-white/10' : 'bg-black/40 border-white/5'}
      ${lvl === 5 ? 'border-yellow-500/50' : ''}
    `} onClick={onUnlock}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-black text-sm uppercase text-slate-100">{name}</h4>
          <p className="text-[10px] text-slate-500 leading-tight mt-1">{desc}</p>
        </div>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(i => (
            <div key={i} className={`w-1.5 h-3 rounded-full ${lvl >= i ? 'bg-yellow-500' : 'bg-white/5'}`} />
          ))}
        </div>
      </div>
      {lvl < 5 && (
        <div className="mt-4 flex justify-between items-center border-t border-white/5 pt-4">
          <div className="flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3 text-yellow-500" />
            <span className="text-xs font-black font-mono text-yellow-500">{cost}</span>
          </div>
          <div className={`text-[9px] font-black uppercase ${canAfford ? 'text-blue-400' : 'text-slate-600'}`}>AÇILIŞ</div>
        </div>
      )}
      {lvl === 5 && <div className="mt-2 text-[8px] font-black text-yellow-500 uppercase text-center tracking-widest">MAX SEVİYE</div>}
    </div>
  );
}


