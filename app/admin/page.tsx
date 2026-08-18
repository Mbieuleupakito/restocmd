'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PLATS, CATEGORIES, COMPLEMENTS } from '@/lib/menu'

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'menu'|'commandes'|'stats'>('menu')
  const [plats, setPlats] = useState<any[]>(PLATS as any[])
  const [msg, setMsg] = useState('')

  const [newPlat, setNewPlat] = useState({ nom:'', categorie:'plats', prix:'', prix2:'', disponible:true, complement:false })

  const addPlat = () => {
    if (!newPlat.nom || !newPlat.prix) return
    const p = { ...newPlat, id: Date.now(), prix: Number(newPlat.prix), prix2: newPlat.prix2 ? Number(newPlat.prix2) : null }
    setPlats(prev => [...prev, p as any])
    setNewPlat({ nom:'', categorie:'plats', prix:'', prix2:'', disponible:true, complement:false })
    setMsg('✅ Plat ajouté ! (redéployez pour le rendre permanent)')
    setTimeout(() => setMsg(''), 3000)
  }

  const toggleDispo = (id: number) => {
    setPlats(prev => prev.map(p => p.id === id ? { ...p, disponible: !(p as any).disponible } : p))
  }

  const [stats, setStats] = useState<any>(null)
  useEffect(() => {
    if (tab === 'stats') {
      supabase.from('commandes').select('statut, montant_total, source, heure_creation')
        .gte('heure_creation', new Date(Date.now() - 86400000).toISOString())
        .then(({ data }) => {
          if (!data) return
          const total = data.reduce((s,c) => s + (c.montant_total||0), 0)
          const bySource = data.reduce((acc: any, c) => { acc[c.source] = (acc[c.source]||0)+1; return acc }, {})
          setStats({ total, nb: data.length, bySource })
        })
    }
  }, [tab])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <header className="app-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span className="header-brand">ADMINISTRATION</span>
          <span className="badge badge-gold">ADMIN</span>
        </div>
        <button className="btn-ghost" onClick={() => router.push('/')}>← Accueil</button>
      </header>

      {msg && <div style={{ background:'var(--green-soft)', color:'var(--green)', padding:'10px 20px', fontSize:'0.85rem', textAlign:'center' }}>{msg}</div>}

      <div style={{ padding:'16px', borderBottom:'1px solid var(--border)' }}>
        <div className="tabs">
          <button className={`tab ${tab==='menu'?'active':''}`} onClick={() => setTab('menu')}>🍛 Gestion Menu</button>
          <button className={`tab ${tab==='stats'?'active':''}`} onClick={() => setTab('stats')}>📊 Statistiques</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>

        {tab === 'menu' && (
          <>
            {/* AJOUTER PLAT */}
            <div className="card" style={{ padding:'16px', marginBottom:'16px' }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', letterSpacing:'2px', marginBottom:'14px', color:'var(--gold)' }}>➕ AJOUTER UN ARTICLE</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <div><label className="field-label">Nom du plat / article</label><input value={newPlat.nom} onChange={e => setNewPlat(p=>({...p,nom:e.target.value}))} placeholder="Ex: Ndolé Royal" /></div>
                <div><label className="field-label">Catégorie</label>
                  <select value={newPlat.categorie} onChange={e => setNewPlat(p=>({...p,categorie:e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nom}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', gap:'10px' }}>
                  <div style={{ flex:1 }}><label className="field-label">Prix (€)</label><input type="number" value={newPlat.prix} onChange={e => setNewPlat(p=>({...p,prix:e.target.value}))} placeholder="20" /></div>
                  <div style={{ flex:1 }}><label className="field-label">Prix 2 (optionnel)</label><input type="number" value={newPlat.prix2} onChange={e => setNewPlat(p=>({...p,prix2:e.target.value}))} placeholder="25" /></div>
                </div>
                <div style={{ display:'flex', gap:'16px' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'0.85rem', cursor:'pointer' }}>
                    <input type="checkbox" checked={newPlat.complement} onChange={e => setNewPlat(p=>({...p,complement:e.target.checked}))} style={{ width:'auto' }} />
                    A des compléments
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'0.85rem', cursor:'pointer' }}>
                    <input type="checkbox" checked={newPlat.disponible} onChange={e => setNewPlat(p=>({...p,disponible:e.target.checked}))} style={{ width:'auto' }} />
                    Disponible
                  </label>
                </div>
                <button className="btn-primary" onClick={addPlat}>➕ Ajouter au menu</button>
              </div>
            </div>

            {/* LISTE PAR CATÉGORIE */}
            {CATEGORIES.map(cat => {
              const items = plats.filter(p => p.categorie === cat.id)
              return (
                <div key={cat.id} className="card" style={{ marginBottom:'12px', overflow:'hidden' }}>
                  <div style={{ padding:'12px 16px', background:'var(--surface2)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontFamily:'var(--font-display)', fontSize:'1rem', letterSpacing:'2px' }}>{cat.emoji} {cat.nom.toUpperCase()}</span>
                    <span className={`badge ${cat.destination==='cuisine'?'badge-red':'badge-blue'}`}>{cat.destination === 'cuisine' ? '🔽 Cuisine' : '🔼 Accueil'}</span>
                  </div>
                  {items.map(p => (
                    <div key={p.id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--surface2)', display:'flex', justifyContent:'space-between', alignItems:'center', opacity: (p as any).disponible ? 1 : 0.5 }}>
                      <div>
                        <span style={{ fontSize:'0.9rem', fontWeight:500 }}>{p.nom}</span>
                        {p.complement && <span style={{ fontSize:'0.7rem', color:'var(--gold)', marginLeft:'8px' }}>+ compléments</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <span style={{ fontFamily:'var(--font-display)', color:'var(--gold)' }}>{p.prix}€{p.prix2?` / ${p.prix2}€`:''}</span>
                        <button onClick={() => toggleDispo(p.id)} style={{ fontSize:'0.7rem', padding:'4px 10px', borderRadius:'20px', border:`1px solid ${(p as any).disponible?'var(--green)':'var(--border)'}`, background:'transparent', color: (p as any).disponible?'var(--green)':'var(--text3)', cursor:'pointer' }}>
                          {(p as any).disponible ? '✓ Dispo' : '✗ Indispo'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}

        {tab === 'stats' && stats && (
          <div>
            <div style={{ display:'flex', gap:'12px', marginBottom:'16px', flexWrap:'wrap' }}>
              <div className="card" style={{ flex:1, minWidth:'140px', padding:'16px', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'2.5rem', color:'var(--gold)' }}>{stats.total}€</div>
                <div style={{ fontSize:'0.65rem', color:'var(--text2)', letterSpacing:'2px', textTransform:'uppercase' }}>CA aujourd'hui</div>
              </div>
              <div className="card" style={{ flex:1, minWidth:'140px', padding:'16px', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'2.5rem', color:'var(--red)' }}>{stats.nb}</div>
                <div style={{ fontSize:'0.65rem', color:'var(--text2)', letterSpacing:'2px', textTransform:'uppercase' }}>Commandes</div>
              </div>
            </div>
            <div className="card" style={{ padding:'16px' }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'1rem', letterSpacing:'2px', marginBottom:'12px' }}>PAR SOURCE</div>
              {Object.entries(stats.bySource).map(([src, nb]: any) => (
                <div key={src} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--surface2)', fontSize:'0.85rem' }}>
                  <span>{src}</span><span style={{ fontWeight:600 }}>{nb} commandes</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
