'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HistoriquePage() {
  const router = useRouter()
  const [historique, setHistorique] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('historique_journalier').select('*').order('date_journee', { ascending: false }).limit(7)
      setHistorique(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const total7j = historique.reduce((s, h) => s + (h.chiffre_affaires || 0), 0)
  const totalCmds = historique.reduce((s, h) => s + (h.nb_commandes || 0), 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <header className="app-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span className="header-brand">LE BASSAMBA</span>
          <span className="badge badge-gold">HISTORIQUE</span>
        </div>
        <button className="btn-ghost" onClick={() => router.push('/')}>← Retour</button>
      </header>

      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {/* RÉSUMÉ 7 JOURS */}
        <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
          <div className="card" style={{ flex:1, minWidth:'140px', padding:'16px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'var(--gold)' }}>{total7j}€</div>
            <div style={{ fontSize:'0.65rem', color:'var(--text2)', letterSpacing:'2px', textTransform:'uppercase', marginTop:'4px' }}>CA 7 jours</div>
          </div>
          <div className="card" style={{ flex:1, minWidth:'140px', padding:'16px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'var(--red)' }}>{totalCmds}</div>
            <div style={{ fontSize:'0.65rem', color:'var(--text2)', letterSpacing:'2px', textTransform:'uppercase', marginTop:'4px' }}>Commandes</div>
          </div>
          <div className="card" style={{ flex:1, minWidth:'140px', padding:'16px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'var(--green)' }}>{historique.length}</div>
            <div style={{ fontSize:'0.65rem', color:'var(--text2)', letterSpacing:'2px', textTransform:'uppercase', marginTop:'4px' }}>Jours actifs</div>
          </div>
        </div>

        {loading && <div className="empty-state"><span className="emoji">⏳</span><p>Chargement...</p></div>}

        {!loading && historique.length === 0 && (
          <div className="empty-state"><span className="emoji">📅</span><p>Aucun historique disponible</p></div>
        )}

        {historique.map(h => (
          <div key={h.id} className="card" style={{ marginBottom:'10px', cursor:'pointer' }} onClick={() => setSelected(selected?.id===h.id?null:h)}>
            <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'1.2rem', letterSpacing:'2px' }}>
                  {new Date(h.date_journee).toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long'})}
                </div>
                <div style={{ display:'flex', gap:'8px', marginTop:'6px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'0.7rem', color:'var(--red)' }}>🍛 {h.nb_presentiel} prés.</span>
                  <span style={{ fontSize:'0.7rem', color:'var(--gold)' }}>📦 {h.nb_emporter} emporter</span>
                  <span style={{ fontSize:'0.7rem', color:'#00CCBC' }}>🟦 {h.nb_deliveroo} Deliveroo</span>
                  <span style={{ fontSize:'0.7rem', color:'var(--green)' }}>🟩 {h.nb_ubereats} Uber</span>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', color:'var(--gold)' }}>{h.chiffre_affaires || 0}€</div>
                <div style={{ fontSize:'0.7rem', color:'var(--text2)' }}>{h.nb_commandes} commandes</div>
              </div>
            </div>
            {selected?.id === h.id && h.detail_json && (
              <div style={{ borderTop:'1px solid var(--border)', padding:'12px 16px', maxHeight:'300px', overflowY:'auto' }}>
                {JSON.parse(h.detail_json).map((cmd: any, i: number) => (
                  <div key={i} style={{ padding:'6px 0', borderBottom:'1px solid var(--surface2)', fontSize:'0.82rem', display:'flex', justifyContent:'space-between' }}>
                    <span>#{String(cmd.numero||cmd.id).padStart(3,'0')} · {cmd.source} {cmd.table_ref?`· ${cmd.table_ref}`:''}</span>
                    <span style={{ color:'var(--gold)', fontWeight:600 }}>{cmd.montant_total}€</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop:'16px', padding:'12px', background:'var(--surface2)', borderRadius:'var(--radius)', fontSize:'0.75rem', color:'var(--text3)', textAlign:'center' }}>
          ℹ️ L'historique est conservé 7 jours · Auto-suppression chaque soir à 23h59
        </div>
      </div>
    </div>
  )
}
