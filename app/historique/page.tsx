'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HistoriquePage() {
  const router = useRouter()
  const [jours, setJours] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      // Charger les commandes des 7 derniers jours directement
      const il_y_a_7j = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data } = await supabase
        .from('commandes')
        .select('id,source,table_ref,statut,montant_total,heure_creation')
        .gte('heure_creation', il_y_a_7j)
        .order('heure_creation', { ascending: false })

      if (!data) { setLoading(false); return }

      // Grouper par jour
      const map: Record<string, any[]> = {}
      data.forEach((c: any) => {
        const jour = new Date(c.heure_creation).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
        if (!map[jour]) map[jour] = []
        map[jour].push(c)
      })

      const joursData = Object.entries(map).map(([date, cmds]) => ({
        date,
        dateObj: new Date(cmds[0].heure_creation),
        nb_commandes: cmds.length,
        nb_presentiel: cmds.filter(c => c.source === 'Présentiel').length,
        nb_emporter: cmds.filter(c => c.source === 'À emporter').length,
        nb_deliveroo: cmds.filter(c => c.source === 'Deliveroo').length,
        nb_ubereats: cmds.filter(c => c.source === 'Uber Eats').length,
        chiffre_affaires: cmds.reduce((s: number, c: any) => s + (c.montant_total || 0), 0),
        commandes: cmds,
      })).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())

      setJours(joursData)
      setLoading(false)
    }
    load()
  }, [])

  const total7j = jours.reduce((s, j) => s + j.chiffre_affaires, 0)
  const totalCmds = jours.reduce((s, j) => s + j.nb_commandes, 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <header className="app-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span className="header-brand">LE BASSAMBA</span>
          <span className="badge badge-gold">HISTORIQUE 7J</span>
        </div>
        <button className="btn-ghost" onClick={() => router.push('/')}>← Retour</button>
      </header>

      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>

        {/* RÉSUMÉ */}
        <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
          <div className="card" style={{ flex:1, minWidth:'120px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'var(--gold)' }}>{total7j.toFixed(0)}€</div>
            <div style={{ fontSize:'0.62rem', color:'var(--text2)', letterSpacing:'2px', textTransform:'uppercase', marginTop:'4px' }}>CA 7 jours</div>
          </div>
          <div className="card" style={{ flex:1, minWidth:'120px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'var(--red)' }}>{totalCmds}</div>
            <div style={{ fontSize:'0.62rem', color:'var(--text2)', letterSpacing:'2px', textTransform:'uppercase', marginTop:'4px' }}>Commandes</div>
          </div>
          <div className="card" style={{ flex:1, minWidth:'120px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'var(--green)' }}>{jours.length}</div>
            <div style={{ fontSize:'0.62rem', color:'var(--text2)', letterSpacing:'2px', textTransform:'uppercase', marginTop:'4px' }}>Jours actifs</div>
          </div>
        </div>

        {loading && <div className="empty-state"><span className="emoji">⏳</span><p>Chargement...</p></div>}
        {!loading && jours.length === 0 && <div className="empty-state"><span className="emoji">📅</span><p>Aucune commande cette semaine</p></div>}

        {jours.map(j => (
          <div key={j.date} className="card" style={{ marginBottom:'10px' }}>
            <div style={{ padding:'14px 16px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
              onClick={() => setSelected(selected===j.date ? null : j.date)}>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', letterSpacing:'1px' }}>
                  {j.dateObj.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' })}
                </div>
                <div style={{ display:'flex', gap:'10px', marginTop:'6px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'0.7rem', color:'var(--red)' }}>🍛 {j.nb_presentiel} prés.</span>
                  <span style={{ fontSize:'0.7rem', color:'var(--gold)' }}>📦 {j.nb_emporter} emporter</span>
                  <span style={{ fontSize:'0.7rem', color:'#00CCBC' }}>🟦 {j.nb_deliveroo} Deliveroo</span>
                  <span style={{ fontSize:'0.7rem', color:'var(--green)' }}>🟩 {j.nb_ubereats} Uber</span>
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', color:'var(--gold)' }}>{j.chiffre_affaires.toFixed(0)}€</div>
                <div style={{ fontSize:'0.7rem', color:'var(--text2)' }}>{j.nb_commandes} commandes</div>
              </div>
            </div>

            {selected === j.date && (
              <div style={{ borderTop:'1px solid var(--border)', padding:'10px 16px', maxHeight:'300px', overflowY:'auto' }}>
                {j.commandes.map((cmd: any) => (
                  <div key={cmd.id} style={{ padding:'6px 0', borderBottom:'1px solid var(--surface2)', fontSize:'0.82rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                      <span style={{ fontFamily:'var(--font-display)', color:'var(--text2)' }}>#{String(cmd.id).padStart(3,'0')}</span>
                      <span style={{ fontSize:'0.7rem', color:'var(--text3)' }}>{cmd.source}</span>
                      {cmd.table_ref && <span style={{ fontSize:'0.7rem', color:'var(--text3)' }}>· {cmd.table_ref}</span>}
                      <span style={{ fontSize:'0.68rem', padding:'2px 8px', borderRadius:'20px', background: cmd.statut==='servie'?'var(--green-soft)':'var(--red-soft)', color: cmd.statut==='servie'?'var(--green)':'var(--red)' }}>{cmd.statut}</span>
                    </div>
                    <span style={{ color:'var(--gold)', fontWeight:700 }}>{cmd.montant_total}€</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop:'12px', padding:'10px', background:'var(--surface2)', borderRadius:'var(--radius)', fontSize:'0.72rem', color:'var(--text3)', textAlign:'center' }}>
          ℹ️ Historique des 7 derniers jours · Données en temps réel
        </div>
      </div>
    </div>
  )
}
