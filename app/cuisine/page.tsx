'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Statut = 'nouvelle' | 'en_preparation' | 'prete' | 'servie'
interface Ligne { id: number; nom_plat: string; quantite: number; complement_nom: string | null; remarque: string; sous_total: number; destination: string }
interface Commande { id: number; source: string; table_ref: string; statut: Statut; montant_total: number; heure_creation: string; notes: string; lignes: Ligne[] }

export default function CuisinePage() {
  const router = useRouter()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [alarm, setAlarm] = useState(false)
  const [alarmCmds, setAlarmCmds] = useState<number[]>([])
  const [now, setNow] = useState(Date.now())
  const [veille, setVeille] = useState(false)
  const knownIds = useRef<Set<number>>(new Set())
  const alarmRef = useRef<any>(null)

  // Chrono tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const playAlarm = useCallback((urgent = false) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const notes = urgent
        ? [1320,880,1320,880,1320,880,1320,880,1320,880,1320,880]
        : [880,1100,880,1320,880,1100,1320,1760]
      let t = ctx.currentTime
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = urgent ? 'sawtooth' : 'square'; osc.frequency.value = freq
        gain.gain.setValueAtTime(0, t+i*0.1)
        gain.gain.linearRampToValueAtTime(0.9, t+i*0.1+0.02)
        gain.gain.linearRampToValueAtTime(0, t+i*0.1+0.09)
        osc.start(t+i*0.1); osc.stop(t+i*0.1+0.11)
      })
    } catch(e) {}
    if (navigator.vibrate) navigator.vibrate(urgent ? [800,100,800,100,800] : [400,100,400,100,800])
  }, [])

  const stopAlarm = useCallback(() => {
    setAlarm(false); setAlarmCmds([])
    if (alarmRef.current) { clearInterval(alarmRef.current); alarmRef.current = null }
    if (navigator.vibrate) navigator.vibrate(0)
  }, [])

  const triggerAlarm = useCallback((urgent = false) => {
    setAlarm(true)
    playAlarm(urgent)
    if (alarmRef.current) clearInterval(alarmRef.current)
    alarmRef.current = setInterval(() => playAlarm(urgent), 2500)
  }, [playAlarm])

  // Son "ding" plat prêt → accueil
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
      .in('statut', ['nouvelle','en_preparation','prete'])
      .order('heure_creation', { ascending: true })
    if (!data) return

    // Charger lignes cuisine uniquement
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
      .map((c:any) => ({ ...c, lignes: lignesMap[c.id]||[] }))
      .filter((c:any) => c.lignes.length > 0)

    // Détecter nouvelles commandes
    const nouvelles = cmdsCuisine.filter((c:any) => !knownIds.current.has(c.id))
    if (nouvelles.length > 0) {
      setAlarmCmds(nouvelles.map((c:any) => c.id))
      triggerAlarm(false)
      nouvelles.forEach((c:any) => knownIds.current.add(c.id))
      setTimeout(() => setAlarmCmds([]), 4000)
    }
    cmdsCuisine.forEach((c:any) => knownIds.current.add(c.id))
    setCommandes(cmdsCuisine)
  }, [triggerAlarm])

  useEffect(() => {
    loadCommandes()
    const ch = supabase.channel('cuisine-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commandes' }, loadCommandes)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commandes' }, loadCommandes)
      .subscribe()
    return () => { supabase.removeChannel(ch); if(alarmRef.current) clearInterval(alarmRef.current) }
  }, [loadCommandes])

  // Écran de veille — commande en attente > 15min
  useEffect(() => {
    const hasUrgent = commandes.some(c => {
      const mins = (now - new Date(c.heure_creation).getTime()) / 60000
      return c.statut === 'nouvelle' && mins > 15
    })
    if (hasUrgent && !alarm) {
      setVeille(true)
      triggerAlarm(true)
    } else if (!hasUrgent) {
      setVeille(false)
    }
  }, [commandes, now, alarm, triggerAlarm])

  const changerStatut = async (id: number, statut: Statut) => {
    await supabase.from('commandes').update({ statut, heure_modif: new Date().toISOString() }).eq('id', id)
    if (statut === 'prete') dingPret()
    loadCommandes()
  }

  const stats = {
    nouvelles: commandes.filter(c => c.statut === 'nouvelle').length,
    prep: commandes.filter(c => c.statut === 'en_preparation').length,
    pretes: commandes.filter(c => c.statut === 'prete').length,
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>

      {/* ÉCRAN DE VEILLE URGENT */}
      {veille && (
        <div onClick={() => { setVeille(false); stopAlarm() }}
          style={{ position:'fixed', inset:0, zIndex:9998, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', animation:'alarmFlash 0.4s infinite' }}>
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

      {/* ALARM OVERLAY */}
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
        <div className="stat-item"><div className="stat-num" style={{color:'var(--green)'}}>{stats.pretes}</div><div className="stat-lbl">Prêtes</div></div>
        <div className="stat-item"><div className="stat-num">{commandes.length}</div><div className="stat-lbl">Total</div></div>
      </div>

      {/* COMMANDES */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
        {commandes.length === 0 ? (
          <div className="empty-state"><span className="emoji">🍳</span><p>En attente de commandes...</p></div>
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
  const urgent = mins >= 20
  const warn = mins >= 10
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
      <span style={{ fontSize:'1.2rem' }}>{urgent ? '🔴' : warn ? '🟡' : '🟢'}</span>
      <span style={{ fontFamily:'var(--font-display)', fontSize:'1.4rem', color: urgent?'var(--red)':warn?'var(--yellow)':'var(--green)', letterSpacing:'1px' }}>
        {mins < 60 ? `${mins} min` : `${Math.floor(mins/60)}h${mins%60}`}
      </span>
    </div>
  )
}

function CuisineCard({ cmd, now, isNew, onStatut }: { cmd: Commande; now: number; isNew: boolean; onStatut: (id:number,s:Statut)=>void }) {
  const mins = Math.floor((now - new Date(cmd.heure_creation).getTime()) / 60000)
  const urgent = mins >= 20 && cmd.statut === 'nouvelle'
  const srcClass = cmd.source==='Deliveroo'?'source-deliveroo':cmd.source==='Uber Eats'?'source-ubereats':cmd.source==='À emporter'?'source-emporter':'source-presentiel'

  return (
    <div className={`commande-card ${cmd.statut} ${isNew?'flash-new':''}`}
      style={{ borderLeftWidth:'6px', background: urgent ? 'rgba(204,20,20,0.08)' : 'var(--surface)' }}>

      {/* HEADER COMMANDE */}
      <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(2rem,6vw,3.5rem)', lineHeight:1,
            color: cmd.statut==='nouvelle'?'var(--red)':cmd.statut==='en_preparation'?'var(--yellow)':'var(--green)' }}>
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
        <div style={{ textAlign:'right' }}>
          {cmd.statut==='nouvelle' && <span className="badge badge-red" style={{ fontSize:'0.75rem', padding:'4px 12px' }}>NOUVELLE</span>}
          {cmd.statut==='en_preparation' && <span className="badge" style={{ background:'var(--yellow-soft)', color:'var(--yellow)', border:'1px solid var(--yellow)', fontSize:'0.75rem', padding:'4px 12px' }}>EN PRÉPA.</span>}
          {cmd.statut==='prete' && <span className="badge badge-green" style={{ fontSize:'0.75rem', padding:'4px 12px' }}>PRÊTE ✓</span>}
        </div>
      </div>

      {/* LIGNES PLATS — NOM EN TRÈS GRAND */}
      <div style={{ padding:'0 16px 12px', borderTop:'1px solid var(--border)' }}>
        {cmd.lignes.map((l, i) => (
          <div key={i} style={{ padding:'12px 0', borderBottom: i < cmd.lignes.length-1 ? '1px solid var(--surface2)' : 'none' }}>
            {/* QUANTITÉ + NOM EN GRAND */}
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

      {/* ACTIONS */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:'10px' }}>
        {cmd.statut === 'nouvelle' && (
          <button className="btn-gold" style={{ flex:1, fontFamily:'var(--font-display)', fontSize:'clamp(1rem,4vw,1.4rem)', letterSpacing:'2px', padding:'16px' }}
            onClick={() => onStatut(cmd.id, 'en_preparation')}>
            🔥 EN PRÉPARATION
          </button>
        )}
        {cmd.statut === 'en_preparation' && (
          <button className="btn-green" style={{ flex:1, fontFamily:'var(--font-display)', fontSize:'clamp(1rem,4vw,1.4rem)', letterSpacing:'2px', padding:'16px' }}
            onClick={() => onStatut(cmd.id, 'prete')}>
            ✅ COMMANDE PRÊTE
          </button>
        )}
        {cmd.statut === 'prete' && (
          <button className="btn-secondary" style={{ flex:1, fontSize:'1rem', padding:'14px' }}
            onClick={() => onStatut(cmd.id, 'servie')}>
            📦 Récupérée / Servie
          </button>
        )}
      </div>
    </div>
  )
}
