'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Statut = 'nouvelle' | 'en_preparation' | 'prete' | 'servie'
interface Ligne { id: number; nom_plat: string; quantite: number; complement_nom: string | null; remarque: string; sous_total: number; destination: string }
interface Commande { id: number; source: string; table_ref: string; statut: Statut; montant_total: number; heure_creation: string; notes: string; lignes: Ligne[] }

// Taille du texte selon nombre de commandes
function getFontSizes(nb: number) {
  if (nb === 1) return { num: '4rem', plat: '3rem', comp: '1.6rem', btn: '1.4rem', pad: '20px' }
  if (nb === 2) return { num: '3rem', plat: '2.2rem', comp: '1.3rem', btn: '1.1rem', pad: '16px' }
  if (nb === 3) return { num: '2.4rem', plat: '1.8rem', comp: '1.1rem', btn: '1rem',  pad: '12px' }
  if (nb === 4) return { num: '2rem',   plat: '1.5rem', comp: '1rem',   btn: '0.9rem', pad: '10px' }
  return             { num: '1.6rem',  plat: '1.2rem', comp: '0.9rem', btn: '0.85rem', pad: '8px'  }
}

export default function CuisinePage() {
  const router = useRouter()
  // On n'affiche que nouvelle + en_preparation en cuisine
  // "prete" disparaît de la cuisine, reste à l'accueil
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [alarm, setAlarm] = useState(false)
  const [alarmCmds, setAlarmCmds] = useState<number[]>([])
  const [now, setNow] = useState(Date.now())
  const [veille, setVeille] = useState(false)
  const knownIds = useRef<Set<number>>(new Set())
  const alarmRef = useRef<any>(null)
  const alarmStopRef = useRef<any>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // ── SON ALARME ────────────────────────────────────────────
  const playBeeps = useCallback((nb: number, urgent: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const notes = urgent
        ? [880,1100,880,1320,880,1100,1320,1760]
        : [880,1100,1320]
      const sequence = urgent ? notes : Array(nb).fill(notes).flat().slice(0, nb * 3)
      let t = ctx.currentTime
      sequence.forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = urgent ? 'square' : 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, t + i*0.12)
        gain.gain.linearRampToValueAtTime(0.9, t + i*0.12 + 0.02)
        gain.gain.linearRampToValueAtTime(0, t + i*0.12 + 0.10)
        osc.start(t + i*0.12); osc.stop(t + i*0.12 + 0.12)
      })
    } catch(e) {}
    if (navigator.vibrate) navigator.vibrate(urgent ? [400,100,400,100,800] : [200,100,200])
  }, [])

  const stopAlarm = useCallback(() => {
    setAlarm(false)
    setAlarmCmds([])
    setVeille(false)
    if (alarmRef.current) { clearInterval(alarmRef.current); alarmRef.current = null }
    if (alarmStopRef.current) { clearTimeout(alarmStopRef.current); alarmStopRef.current = null }
    if (navigator.vibrate) navigator.vibrate(0)
  }, [])

  const triggerAlarm = useCallback((hasExistingCmds: boolean, urgent: boolean) => {
    if (urgent) {
      // Écran de veille — alarme forte jusqu'au clic
      setVeille(true)
      setAlarm(true)
      playBeeps(0, true)
      alarmRef.current = setInterval(() => playBeeps(0, true), 2500)
    } else if (!hasExistingCmds) {
      // Aucune commande en cours → alarme forte jusqu'au clic
      setAlarm(true)
      playBeeps(0, true)
      alarmRef.current = setInterval(() => playBeeps(0, true), 2500)
    } else {
      // Commandes déjà en cours → juste 3 bips courts, s'arrête tout seul
      playBeeps(3, false)
      // Pas d'overlay, pas de boucle — juste le son ponctuel
    }
  }, [playBeeps])

  const dingPret = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      ;[1047, 1319, 1568].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq; osc.type = 'sine'
        gain.gain.setValueAtTime(0.6, ctx.currentTime + i*0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.15 + 0.5)
        osc.start(ctx.currentTime + i*0.15); osc.stop(ctx.currentTime + i*0.15 + 0.5)
      })
    } catch(e) {}
  }, [])

  const loadCommandes = useCallback(async () => {
    const { data } = await supabase
      .from('commandes').select('id,source,table_ref,statut,montant_total,heure_creation,notes')
      // Cuisine ne voit que nouvelle + en_preparation — PAS prete
      .in('statut', ['nouvelle', 'en_preparation'])
      .order('heure_creation', { ascending: true })
    if (!data) return

    const ids = data.map((c:any) => c.id)
    let lignesMap: Record<number, Ligne[]> = {}
    if (ids.length > 0) {
      const { data: lignes } = await supabase.from('lignes_commande').select('*').in('commande_id', ids).eq('destination', 'cuisine')
      if (lignes) lignes.forEach((l:any) => {
        if (!lignesMap[l.commande_id]) lignesMap[l.commande_id] = []
        lignesMap[l.commande_id].push(l)
      })
    }

    const cmdsCuisine = data
      .map((c:any) => ({ ...c, lignes: lignesMap[c.id] || [] }))
      .filter((c:any) => c.lignes.length > 0)

    // Nouvelles commandes inconnues
    const nouvelles = cmdsCuisine.filter((c:any) => !knownIds.current.has(c.id))
    if (nouvelles.length > 0) {
      const hasExisting = commandes.length > 0
      setAlarmCmds(nouvelles.map((c:any) => c.id))
      triggerAlarm(hasExisting, false)
      nouvelles.forEach((c:any) => knownIds.current.add(c.id))
      setTimeout(() => setAlarmCmds([]), 3000)
    }
    cmdsCuisine.forEach((c:any) => knownIds.current.add(c.id))
    setCommandes(cmdsCuisine)
  }, [commandes.length, triggerAlarm])

  useEffect(() => {
    loadCommandes()
    const ch = supabase.channel('cuisine-v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commandes' }, loadCommandes)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commandes' }, loadCommandes)
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
      if (alarmRef.current) clearInterval(alarmRef.current)
      if (alarmStopRef.current) clearTimeout(alarmStopRef.current)
    }
  }, [loadCommandes])

  // Écran de veille si commande nouvelle > 15min
  useEffect(() => {
    const hasUrgent = commandes.some(c => {
      const mins = (now - new Date(c.heure_creation).getTime()) / 60000
      return c.statut === 'nouvelle' && mins > 15
    })
    if (hasUrgent && !alarm) triggerAlarm(true, true)
    if (!hasUrgent) setVeille(false)
  }, [commandes, now, alarm, triggerAlarm])

  const changerStatut = async (id: number, statut: Statut) => {
    await supabase.from('commandes').update({ statut, heure_modif: new Date().toISOString() }).eq('id', id)
    if (statut === 'prete') {
      dingPret()
      // Retire immédiatement de la vue cuisine
      setCommandes(prev => prev.filter(c => c.id !== id))
    } else {
      loadCommandes()
    }
  }

  const stats = {
    nouvelles: commandes.filter(c => c.statut === 'nouvelle').length,
    prep: commandes.filter(c => c.statut === 'en_preparation').length,
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>

      {/* ÉCRAN DE VEILLE URGENT */}
      {veille && (
        <div onClick={stopAlarm} style={{ position:'fixed', inset:0, zIndex:9998, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', animation:'alarmFlash 0.4s infinite' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(3rem,15vw,8rem)', color:'white', letterSpacing:'4px', textAlign:'center', textShadow:'0 0 40px rgba(255,0,0,0.8)', animation:'alarmPulse 0.6s ease-in-out infinite' }}>
            ⚠️ URGENT !
          </div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.5rem,6vw,3rem)', color:'#ffd700', marginTop:'16px', letterSpacing:'3px' }}>
            COMMANDE EN ATTENTE +15min
          </div>
          <div style={{ marginTop:'24px', fontSize:'1rem', color:'rgba(255,255,255,0.6)', letterSpacing:'2px' }}>
            APPUYER POUR FERMER
          </div>
        </div>
      )}

      {/* ALARM OVERLAY — seulement si pas de commandes existantes */}
      {alarm && !veille && (
        <div className="alarm-overlay" onClick={stopAlarm}>
          <div className="alarm-banner">
            🔔 NOUVELLE COMMANDE !<br/>
            <span style={{ fontSize:'0.3em', letterSpacing:'3px' }}>APPUYER POUR COUPER</span>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="app-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span className="live-dot"/>
          <span className="header-brand">LE BASSAMBA</span>
          <span className="badge badge-green">CUISINE</span>
        </div>
        <div className="header-right">
          {alarm && <button onClick={stopAlarm} style={{ background:'var(--red)', color:'white', border:'none', borderRadius:'20px', padding:'6px 14px', fontSize:'0.75rem', fontWeight:700 }}>🔕 Stop</button>}
          <button className="btn-ghost" onClick={() => router.push('/')}>←</button>
        </div>
      </header>

      {/* STATS */}
      <div className="stat-bar">
        <div className="stat-item"><div className="stat-num" style={{color:'var(--red)'}}>{stats.nouvelles}</div><div className="stat-lbl">Nouvelles</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--yellow)'}}>{stats.prep}</div><div className="stat-lbl">En prép.</div></div>
        <div className="stat-item"><div className="stat-num">{commandes.length}</div><div className="stat-lbl">Total</div></div>
        <div style={{ marginLeft:'auto', padding:'8px 16px', display:'flex', alignItems:'center' }}>
          <span style={{ fontSize:'0.72rem', color:'var(--text3)', letterSpacing:'1px' }}>
            ✅ Prêtes → disparaissent d'ici
          </span>
        </div>
      </div>

      {/* COMMANDES — GRILLE RESPONSIVE + DÉFILEMENT AUTO */}
      <div style={{ flex:1, overflow:'hidden', padding:'8px' }}>
        {commandes.length === 0 ? (
          <div className="empty-state">
            <span className="emoji">🍳</span>
            <p>En attente de commandes...</p>
            <p style={{ marginTop:'8px', fontSize:'0.75rem', color:'var(--text3)' }}>Les commandes prêtes ont disparu ✅</p>
          </div>
        ) : (
          <AutoScrollGrid commandes={commandes} now={now} alarmCmds={alarmCmds} onStatut={changerStatut} />
        )}
      </div>
    </div>
  )
}

function AutoScrollGrid({ commandes, now, alarmCmds, onStatut }: {
  commandes: Commande[]; now: number; alarmCmds: number[]; onStatut: (id:number,s:Statut)=>void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<any>(null)
  const nb = commandes.length
  const fs = getFontSizes(nb)

  // Défilement automatique si plus de 3 commandes
  useEffect(() => {
    if (nb <= 3) {
      if (scrollRef.current) { clearInterval(scrollRef.current); scrollRef.current = null }
      if (containerRef.current) containerRef.current.scrollTop = 0
      return
    }
    const container = containerRef.current
    if (!container) return
    let direction = 1
    scrollRef.current = setInterval(() => {
      if (!container) return
      const maxScroll = container.scrollHeight - container.clientHeight
      if (container.scrollTop >= maxScroll - 2) direction = -1
      if (container.scrollTop <= 0) direction = 1
      container.scrollTop += direction * 1.2
    }, 30)
    return () => { if (scrollRef.current) clearInterval(scrollRef.current) }
  }, [nb])

  // Disposition : 1-2 commandes en colonne, 3+ en grille 2 colonnes
  const isGrid = nb >= 3
  return (
    <div ref={containerRef} style={{
      height:'100%', overflowY: nb > 3 ? 'auto' : 'hidden',
      display: isGrid ? 'grid' : 'flex',
      gridTemplateColumns: isGrid ? 'repeat(2, 1fr)' : undefined,
      flexDirection: isGrid ? undefined : 'column',
      gap:'8px',
      scrollBehavior:'smooth',
    }}>
      {commandes.map(cmd => (
        <CuisineCard key={cmd.id} cmd={cmd} now={now} fs={fs}
          isNew={alarmCmds.includes(cmd.id)} onStatut={onStatut} nb={nb} />
      ))}
    </div>
  )
}

function Chrono({ heure_creation, now, small }: { heure_creation: string; now: number; small?: boolean }) {
  const mins = Math.floor((now - new Date(heure_creation).getTime()) / 60000)
  const urgent = mins >= 20; const warn = mins >= 10
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
      <span style={{ fontSize: small ? '0.8rem' : '1rem' }}>{urgent ? '🔴' : warn ? '🟡' : '🟢'}</span>
      <span style={{ fontFamily:'var(--font-display)', fontSize: small ? '1rem' : '1.3rem', color: urgent?'var(--red)':warn?'var(--yellow)':'var(--green)' }}>
        {mins < 60 ? `${mins}min` : `${Math.floor(mins/60)}h${mins%60}`}
      </span>
    </div>
  )
}

function CuisineCard({ cmd, now, isNew, onStatut, fs, nb }: {
  cmd: Commande; now: number; isNew: boolean; fs: any; nb: number
  onStatut: (id:number,s:Statut)=>void
}) {
  const mins = Math.floor((now - new Date(cmd.heure_creation).getTime()) / 60000)
  const urgent = mins >= 20 && cmd.statut === 'nouvelle'
  const srcClass = cmd.source==='Deliveroo'?'source-deliveroo':cmd.source==='Uber Eats'?'source-ubereats':cmd.source==='À emporter'?'source-emporter':cmd.source==='En ligne'?'source-enligne':'source-presentiel'

  return (
    <div className={`commande-card ${cmd.statut} ${isNew?'flash-new':''}`}
      style={{ borderLeftWidth:'5px', background: urgent ? 'rgba(204,20,20,0.08)' : 'var(--surface)', display:'flex', flexDirection:'column' }}>

      {/* HEADER */}
      <div style={{ padding:`${fs.pad} ${fs.pad}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:fs.num, lineHeight:1, color: cmd.statut==='nouvelle'?'var(--red)':'var(--yellow)', flexShrink:0 }}>
            #{String(cmd.id).padStart(3,'0')}
          </div>
          <div>
            <div style={{ display:'flex', gap:'6px', alignItems:'center', marginBottom:'4px', flexWrap:'wrap' }}>
              <span className={`source-tag ${srcClass}`} style={{fontSize:'0.6rem'}}>{cmd.source}</span>
              {cmd.table_ref && <span style={{ fontSize:'0.75rem', color:'var(--text2)', fontWeight:600 }}>{cmd.table_ref.split('—')[0]}</span>}
            </div>
            <Chrono heure_creation={cmd.heure_creation} now={now} small={nb >= 4} />
          </div>
        </div>
        <div>
          {cmd.statut==='nouvelle' && <span className="badge badge-red" style={{fontSize:'0.6rem',padding:'3px 8px'}}>NEW</span>}
          {cmd.statut==='en_preparation' && <span className="badge" style={{background:'var(--yellow-soft)',color:'var(--yellow)',border:'1px solid var(--yellow)',fontSize:'0.6rem',padding:'3px 8px'}}>PRÉPA</span>}
        </div>
      </div>

      {/* LIGNES PLATS */}
      <div style={{ padding:`0 ${fs.pad} ${fs.pad}`, borderTop:'1px solid var(--border)', flex:1 }}>
        {cmd.lignes.map((l, i) => (
          <div key={i} style={{ padding:`${parseInt(fs.pad)*0.6}px 0`, borderBottom: i < cmd.lignes.length-1 ? '1px solid var(--surface2)' : 'none' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:fs.num, color:'var(--red)', lineHeight:1, minWidth:'44px', textAlign:'center', flexShrink:0 }}>
                {l.quantite}×
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:fs.plat, letterSpacing:'1px', color:'var(--text)', lineHeight:1.1 }}>
                  {l.nom_plat}
                </div>
                {l.complement_nom && (
                  <div style={{ fontSize:fs.comp, color:'var(--gold)', marginTop:'4px', fontWeight:600 }}>
                    ↳ {l.complement_nom}
                  </div>
                )}
                {l.remarque && (
                  <div style={{ fontSize:fs.comp, color:'white', background:'var(--red)', padding:'4px 8px', borderRadius:'6px', marginTop:'4px', fontWeight:700 }}>
                    ⚠️ {l.remarque}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {cmd.notes && (
          <div style={{ marginTop:'6px', padding:'6px 8px', background:'var(--red-soft)', borderRadius:'6px', fontSize:fs.comp, color:'var(--red)', fontWeight:600 }}>
            📝 {cmd.notes}
          </div>
        )}
      </div>

      {/* ACTION */}
      <div style={{ padding:`8px ${fs.pad}`, borderTop:'1px solid var(--border)' }}>
        {cmd.statut === 'nouvelle' && (
          <button className="btn-gold" style={{ width:'100%', fontFamily:'var(--font-display)', fontSize:fs.btn, letterSpacing:'2px', padding:fs.pad }}
            onClick={() => onStatut(cmd.id, 'en_preparation')}>
            🔥 EN PRÉPARATION
          </button>
        )}
        {cmd.statut === 'en_preparation' && (
          <button className="btn-green" style={{ width:'100%', fontFamily:'var(--font-display)', fontSize:fs.btn, letterSpacing:'2px', padding:fs.pad }}
            onClick={() => onStatut(cmd.id, 'prete')}>
            ✅ PRÊTE ✓
          </button>
        )}
      </div>
    </div>
  )
}
