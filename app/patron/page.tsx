'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Commande {
  id: number; source: string; table_ref: string; statut: string
  montant_total: number; heure_creation: string; notes: string
}

export default function PatronPage() {
  const router = useRouter()
  const [auth, setAuth] = useState(false)
  const [pin, setPin] = useState('')
  const [errPin, setErrPin] = useState(false)
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [historique, setHistorique] = useState<Commande[]>([])
  const [tab, setTab] = useState<'live'|'jour'|'semaine'>('live')
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    // Commandes actives
    const { data: actives } = await supabase
      .from('commandes').select('*')
      .neq('statut', 'servie')
      .order('heure_creation', { ascending: false })

    // Historique 7 jours
    const il_y_a_7j = new Date(Date.now() - 7*86400000).toISOString()
    const { data: hist } = await supabase
      .from('commandes').select('*')
      .gte('heure_creation', il_y_a_7j)
      .order('heure_creation', { ascending: false })

    setCommandes(actives || [])
    setHistorique(hist || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!auth) return
    loadData()
    const ch = supabase.channel('patron')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [auth, loadData])

  const tryPin = () => {
    if (pin === '0000') { setAuth(true); setErrPin(false) }
    else { setErrPin(true); setPin('') }
  }

  // ── CALCULS ──────────────────────────────────────────────
  const today = now.toDateString()
  const cmdAujourdhui = historique.filter(c => new Date(c.heure_creation).toDateString() === today)
  const caJour = cmdAujourdhui.reduce((s, c) => s + (c.montant_total||0), 0)
  const caSemaine = historique.reduce((s, c) => s + (c.montant_total||0), 0)

  // Tranches horaires du jour
  const tranches = [
    { label: 'Matin', sublabel: '10h — 12h', debut: 10, fin: 12 },
    { label: 'Midi',  sublabel: '12h — 15h', debut: 12, fin: 15 },
    { label: 'Après-midi', sublabel: '15h — 18h', debut: 15, fin: 18 },
    { label: 'Soir',  sublabel: '18h — 23h', debut: 18, fin: 23 },
  ].map(t => {
    const cmds = cmdAujourdhui.filter(c => {
      const h = new Date(c.heure_creation).getHours()
      return h >= t.debut && h < t.fin
    })
    return { ...t, nb: cmds.length, ca: cmds.reduce((s,c) => s+(c.montant_total||0), 0) }
  }).filter(t => t.nb > 0)

  // Jours de la semaine
  const parJour = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - i*86400000)
    const ds = d.toDateString()
    const cmds = historique.filter(c => new Date(c.heure_creation).toDateString() === ds)
    return {
      date: d,
      label: i === 0 ? "Aujourd'hui" : i === 1 ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'short' }),
      nb: cmds.length,
      ca: cmds.reduce((s,c) => s+(c.montant_total||0), 0),
    }
  }).filter(j => j.nb > 0)

  const S = {
    page: { minHeight:'100vh', background:'#0A0A0A', color:'#F0F0F0', fontFamily:'DM Sans, Arial, sans-serif' } as React.CSSProperties,
  }

  // ── LOGIN ────────────────────────────────────────────────
  if (!auth) return (
    <div style={{ ...S.page, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
      <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'3rem', color:'#CC1414', letterSpacing:'4px', marginBottom:'8px' }}>LE BASSAMBA</div>
      <div style={{ fontSize:'0.8rem', color:'#606060', letterSpacing:'3px', marginBottom:'48px' }}>ESPACE PATRON</div>

      <div style={{ background:'#141414', border:'1px solid #2E2E2E', borderRadius:'16px', padding:'32px 28px', width:'100%', maxWidth:'320px' }}>
        <div style={{ textAlign:'center', fontSize:'2rem', marginBottom:'16px' }}>👨‍💼</div>
        <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.3rem', letterSpacing:'2px', textAlign:'center', marginBottom:'20px' }}>CODE PATRON</div>

        <input type="password" value={pin} onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key==='Enter' && tryPin()}
          placeholder="••••" maxLength={4}
          style={{ width:'100%', background:'#1C1C1C', border:`2px solid ${errPin?'#CC1414':'#2E2E2E'}`, borderRadius:'10px', color:'#F0F0F0', padding:'14px', fontSize:'1.5rem', textAlign:'center', letterSpacing:'8px', outline:'none', boxSizing:'border-box', marginBottom:'10px' }}
        />
        {errPin && <div style={{ color:'#CC1414', fontSize:'0.8rem', textAlign:'center', marginBottom:'10px' }}>❌ Code incorrect</div>}
        <button onClick={tryPin}
          style={{ width:'100%', background:'#CC1414', color:'white', border:'none', borderRadius:'10px', padding:'14px', fontSize:'1rem', fontWeight:700, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
          Entrer
        </button>
      </div>
    </div>
  )

  // ── TABLEAU DE BORD ──────────────────────────────────────
  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={{ background:'#141414', borderBottom:'1px solid #2E2E2E', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div onClick={() => router.push('/')} style={{ cursor:'pointer' }}>
          <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.5rem', color:'#CC1414', letterSpacing:'3px', lineHeight:1 }}>LE BASSAMBA</div>
          <div style={{ fontSize:'0.62rem', color:'#606060', letterSpacing:'2px' }}>ESPACE PATRON · Tap pour accueil</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.3rem', color:'#D4A843' }}>
              {now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
            </div>
            <div style={{ fontSize:'0.7rem', color:'#606060' }}>
              {now.toLocaleDateString('fr-FR', { weekday:'short', day:'2-digit', month:'short' })}
            </div>
          </div>
          <button onClick={() => router.push('/')} style={{ background:'#1C1C1C', border:'1px solid #2E2E2E', color:'#A0A0A0', borderRadius:'8px', padding:'8px 12px', fontSize:'0.8rem', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
            ← Retour
          </button>
        </div>
      </div>

      <div style={{ padding:'16px', maxWidth:'700px', margin:'0 auto' }}>

        {/* CHIFFRES CLÉS EN HAUT */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'20px' }}>
          <BigStat label="CA Aujourd'hui" value={`${caJour}€`} color="#D4A843" emoji="💰"/>
          <BigStat label="CA Semaine" value={`${caSemaine}€`} color="#22C55E" emoji="📈"/>
          <BigStat label="En cours" value={String(commandes.length)} color="#CC1414" emoji="🍛"/>
        </div>

        {/* TABS */}
        <div style={{ display:'flex', background:'#1C1C1C', borderRadius:'10px', padding:'4px', marginBottom:'16px', gap:'4px' }}>
          {[
            { id:'live', label:'🔴 En direct' },
            { id:'jour', label:"📅 Aujourd'hui" },
            { id:'semaine', label:'📊 La semaine' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{ flex:1, padding:'10px 6px', borderRadius:'8px', border:'none', background: tab===t.id ? '#141414' : 'transparent', color: tab===t.id ? '#F0F0F0' : '#606060', fontSize:'0.78rem', fontWeight: tab===t.id ? 700 : 400, cursor:'pointer', fontFamily:'DM Sans, sans-serif', boxShadow: tab===t.id ? '0 1px 4px rgba(0,0,0,0.4)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign:'center', padding:'40px', color:'#606060' }}>⏳ Chargement...</div>}

        {/* ── EN DIRECT ── */}
        {!loading && tab === 'live' && (
          <>
            {commandes.length === 0 ? (
              <EmptyState emoji="🍳" text="Aucune commande en cours" />
            ) : (
              <>
                <SectionTitle title={`${commandes.length} commande${commandes.length>1?'s':''} en cours`} />
                {commandes.map(cmd => <CommandeRow key={cmd.id} cmd={cmd} />)}
              </>
            )}
          </>
        )}

        {/* ── AUJOURD'HUI ── */}
        {!loading && tab === 'jour' && (
          <>
            {/* RÉSUMÉ DU JOUR */}
            <div style={{ background:'#141414', border:'1px solid #2E2E2E', borderRadius:'12px', padding:'16px', marginBottom:'14px' }}>
              <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1rem', letterSpacing:'2px', color:'#D4A843', marginBottom:'12px' }}>
                RÉSUMÉ DU JOUR
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px' }}>
                <MiniStat label="Total commandes" value={String(cmdAujourdhui.length)} />
                <MiniStat label="Chiffre d'affaires" value={`${caJour}€`} color="#D4A843" />
                <MiniStat label="Présentiel" value={String(cmdAujourdhui.filter(c=>c.source==='Présentiel').length)} />
                <MiniStat label="À emporter" value={String(cmdAujourdhui.filter(c=>c.source==='À emporter').length)} />
                <MiniStat label="Deliveroo" value={String(cmdAujourdhui.filter(c=>c.source==='Deliveroo').length)} />
                <MiniStat label="Uber Eats" value={String(cmdAujourdhui.filter(c=>c.source==='Uber Eats').length)} />
                <MiniStat label="En ligne" value={String(cmdAujourdhui.filter(c=>c.source==='En ligne').length)} />
                <MiniStat label="Ticket moyen" value={cmdAujourdhui.length>0?`${Math.round(caJour/cmdAujourdhui.length)}€`:'—'} color="#22C55E" />
              </div>
            </div>

            {/* TRANCHES HORAIRES */}
            {tranches.length > 0 && (
              <div style={{ background:'#141414', border:'1px solid #2E2E2E', borderRadius:'12px', padding:'16px', marginBottom:'14px' }}>
                <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1rem', letterSpacing:'2px', color:'#3B82F6', marginBottom:'12px' }}>
                  ⏰ ACTIVITÉ PAR HEURE
                </div>
                {tranches.map((t, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom: i<tranches.length-1?'1px solid #1C1C1C':'none' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'0.9rem' }}>{t.label}</div>
                      <div style={{ fontSize:'0.72rem', color:'#606060' }}>{t.sublabel}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.2rem', color:'#D4A843' }}>{t.ca}€</div>
                      <div style={{ fontSize:'0.72rem', color:'#A0A0A0' }}>{t.nb} commande{t.nb>1?'s':''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TOUTES LES COMMANDES DU JOUR */}
            {cmdAujourdhui.length > 0 && (
              <>
                <SectionTitle title="Toutes les commandes du jour" />
                {cmdAujourdhui.map(cmd => <CommandeRow key={cmd.id} cmd={cmd} />)}
              </>
            )}

            {cmdAujourdhui.length === 0 && <EmptyState emoji="📅" text="Aucune commande aujourd'hui" />}
          </>
        )}

        {/* ── LA SEMAINE ── */}
        {!loading && tab === 'semaine' && (
          <>
            {/* RÉSUMÉ SEMAINE */}
            <div style={{ background:'#141414', border:'1px solid #2E2E2E', borderRadius:'12px', padding:'16px', marginBottom:'14px' }}>
              <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1rem', letterSpacing:'2px', color:'#22C55E', marginBottom:'12px' }}>
                RÉSUMÉ 7 JOURS
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px' }}>
                <MiniStat label="Total commandes" value={String(historique.length)} />
                <MiniStat label="Chiffre d'affaires" value={`${caSemaine}€`} color="#D4A843" />
                <MiniStat label="Ticket moyen" value={historique.length>0?`${Math.round(caSemaine/historique.length)}€`:'—'} color="#22C55E" />
                <MiniStat label="Meilleur jour" value={parJour.length>0?`${Math.max(...parJour.map(j=>j.ca))}€`:'—'} color="#CC1414" />
              </div>
            </div>

            {/* PAR JOUR */}
            <div style={{ background:'#141414', border:'1px solid #2E2E2E', borderRadius:'12px', overflow:'hidden', marginBottom:'14px' }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid #2E2E2E', fontFamily:'Bebas Neue, sans-serif', fontSize:'1rem', letterSpacing:'2px', color:'#A0A0A0' }}>
                DÉTAIL PAR JOUR
              </div>
              {parJour.length === 0 && <div style={{ padding:'20px', textAlign:'center', color:'#606060', fontSize:'0.85rem' }}>Aucune donnée cette semaine</div>}
              {parJour.map((j, i) => (
                <div key={i} style={{ padding:'14px 16px', borderBottom: i<parJour.length-1?'1px solid #1C1C1C':'none', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'0.9rem', textTransform:'capitalize' }}>{j.label}</div>
                    <div style={{ fontSize:'0.72rem', color:'#606060' }}>{j.nb} commande{j.nb>1?'s':''}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.4rem', color:'#D4A843' }}>{j.ca}€</div>
                    {/* Barre visuelle */}
                    <div style={{ width:'80px', height:'4px', background:'#1C1C1C', borderRadius:'2px', marginTop:'4px', overflow:'hidden' }}>
                      <div style={{ height:'100%', background:'#D4A843', borderRadius:'2px', width:`${Math.round((j.ca / Math.max(...parJour.map(x=>x.ca))) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* PAR SOURCE SUR LA SEMAINE */}
            <div style={{ background:'#141414', border:'1px solid #2E2E2E', borderRadius:'12px', padding:'16px' }}>
              <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1rem', letterSpacing:'2px', color:'#A0A0A0', marginBottom:'12px' }}>
                PAR SOURCE
              </div>
              {['Présentiel','À emporter','Deliveroo','Uber Eats','En ligne'].map(src => {
                const cmds = historique.filter(c => c.source === src)
                const ca = cmds.reduce((s,c) => s+(c.montant_total||0), 0)
                if (cmds.length === 0) return null
                return (
                  <div key={src} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #1C1C1C' }}>
                    <span style={{ fontSize:'0.85rem' }}>{src}</span>
                    <div style={{ textAlign:'right' }}>
                      <span style={{ fontWeight:700, color:'#D4A843' }}>{ca}€</span>
                      <span style={{ fontSize:'0.72rem', color:'#606060', marginLeft:'8px' }}>{cmds.length} cmd</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div style={{ height:'30px' }} />
      </div>
    </div>
  )
}

function BigStat({ label, value, color, emoji }: { label:string; value:string; color:string; emoji:string }) {
  return (
    <div style={{ background:'#141414', border:'1px solid #2E2E2E', borderRadius:'12px', padding:'14px 10px', textAlign:'center' }}>
      <div style={{ fontSize:'1.4rem', marginBottom:'4px' }}>{emoji}</div>
      <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.6rem', color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:'0.65rem', color:'#606060', marginTop:'4px', letterSpacing:'1px' }}>{label}</div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label:string; value:string; color?:string }) {
  return (
    <div style={{ background:'#1C1C1C', borderRadius:'8px', padding:'10px 12px' }}>
      <div style={{ fontSize:'0.68rem', color:'#606060', marginBottom:'4px' }}>{label}</div>
      <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.3rem', color: color||'#F0F0F0' }}>{value}</div>
    </div>
  )
}

function SectionTitle({ title }: { title:string }) {
  return (
    <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'0.9rem', letterSpacing:'2px', color:'#606060', marginBottom:'8px', marginTop:'4px' }}>
      {title.toUpperCase()}
    </div>
  )
}

function EmptyState({ emoji, text }: { emoji:string; text:string }) {
  return (
    <div style={{ textAlign:'center', padding:'50px 20px', color:'#606060' }}>
      <div style={{ fontSize:'3rem', marginBottom:'12px' }}>{emoji}</div>
      <div style={{ fontSize:'0.82rem', letterSpacing:'2px', textTransform:'uppercase' }}>{text}</div>
    </div>
  )
}

function CommandeRow({ cmd }: { cmd:Commande }) {
  const heure = new Date(cmd.heure_creation).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })
  const statutColor = cmd.statut==='nouvelle'?'#CC1414':cmd.statut==='en_preparation'?'#EAB308':cmd.statut==='prete'?'#22C55E':'#606060'
  const statutLabel = cmd.statut==='nouvelle'?'Nouvelle':cmd.statut==='en_preparation'?'En prép.':cmd.statut==='prete'?'Prête ✓':'Servie ✓'

  return (
    <div style={{ background:'#141414', border:'1px solid #2E2E2E', borderRadius:'10px', padding:'12px 14px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
          <span style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.1rem', color:'#A0A0A0' }}>#{String(cmd.id).padStart(3,'0')}</span>
          <span style={{ fontSize:'0.72rem', color:'#606060' }}>{cmd.source}</span>
          {cmd.table_ref && <span style={{ fontSize:'0.72rem', color:'#606060' }}>· {cmd.table_ref.split('—')[0].trim()}</span>}
        </div>
        <div style={{ fontSize:'0.72rem', color:'#606060' }}>🕐 {heure}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.2rem', color:'#D4A843' }}>{cmd.montant_total}€</div>
        <div style={{ fontSize:'0.68rem', color: statutColor, fontWeight:700 }}>{statutLabel}</div>
      </div>
    </div>
  )
}
