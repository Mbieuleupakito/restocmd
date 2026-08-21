'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Statut = 'nouvelle' | 'en_preparation' | 'prete' | 'servie'
interface Ligne { id: number; nom_plat: string; quantite: number; complement_nom: string | null; remarque: string; sous_total: number; destination: string }
interface Commande { id: number; source: string; table_ref: string; statut: Statut; montant_total: number; heure_creation: string; notes: string; lignes: Ligne[] }

function getFontSizes(nb: number) {
  if (nb <= 2) return { num: '2.5rem', plat: '1.5rem', comp: '1rem', btn: '1.1rem', pad: '14px' }
  if (nb <= 5) return { num: '2rem', plat: '1.2rem', comp: '0.9rem', btn: '1rem', pad: '10px' }
  return { num: '1.6rem', plat: '1rem', comp: '0.8rem', btn: '0.9rem', pad: '8px' }
}

export default function CuisinePage() {
  const router = useRouter()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [alarm, setAlarm] = useState(false)
  const [alarmCmds, setAlarmCmds] = useState<number[]>([])
  const [now, setNow] = useState(Date.now())
  const knownIds = useRef<Set<number>>(new Set())
  const alarmRef = useRef<any>(null)
  const commandesRef = useRef<Commande[]>([])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const playBeeps = useCallback((many: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const notes = many ? [880,1100,880,1320,880,1100,1320,1760] : [880,1100,1320]
      let t = ctx.currentTime
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = many ? 'square' : 'sine'; osc.frequency.value = freq
        gain.gain.setValueAtTime(0, t+i*0.12)
        gain.gain.linearRampToValueAtTime(0.9, t+i*0.12+0.02)
        gain.gain.linearRampToValueAtTime(0, t+i*0.12+0.10)
        osc.start(t+i*0.12); osc.stop(t+i*0.12+0.12)
      })
    } catch(e) {}
    if (navigator.vibrate) navigator.vibrate(many ? [400,100,400,100,800] : [200,100,200])
  }, [])

  const stopAlarm = useCallback(() => {
    setAlarm(false); setAlarmCmds([])
    if (alarmRef.current) { clearInterval(alarmRef.current); alarmRef.current = null }
    if (navigator.vibrate) navigator.vibrate(0)
  }, [])

  const dingPret = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      ;[1047, 1319, 1568].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq; osc.type = 'sine'
        gain.gain.setValueAtTime(0.6, ctx.currentTime+i*0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+i*0.15+0.5)
        osc.start(ctx.currentTime+i*0.15); osc.stop(ctx.currentTime+i*0.15+0.5)
      })
    } catch(e) {}
  }, [])

  const loadCommandes = useCallback(async () => {
    const { data } = await supabase
      .from('commandes').select('id,source,table_ref,statut,montant_total,heure_creation,notes')
      .in('statut', ['nouvelle', 'en_preparation'])
      .order('heure_creation', { ascending: true })
    if (!data) return

    const ids = data.map((c:any) => c.id)
    let lignesMap: Record<number, Ligne[]> = {}
    if (ids.length > 0) {
      const { data: lignes } = await supabase.from('lignes_commande').select('*')
        .in('commande_id', ids).eq('destination', 'cuisine')
      if (lignes) lignes.forEach((l:any) => {
        if (!lignesMap[l.commande_id]) lignesMap[l.commande_id] = []
        lignesMap[l.commande_id].push(l)
      })
    }

    const cmdsCuisine = data.map((c:any) => ({ ...c, lignes: lignesMap[c.id] || [] }))

    // Nouvelles commandes → alerte
    const nouvelles = cmdsCuisine.filter((c:any) => !knownIds.current.has(c.id))
    if (nouvelles.length > 0) {
      const hasExisting = commandesRef.current.length > 0
      setAlarmCmds(nouvelles.map((c:any) => c.id))
      if (!hasExisting) {
        // Pas de commandes → alarme forte qui dure
        setAlarm(true)
        playBeeps(true)
        alarmRef.current = setInterval(() => playBeeps(true), 2500)
      } else {
        // Commandes déjà en cours → 3 bips courts seulement
        playBeeps(false)
      }
      nouvelles.forEach((c:any) => knownIds.current.add(c.id))
      setTimeout(() => setAlarmCmds([]), 3000)
    }
    cmdsCuisine.forEach((c:any) => knownIds.current.add(c.id))
    commandesRef.current = cmdsCuisine
    setCommandes(cmdsCuisine)
  }, [playBeeps])

  useEffect(() => {
    loadCommandes()
    const ch = supabase.channel('cuisine-v4')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commandes' }, loadCommandes)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commandes' }, loadCommandes)
      .subscribe()
    return () => { supabase.removeChannel(ch); if (alarmRef.current) clearInterval(alarmRef.current) }
  }, [loadCommandes])

  const changerStatut = async (id: number, statut: Statut) => {
    await supabase.from('commandes').update({ statut, heure_modif: new Date().toISOString() }).eq('id', id)
    if (statut === 'prete') {
      dingPret()
      setCommandes(prev => prev.filter(c => c.id !== id))
      commandesRef.current = commandesRef.current.filter(c => c.id !== id)
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

      {/* ALARM OVERLAY */}
      {alarm && (
        <div className="alarm-overlay" onClick={stopAlarm}>
          <div className="alarm-banner">
            🔔 NOUVELLE COMMANDE !<br/>
            <span style={{ fontSize:'0.3em', letterSpacing:'3px' }}>APPUYER POUR COUPER</span>
          </div>
        </div>
      )}

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

      <div className="stat-bar">
        <div className="stat-item"><div className="stat-num" style={{color:'var(--red)'}}>{stats.nouvelles}</div><div className="stat-lbl">Nouvelles</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--yellow)'}}>{stats.prep}</div><div className="stat-lbl">En prép.</div></div>
        <div className="stat-item"><div className="stat-num">{commandes.length}</div><div className="stat-lbl">Total</div></div>
        <div style={{ marginLeft:'auto', padding:'8px 16px', display:'flex', alignItems:'center' }}>
          <span style={{ fontSize:'0.7rem', color:'var(--green)' }}>✅ Prêtes → disparaissent</span>
        </div>
      </div>

      <div style={{ flex:1, overflow:'hidden', padding:'8px' }}>
        {commandes.length === 0 ? (
          <div className="empty-state"><span className="emoji">🍳</span><p>En attente de commandes...</p></div>
        ) : (
          <AutoScrollGrid commandes={commandes} now={now} alarmCmds={alarmCmds} onStatut={changerStatut} />
        )}
      </div>
    </div>
  )
}

function AutoScrollGrid({ commandes, now, alarmCmds, onStatut }: {
  commandes: Commande[]; now: number; alarmCmds: number[]
  onStatut: (id:number,s:Statut)=>void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<any>(null)
  const pauseRef = useRef<any>(null)
  const nb = commandes.length
  const fs = getFontSizes(nb)

  const startScroll = useCallback(() => {
    const container = containerRef.current
    if (!container || nb <= 3) return
    if (scrollRef.current) clearInterval(scrollRef.current)
    let direction = 1
    scrollRef.current = setInterval(() => {
      if (!container) return
      const maxScroll = container.scrollHeight - container.clientHeight
      if (maxScroll <= 0) return
      if (container.scrollTop >= maxScroll - 2) direction = -1
      if (container.scrollTop <= 0) direction = 1
      container.scrollTop += direction * 1.2
    }, 25)
  }, [nb])

  const pauseScroll = useCallback(() => {
    if (scrollRef.current) { clearInterval(scrollRef.current); scrollRef.current = null }
    if (pauseRef.current) clearTimeout(pauseRef.current)
    // Reprend après 3 secondes
    pauseRef.current = setTimeout(() => startScroll(), 3000)
  }, [startScroll])

  useEffect(() => {
    if (nb <= 3) {
      if (scrollRef.current) { clearInterval(scrollRef.current); scrollRef.current = null }
      return
    }
    // Démarre après 1 seconde
    const t = setTimeout(() => startScroll(), 1000)
    return () => {
      clearTimeout(t)
      if (scrollRef.current) clearInterval(scrollRef.current)
      if (pauseRef.current) clearTimeout(pauseRef.current)
    }
  }, [nb, startScroll])

  return (
    <div ref={containerRef}
      style={{ height:'100%', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px' }}
      onMouseDown={pauseScroll}
      onTouchStart={pauseScroll}
      onWheel={pauseScroll}
    >
      {commandes.map(cmd => (
        <CuisineCard key={cmd.id} cmd={cmd} now={now} fs={fs}
          isNew={alarmCmds.includes(cmd.id)} onStatut={onStatut} />
      ))}
    </div>
  )
}

function CuisineCard({ cmd, now, isNew, onStatut, fs }: {
  cmd: Commande; now: number; isNew: boolean; fs: any
  onStatut: (id:number,s:Statut)=>void
}) {
  const mins = Math.floor((now - new Date(cmd.heure_creation).getTime()) / 60000)
  const warn = mins >= 10; const urgent = mins >= 20
  const srcClass = cmd.source==='Deliveroo'?'source-deliveroo':cmd.source==='Uber Eats'?'source-ubereats':cmd.source==='À emporter'?'source-emporter':cmd.source==='En ligne'?'source-enligne':'source-presentiel'

  return (
    <div className={`commande-card ${cmd.statut} ${isNew?'flash-new':''}`}
      style={{ borderLeftWidth:'4px', display:'flex', flexDirection:'column', flexShrink:0 }}>

      {/* HEADER */}
      <div style={{ padding:`${fs.pad} ${fs.pad} 6px`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontFamily:'var(--font-display)', fontSize:fs.num, color: cmd.statut==='nouvelle'?'var(--red)':'var(--yellow)', lineHeight:1 }}>
            #{String(cmd.id).padStart(3,'0')}
          </span>
          <span style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', color: urgent?'var(--red)':warn?'var(--yellow)':'var(--green)' }}>
            {urgent?'🔴':warn?'🟡':'🟢'} {mins}min
          </span>
          {cmd.table_ref && <span style={{ fontSize:'0.75rem', color:'var(--text2)' }}>{cmd.table_ref.split('—')[0].trim()}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <span className={`source-tag ${srcClass}`} style={{fontSize:'0.6rem'}}>{cmd.source}</span>
          {cmd.statut==='nouvelle' && <span className="badge badge-red" style={{fontSize:'0.55rem',padding:'2px 6px'}}>NEW</span>}
          {cmd.statut==='en_preparation' && <span className="badge" style={{background:'var(--yellow-soft)',color:'var(--yellow)',border:'1px solid var(--yellow)',fontSize:'0.55rem',padding:'2px 6px'}}>PRÉPA</span>}
        </div>
      </div>

      {/* PLATS */}
      <div style={{ padding:`6px ${fs.pad}`, borderTop:'1px solid var(--border)' }}>
        {cmd.lignes.length === 0 ? (
          <div style={{ color:'var(--text3)', fontSize:'0.85rem', fontStyle:'italic', padding:'4px 0' }}>
            (boissons uniquement — gérées à l'accueil)
          </div>
        ) : (
          cmd.lignes.map((l, i) => (
            <div key={i} style={{ display:'flex', alignItems:'baseline', gap:'10px', padding:'4px 0', borderBottom: i < cmd.lignes.length-1 ? '1px solid var(--surface2)' : 'none' }}>
              <span style={{ fontFamily:'var(--font-display)', fontSize:fs.num, color:'var(--red)', flexShrink:0, lineHeight:1 }}>
                {l.quantite}×
              </span>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:fs.plat, color:'var(--text)', fontWeight:700, lineHeight:1.2 }}>
                  {l.nom_plat}
                </div>
                {l.complement_nom && (
                  <div style={{ fontSize:fs.comp, color:'var(--gold)', fontWeight:600 }}>↳ {l.complement_nom}</div>
                )}
                {l.remarque && (
                  <div style={{ fontSize:fs.comp, color:'var(--red)', fontWeight:700 }}>⚠️ {l.remarque}</div>
                )}
              </div>
            </div>
          ))
        )}
        {cmd.notes && (
          <div style={{ fontSize:fs.comp, color:'var(--red)', marginTop:'4px' }}>📝 {cmd.notes}</div>
        )}
      </div>

      {/* BOUTON */}
      <div style={{ padding:`6px ${fs.pad}`, borderTop:'1px solid var(--border)' }}>
        {cmd.statut === 'nouvelle' && (
          <button className="btn-gold" style={{ width:'100%', fontFamily:'var(--font-display)', fontSize:fs.btn, letterSpacing:'1px', padding:'12px 8px' }}
            onClick={() => onStatut(cmd.id, 'en_preparation')}>
            🔥 EN PRÉPARATION
          </button>
        )}
        {cmd.statut === 'en_preparation' && (
          <button className="btn-green" style={{ width:'100%', fontFamily:'var(--font-display)', fontSize:fs.btn, letterSpacing:'1px', padding:'12px 8px' }}
            onClick={() => onStatut(cmd.id, 'prete')}>
            ✅ COMMANDE PRÊTE
          </button>
        )}
      </div>
    </div>
  )
}
