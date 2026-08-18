'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Statut = 'nouvelle' | 'en_preparation' | 'prete' | 'servie'

interface LigneCommande {
  id: number; nom: string; quantite: number; complement_nom: string | null
  remarque: string; sous_total: number; destination: string
}

interface Commande {
  id: number; numero: number; source: string; table_ref: string
  statut: Statut; montant_total: number; heure_creation: string; notes: string
  lignes: LigneCommande[]
}

export default function CuisinePage() {
  const router = useRouter()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [alarm, setAlarm] = useState(false)
  const [newCmd, setNewCmd] = useState<number[]>([])
  const knownIds = useRef<Set<number>>(new Set())
  const alarmInterval = useRef<any>(null)
  const audioCtx = useRef<AudioContext | null>(null)

  const playAlarm = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtx.current = ctx
      const notes = [880,1100,880,1320,880,1100,1320,1760,880,1320]
      let t = ctx.currentTime
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'square'; osc.frequency.value = freq
        gain.gain.setValueAtTime(0, t + i*0.1)
        gain.gain.linearRampToValueAtTime(0.9, t + i*0.1 + 0.02)
        gain.gain.linearRampToValueAtTime(0, t + i*0.1 + 0.09)
        osc.start(t + i*0.1); osc.stop(t + i*0.1 + 0.11)
      })
    } catch(e) {}
    if (navigator.vibrate) navigator.vibrate([500,100,500,100,1000])
  }, [])

  const triggerAlarm = useCallback(() => {
    setAlarm(true)
    playAlarm()
    alarmInterval.current = setInterval(playAlarm, 2500)
  }, [playAlarm])

  const stopAlarm = useCallback(() => {
    setAlarm(false)
    if (alarmInterval.current) { clearInterval(alarmInterval.current); alarmInterval.current = null }
    if (navigator.vibrate) navigator.vibrate(0)
  }, [])

  const loadCommandes = useCallback(async () => {
    const { data } = await supabase
      .from('commandes')
      .select('*, lignes_commande(*)')
      .in('statut', ['nouvelle','en_preparation','prete'])
      .order('heure_creation', { ascending: true })
    if (data) {
      const platsOnly = data.map((c: any) => ({
        ...c,
        lignes: (c.lignes_commande || []).filter((l: LigneCommande) => l.destination === 'cuisine')
      })).filter((c: any) => c.lignes.length > 0)

      const nouveaux = platsOnly.filter((c: any) => !knownIds.current.has(c.id))
      if (nouveaux.length > 0) {
        setNewCmd(nouveaux.map((c: any) => c.id))
        triggerAlarm()
        nouveaux.forEach((c: any) => knownIds.current.add(c.id))
        setTimeout(() => setNewCmd([]), 3000)
      }
      platsOnly.forEach((c: any) => knownIds.current.add(c.id))
      setCommandes(platsOnly)
    }
  }, [triggerAlarm])

  useEffect(() => {
    loadCommandes()
    const channel = supabase.channel('cuisine')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commandes' }, loadCommandes)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commandes' }, loadCommandes)
      .subscribe()
    return () => { supabase.removeChannel(channel); if(alarmInterval.current) clearInterval(alarmInterval.current) }
  }, [loadCommandes])

  const changerStatut = async (id: number, statut: Statut) => {
    await supabase.from('commandes').update({ statut, heure_modif: new Date().toISOString() }).eq('id', id)
    if (statut === 'prete') {
      // petit son "ding" pour signaler prêt
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = 1047; osc.type = 'sine'
        gain.gain.setValueAtTime(0.7, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
        osc.start(); osc.stop(ctx.currentTime + 0.8)
      } catch(e) {}
    }
    loadCommandes()
  }

  const stats = {
    nouvelles: commandes.filter(c => c.statut === 'nouvelle').length,
    prep: commandes.filter(c => c.statut === 'en_preparation').length,
    pretes: commandes.filter(c => c.statut === 'prete').length,
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      {/* ALARM */}
      {alarm && (
        <div className="alarm-overlay" onClick={stopAlarm}>
          <div className="alarm-banner">
            🔔 NOUVELLE COMMANDE !<br />
            <span style={{ fontSize:'0.35em', letterSpacing:'3px' }}>APPUYER POUR COUPER</span>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="app-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span className="live-dot" />
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
        <div className="stat-item"><div className="stat-num" style={{ color:'var(--red)' }}>{stats.nouvelles}</div><div className="stat-lbl">Nouvelles</div></div>
        <div className="stat-item"><div className="stat-num" style={{ color:'var(--yellow)' }}>{stats.prep}</div><div className="stat-lbl">En prép.</div></div>
        <div className="stat-item"><div className="stat-num" style={{ color:'var(--green)' }}>{stats.pretes}</div><div className="stat-lbl">Prêtes</div></div>
        <div className="stat-item"><div className="stat-num">{commandes.length}</div><div className="stat-lbl">Total</div></div>
      </div>

      {/* COMMANDES */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {commandes.length === 0 ? (
          <div className="empty-state"><span className="emoji">🍳</span><p>En attente de commandes...</p></div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {commandes.map(cmd => (
              <CuisineCard key={cmd.id} cmd={cmd} isNew={newCmd.includes(cmd.id)} onStatut={changerStatut} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CuisineCard({ cmd, isNew, onStatut }: { cmd: any; isNew: boolean; onStatut:(id:number,s:any)=>void }) {
  const heure = new Date(cmd.heure_creation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
  const elapsed = Math.floor((Date.now() - new Date(cmd.heure_creation).getTime()) / 60000)
  const urgent = elapsed > 20 && cmd.statut !== 'prete'

  return (
    <div className={`commande-card ${cmd.statut} ${isNew ? 'flash-new' : ''}`} style={{ borderLeftWidth:'5px' }}>
      {/* TOP */}
      <div style={{ padding:'16px 16px 12px', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'2.8rem', lineHeight:1, color: cmd.statut==='nouvelle'?'var(--red)':cmd.statut==='en_preparation'?'var(--yellow)':'var(--green)' }}>
            #{String(cmd.numero||cmd.id).padStart(3,'0')}
          </div>
          <div>
            <div style={{ display:'flex', gap:'6px', alignItems:'center', marginBottom:'4px' }}>
              <span className={`source-tag source-${cmd.source.toLowerCase().replace(/ /g,'').replace('àemporter','emporter')}`}>{cmd.source}</span>
              {cmd.table_ref && <span style={{ fontSize:'0.8rem', color:'var(--text2)' }}>{cmd.table_ref}</span>}
            </div>
            <div style={{ fontSize:'0.75rem', color: urgent?'var(--red)':'var(--text3)' }}>
              ⏱ {elapsed} min{urgent?' — URGENT !':''}
            </div>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'0.65rem', color:'var(--text3)', letterSpacing:'1px' }}>{heure}</div>
          {cmd.statut === 'nouvelle' && <div style={{ marginTop:'4px' }}><span className="badge badge-red">Nouvelle</span></div>}
          {cmd.statut === 'en_preparation' && <div style={{ marginTop:'4px' }}><span className="badge" style={{ background:'var(--yellow-soft)', color:'var(--yellow)', border:'1px solid var(--yellow)' }}>En prépa.</span></div>}
          {cmd.statut === 'prete' && <div style={{ marginTop:'4px' }}><span className="badge badge-green">Prête ✓</span></div>}
        </div>
      </div>

      {/* LIGNES PLATS */}
      <div style={{ padding:'0 16px 12px', borderTop:'1px solid var(--border)', paddingTop:'12px' }}>
        {cmd.lignes.map((l: any, i: number) => (
          <div key={i} style={{ padding:'12px 0', borderBottom:'1px solid var(--surface2)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontFamily:'var(--font-display)', fontSize:'2.2rem', color:'var(--red)', minWidth:'50px', textAlign:'center', lineHeight:1 }}>{l.quantite}×</span>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', letterSpacing:'1px', color:'var(--text)', lineHeight:1.1 }}>
                  {l.nom_plat || l.nom}
                </div>
                {l.complement_nom && <div style={{ fontSize:'0.9rem', color:'var(--gold)', marginTop:'6px', fontWeight:600 }}>↳ Avec : {l.complement_nom}</div>}
                {l.remarque && <div style={{ fontSize:'0.85rem', color:'var(--red)', fontStyle:'italic', marginTop:'4px', background:'var(--red-soft)', padding:'4px 8px', borderRadius:'6px' }}>⚠ {l.remarque}</div>}
              </div>
            </div>
          </div>
        ))}
        {cmd.notes && <div style={{ marginTop:'8px', padding:'8px', background:'var(--red-soft)', borderRadius:'8px', fontSize:'0.82rem', color:'var(--red)' }}>📝 {cmd.notes}</div>}
      </div>

      {/* ACTIONS */}
      <div style={{ padding:'12px 16px', display:'flex', gap:'10px', borderTop:'1px solid var(--border)' }}>
        {cmd.statut === 'nouvelle' && (
          <button className="btn-gold" style={{ flex:1, fontSize:'1rem', letterSpacing:'2px', fontFamily:'var(--font-display)', padding:'14px' }} onClick={() => onStatut(cmd.id,'en_preparation')}>
            🔥 EN PRÉPARATION
          </button>
        )}
        {cmd.statut === 'en_preparation' && (
          <button className="btn-green" style={{ flex:1, fontSize:'1rem', letterSpacing:'2px', fontFamily:'var(--font-display)', padding:'14px' }} onClick={() => onStatut(cmd.id,'prete')}>
            ✅ COMMANDE PRÊTE
          </button>
        )}
        {cmd.statut === 'prete' && (
          <button className="btn-secondary" style={{ flex:1, fontSize:'0.85rem', padding:'12px' }} onClick={() => onStatut(cmd.id,'servie')}>
            📦 Servie / Récupérée
          </button>
        )}
      </div>
    </div>
  )
}
