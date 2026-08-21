'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Statut = 'nouvelle' | 'en_preparation' | 'prete' | 'servie'
interface Ligne { id: number; nom_plat: string; quantite: number; complement_nom: string | null; remarque: string; sous_total: number; destination: string }
interface Commande { id: number; source: string; table_ref: string; statut: Statut; montant_total: number; heure_creation: string; notes: string; lignes: Ligne[] }

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

      {/* COMMANDES */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
        {commandes.length === 0 ? (
          <div className="empty-state">
            <span className="emoji">🍳</span>
            <p>En attente de commandes...</p>
            <p style={{ marginTop:'8px', fontSize:'0.75rem', color:'var(--text3)' }}>Les commandes prêtes ont disparu ✅</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {commandes.map(cmd => (
              <CuisineCard key={cmd.id} cmd={cmd} now={now} isNew={alarmCmds.includes(cmd.id)} onStatut={changerStatut} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Chrono({ heure_creation, now }: { heure_creation: string; now: number }) {
  const mins = Math.floor((now - new Date(heure_creation).getTime()) / 60000)
  const urgent = mins >= 20; const warn = mins >= 10
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
      <span style={{ fontSize:'1rem' }}>{urgent ? '🔴' : warn ? '🟡' : '🟢'}</span>
      <span style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', color: urgent?'var(--red)':warn?'var(--yellow)':'var(--green)', letterSpacing:'1px' }}>
        {mins < 60 ? `${mins} min` : `${Math.floor(mins/60)}h${mins%60}`}
      </span>
    </div>
  )
}

function CuisineCard({ cmd, now, isNew, onStatut }: { cmd: Commande; now: number; isNew: boolean; onStatut: (id:number,s:Statut)=>void }) {
  const mins = Math.floor((now - new Date(cmd.heure_creation).getTime()) / 60000)
  const urgent = mins >= 20 && cmd.statut === 'nouvelle'
  const srcClass = cmd.source==='Deliveroo'?'source-deliveroo':cmd.source==='Uber Eats'?'source-ubereats':cmd.source==='À emporter'?'source-emporter':cmd.source==='En ligne'?'source-enligne':'source-presentiel'

  return (
    <div className={`commande-card ${cmd.statut} ${isNew?'flash-new':''}`}
      style={{ borderLeftWidth:'6px', background: urgent ? 'rgba(204,20,20,0.08)' : 'var(--surface)' }}>

      {/* HEADER */}
      <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(2rem,6vw,3.5rem)', lineHeight:1, color: cmd.statut==='nouvelle'?'var(--red)':'var(--yellow)' }}>
            #{String(cmd.id).padStart(3,'0')}
          </div>
          <div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'6px' }}>
              <span className={`source-tag ${srcClass}`}>{cmd.source}</span>
              {cmd.table_ref && <span style={{ fontSize:'0.85rem', color:'var(--text2)', fontWeight:600 }}>{cmd.table_ref}</span>}
            </div>
            <Chrono heure_creation={cmd.heure_creation} now={now} />
          </div>
        </div>
        <div>
          {cmd.statut==='nouvelle' && <span className="badge badge-red" style={{fontSize:'0.75rem',padding:'4px 12px'}}>NOUVELLE</span>}
          {cmd.statut==='en_preparation' && <span className="badge" style={{background:'var(--yellow-soft)',color:'var(--yellow)',border:'1px solid var(--yellow)',fontSize:'0.75rem',padding:'4px 12px'}}>EN PRÉPA.</span>}
        </div>
      </div>

      {/* LIGNES PLATS EN GRAND */}
      <div style={{ padding:'0 16px 12px', borderTop:'1px solid var(--border)' }}>
        {cmd.lignes.map((l, i) => (
          <div key={i} style={{ padding:'12px 0', borderBottom: i < cmd.lignes.length-1 ? '1px solid var(--surface2)' : 'none' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:'16px' }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(2.5rem,8vw,4rem)', color:'var(--red)', lineHeight:1, minWidth:'60px', textAlign:'center', flexShrink:0 }}>
                {l.quantite}×
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.6rem,5vw,2.8rem)', letterSpacing:'1px', color:'var(--text)', lineHeight:1.1 }}>
                  {l.nom_plat}
                </div>
                {l.complement_nom && (
                  <div style={{ fontSize:'clamp(1rem,3vw,1.4rem)', color:'var(--gold)', marginTop:'6px', fontWeight:600 }}>
                    ↳ Avec : {l.complement_nom}
                  </div>
                )}
                {l.remarque && (
                  <div style={{ fontSize:'clamp(0.9rem,2.5vw,1.2rem)', color:'white', background:'var(--red)', padding:'6px 12px', borderRadius:'8px', marginTop:'8px', fontWeight:700 }}>
                    ⚠️ {l.remarque}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {cmd.notes && (
          <div style={{ marginTop:'10px', padding:'10px', background:'var(--red-soft)', borderRadius:'8px', fontSize:'1rem', color:'var(--red)', fontWeight:600 }}>
            📝 {cmd.notes}
          </div>
        )}
      </div>

      {/* ACTION — 1 seul bouton à la fois */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
        {cmd.statut === 'nouvelle' && (
          <button className="btn-gold" style={{ width:'100%', fontFamily:'var(--font-display)', fontSize:'clamp(1rem,4vw,1.4rem)', letterSpacing:'2px', padding:'16px' }}
            onClick={() => onStatut(cmd.id, 'en_preparation')}>
            🔥 EN PRÉPARATION
          </button>
        )}
        {cmd.statut === 'en_preparation' && (
          <button className="btn-green" style={{ width:'100%', fontFamily:'var(--font-display)', fontSize:'clamp(1rem,4vw,1.4rem)', letterSpacing:'2px', padding:'16px' }}
            onClick={() => onStatut(cmd.id, 'prete')}>
            ✅ COMMANDE PRÊTE → Disparaît d'ici
          </button>
        )}
      </div>
    </div>
  )
}
