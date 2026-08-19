'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PLATS, CATEGORIES } from '@/lib/menu'

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'menu'|'stats'|'csv'>('menu')
  const [menuCustom, setMenuCustom] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [csvData, setCsvData] = useState('')
  const [newPlat, setNewPlat] = useState({ nom:'', categorie:'plats', prix:'', prix2:'', complement:false, disponible:true })

  const loadMenuCustom = async () => {
    const { data } = await supabase.from('menu_custom').select('*').order('nom')
    setMenuCustom(data || [])
  }

  useEffect(() => { loadMenuCustom() }, [])

  useEffect(() => {
    if (tab === 'stats') loadStats()
    if (tab === 'csv') loadCSV()
  }, [tab])

  const loadStats = async () => {
    const il_y_a_7j = new Date(Date.now() - 7*86400000).toISOString()
    const { data: cmds } = await supabase.from('commandes').select('id,source,montant_total,statut,heure_creation').gte('heure_creation', il_y_a_7j)
    const { data: lignes } = await supabase.from('lignes_commande').select('nom_plat,quantite,sous_total')
    if (!cmds || !lignes) return

    const ca = cmds.reduce((s:number,c:any) => s+(c.montant_total||0), 0)
    const bySource = cmds.reduce((acc:any,c:any) => { acc[c.source]=(acc[c.source]||0)+1; return acc }, {})
    
    // Top plats
    const platCount: Record<string,{nb:number,ca:number}> = {}
    lignes.forEach((l:any) => {
      if (!platCount[l.nom_plat]) platCount[l.nom_plat] = {nb:0,ca:0}
      platCount[l.nom_plat].nb += l.quantite
      platCount[l.nom_plat].ca += l.sous_total
    })
    const topPlats = Object.entries(platCount).sort((a,b) => b[1].nb - a[1].nb).slice(0,10)

    setStats({ ca, nb: cmds.length, bySource, topPlats })
  }

  const loadCSV = async () => {
    const il_y_a_7j = new Date(Date.now() - 7*86400000).toISOString()
    const { data } = await supabase.from('commandes').select('id,source,table_ref,statut,montant_total,heure_creation').gte('heure_creation', il_y_a_7j).order('heure_creation', { ascending:false })
    if (!data) return
    const header = 'ID,Source,Table,Statut,Montant,Date\n'
    const rows = data.map((c:any) => `${c.id},"${c.source}","${c.table_ref||''}",${c.statut},${c.montant_total},"${new Date(c.heure_creation).toLocaleString('fr-FR')}"`).join('\n')
    setCsvData(header + rows)
  }

  const exportCSV = () => {
    const blob = new Blob([csvData], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`lebassamba_${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const addPlat = async () => {
    if (!newPlat.nom || !newPlat.prix) { setMsg('❌ Nom et prix requis'); return }
    const cat = CATEGORIES.find(c => c.id === newPlat.categorie)
    const { error } = await supabase.from('menu_custom').insert({
      nom: newPlat.nom, categorie: newPlat.categorie, prix: Number(newPlat.prix),
      prix2: newPlat.prix2 ? Number(newPlat.prix2) : null,
      complement: newPlat.complement, disponible: true,
      destination: cat?.destination || 'cuisine'
    })
    if (error) { setMsg('❌ Erreur: ' + error.message); return }
    setMsg('✅ Plat ajouté définitivement au menu !')
    setNewPlat({ nom:'', categorie:'plats', prix:'', prix2:'', complement:false, disponible:true })
    loadMenuCustom()
    setTimeout(() => setMsg(''), 3000)
  }

  const [editPlat, setEditPlat] = useState<any>(null)

  const saveEdit = async () => {
    if (!editPlat) return
    const { error } = await supabase.from('menu_custom').update({
      nom: editPlat.nom,
      prix: Number(editPlat.prix),
      prix2: editPlat.prix2 ? Number(editPlat.prix2) : null,
      complement: editPlat.complement,
      categorie: editPlat.categorie,
      destination: CATEGORIES.find(c => c.id === editPlat.categorie)?.destination || 'cuisine'
    }).eq('id', editPlat.id)
    if (error) { setMsg('❌ Erreur: ' + error.message); return }
    setMsg('✅ Plat modifié !')
    setEditPlat(null)
    loadMenuCustom()
    setTimeout(() => setMsg(''), 3000)
  }

  const toggleDispo = async (id: number, disponible: boolean) => {
    await supabase.from('menu_custom').update({ disponible: !disponible }).eq('id', id)
    loadMenuCustom()
  }

  const deletePlat = async (id: number) => {
    if (!confirm('Supprimer ce plat ?')) return
    await supabase.from('menu_custom').delete().eq('id', id)
    loadMenuCustom()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <header className="app-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span className="header-brand">ADMINISTRATION</span>
          <span className="badge badge-gold">ADMIN</span>
        </div>
        <button className="btn-ghost" onClick={() => router.push('/')}>← Accueil</button>
      </header>

      {msg && <div style={{ background: msg.startsWith('✅')?'var(--green-soft)':'var(--red-soft)', color: msg.startsWith('✅')?'var(--green)':'var(--red)', padding:'10px 20px', fontSize:'0.85rem', textAlign:'center' }}>{msg}</div>}

      <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
        <div className="tabs">
          <button className={`tab ${tab==='menu'?'active':''}`} onClick={()=>setTab('menu')}>🍛 Menu</button>
          <button className={`tab ${tab==='stats'?'active':''}`} onClick={()=>setTab('stats')}>📊 Stats</button>
          <button className={`tab ${tab==='csv'?'active':''}`} onClick={()=>setTab('csv')}>📥 Export CSV</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>

        {/* ── MENU ── */}
        {tab === 'menu' && (
          <>
            {/* AJOUTER */}
            <div className="card" style={{ padding:'16px', marginBottom:'16px' }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', letterSpacing:'2px', marginBottom:'14px', color:'var(--gold)' }}>
                ➕ AJOUTER UN PLAT AU MENU
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <div><label className="field-label">Nom</label><input value={newPlat.nom} onChange={e=>setNewPlat(p=>({...p,nom:e.target.value}))} placeholder="Ex: Ndolé Royal"/></div>
                <div><label className="field-label">Catégorie</label>
                  <select value={newPlat.categorie} onChange={e=>setNewPlat(p=>({...p,categorie:e.target.value}))}>
                    {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.nom} ({c.destination})</option>)}
                  </select>
                </div>
                <div style={{display:'flex',gap:'10px'}}>
                  <div style={{flex:1}}><label className="field-label">Prix (€)</label><input type="number" value={newPlat.prix} onChange={e=>setNewPlat(p=>({...p,prix:e.target.value}))} placeholder="20"/></div>
                  <div style={{flex:1}}><label className="field-label">Prix 2 (optionnel)</label><input type="number" value={newPlat.prix2} onChange={e=>setNewPlat(p=>({...p,prix2:e.target.value}))} placeholder="25"/></div>
                </div>
                <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'0.85rem',cursor:'pointer'}}>
                  <input type="checkbox" checked={newPlat.complement} onChange={e=>setNewPlat(p=>({...p,complement:e.target.checked}))} style={{width:'auto'}}/>
                  A des compléments (bobolo, aloco, riz...)
                </label>
                <button className="btn-primary" onClick={addPlat}>➕ Ajouter définitivement</button>
              </div>
            </div>

            {/* PLATS CUSTOM */}
            {menuCustom.length > 0 && (
              <div className="card" style={{ marginBottom:'16px' }}>
                <div style={{ padding:'12px 16px', background:'var(--surface2)', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-display)', letterSpacing:'2px', fontSize:'1rem' }}>
                  ⭐ PLATS AJOUTÉS PAR L'ADMIN ({menuCustom.length})
                </div>
                {menuCustom.map(p => (
                  <div key={p.id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--surface2)', display:'flex', justifyContent:'space-between', alignItems:'center', opacity:p.disponible?1:0.5 }}>
                    <div>
                      <span style={{fontWeight:600}}>{p.nom}</span>
                      <span style={{fontSize:'0.72rem',color:'var(--text2)',marginLeft:'8px'}}>{p.categorie}</span>
                      {p.complement && <span style={{fontSize:'0.7rem',color:'var(--gold)',marginLeft:'8px'}}>+ compléments</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <span style={{fontFamily:'var(--font-display)',color:'var(--gold)'}}>{p.prix}€{p.prix2?` / ${p.prix2}€`:''}</span>
                      <button onClick={()=>setEditPlat({...p})} style={{fontSize:'0.7rem',padding:'3px 10px',borderRadius:'20px',border:'1px solid var(--blue)',background:'transparent',color:'var(--blue)',cursor:'pointer'}}>✏️ Modifier</button>
                      <button onClick={()=>toggleDispo(p.id,p.disponible)} style={{fontSize:'0.7rem',padding:'3px 10px',borderRadius:'20px',border:`1px solid ${p.disponible?'var(--green)':'var(--border)'}`,background:'transparent',color:p.disponible?'var(--green)':'var(--text3)',cursor:'pointer'}}>
                        {p.disponible?'✓ Dispo':'✗ Indispo'}
                      </button>
                      <button onClick={()=>deletePlat(p.id)} style={{background:'transparent',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:'1rem'}} onMouseEnter={e=>(e.currentTarget.style.color='var(--red)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text3)')}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MODAL MODIFICATION */}
            {editPlat && (
              <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditPlat(null)}>
                <div className="modal" style={{maxWidth:'460px'}}>
                  <div className="modal-header">
                    <span className="modal-title">✏️ MODIFIER LE PLAT</span>
                    <button className="btn-ghost" onClick={()=>setEditPlat(null)}>✕</button>
                  </div>
                  <div className="modal-body">
                    <label className="field-label">Nom</label>
                    <input value={editPlat.nom} onChange={e=>setEditPlat((p:any)=>({...p,nom:e.target.value}))} style={{marginBottom:'10px'}}/>
                    <label className="field-label">Catégorie</label>
                    <select value={editPlat.categorie} onChange={e=>setEditPlat((p:any)=>({...p,categorie:e.target.value}))} style={{marginBottom:'10px'}}>
                      {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.nom} ({c.destination})</option>)}
                    </select>
                    <div style={{display:'flex',gap:'10px',marginBottom:'10px'}}>
                      <div style={{flex:1}}>
                        <label className="field-label">Prix (€)</label>
                        <input type="number" value={editPlat.prix} onChange={e=>setEditPlat((p:any)=>({...p,prix:e.target.value}))}/>
                      </div>
                      <div style={{flex:1}}>
                        <label className="field-label">Prix 2 (optionnel)</label>
                        <input type="number" value={editPlat.prix2||''} onChange={e=>setEditPlat((p:any)=>({...p,prix2:e.target.value}))}/>
                      </div>
                    </div>
                    <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'0.85rem',cursor:'pointer',marginBottom:'16px'}}>
                      <input type="checkbox" checked={editPlat.complement} onChange={e=>setEditPlat((p:any)=>({...p,complement:e.target.checked}))} style={{width:'auto'}}/>
                      A des compléments
                    </label>
                    <div style={{display:'flex',gap:'10px'}}>
                      <button className="btn-ghost" onClick={()=>setEditPlat(null)} style={{flex:1}}>Annuler</button>
                      <button className="btn-primary" onClick={saveEdit} style={{flex:2}}>✅ Enregistrer</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PLATS DE BASE */}
            <div style={{fontSize:'0.72rem',color:'var(--text3)',textAlign:'center',marginBottom:'10px',letterSpacing:'1px',textTransform:'uppercase'}}>
              Menu de base ({PLATS.length} plats) — modifiable par le développeur
            </div>
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="card" style={{marginBottom:'10px'}}>
                <div style={{padding:'10px 16px',background:'var(--surface2)',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontFamily:'var(--font-display)',fontSize:'0.9rem',letterSpacing:'2px'}}>{cat.emoji} {cat.nom.toUpperCase()}</span>
                  <span className={`badge ${cat.destination==='cuisine'?'badge-red':'badge-blue'}`}>{cat.destination==='cuisine'?'🔽 Cuisine':'🔼 Accueil'}</span>
                </div>
                {PLATS.filter(p=>p.categorie===cat.id).sort((a,b)=>a.nom.localeCompare(b.nom,'fr')).map(p=>(
                  <div key={p.id} style={{padding:'8px 16px',borderBottom:'1px solid var(--surface2)',display:'flex',justifyContent:'space-between',fontSize:'0.85rem'}}>
                    <span>{p.nom}</span>
                    <span style={{color:'var(--gold)'}}>{p.prix}€{(p as any).prix2?` / ${(p as any).prix2}€`:''}</span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {/* ── STATS ── */}
        {tab === 'stats' && (
          <div>
            {!stats ? <div className="empty-state"><span className="emoji">⏳</span><p>Chargement...</p></div> : (
              <>
                <div style={{display:'flex',gap:'12px',marginBottom:'16px',flexWrap:'wrap'}}>
                  <div className="card" style={{flex:1,minWidth:'120px',padding:'14px',textAlign:'center'}}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:'2rem',color:'var(--gold)'}}>{stats.ca.toFixed(0)}€</div>
                    <div style={{fontSize:'0.62rem',color:'var(--text2)',letterSpacing:'2px',textTransform:'uppercase',marginTop:'4px'}}>CA 7 jours</div>
                  </div>
                  <div className="card" style={{flex:1,minWidth:'120px',padding:'14px',textAlign:'center'}}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:'2rem',color:'var(--red)'}}>{stats.nb}</div>
                    <div style={{fontSize:'0.62rem',color:'var(--text2)',letterSpacing:'2px',textTransform:'uppercase',marginTop:'4px'}}>Commandes</div>
                  </div>
                </div>

                {/* PAR SOURCE */}
                <div className="card" style={{padding:'16px',marginBottom:'14px'}}>
                  <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',letterSpacing:'2px',marginBottom:'12px'}}>PAR SOURCE</div>
                  {Object.entries(stats.bySource).sort((a:any,b:any)=>b[1]-a[1]).map(([src,nb]:any)=>(
                    <div key={src} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--surface2)',fontSize:'0.85rem'}}>
                      <span>{src}</span><span style={{fontWeight:700,color:'var(--gold)'}}>{nb} cmd</span>
                    </div>
                  ))}
                </div>

                {/* TOP PLATS */}
                <div className="card" style={{padding:'16px'}}>
                  <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',letterSpacing:'2px',marginBottom:'12px'}}>🏆 TOP 10 PLATS</div>
                  {stats.topPlats.map(([nom,data]:any,i:number)=>(
                    <div key={nom} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--surface2)',fontSize:'0.85rem'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <span style={{fontFamily:'var(--font-display)',fontSize:'1.1rem',color:i<3?'var(--gold)':'var(--text3)',minWidth:'28px'}}>#{i+1}</span>
                        <span>{nom}</span>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontWeight:700,color:'var(--red)'}}>{data.nb}×</div>
                        <div style={{fontSize:'0.72rem',color:'var(--gold)'}}>{data.ca.toFixed(0)}€</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CSV ── */}
        {tab === 'csv' && (
          <div>
            <div className="card" style={{padding:'20px',textAlign:'center',marginBottom:'16px'}}>
              <div style={{fontSize:'3rem',marginBottom:'12px'}}>📥</div>
              <div style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',letterSpacing:'2px',marginBottom:'8px'}}>EXPORT CSV</div>
              <div style={{fontSize:'0.82rem',color:'var(--text2)',marginBottom:'16px'}}>7 derniers jours de commandes</div>
              <button className="btn-primary" onClick={exportCSV} style={{width:'100%'}}>
                📥 Télécharger le CSV
              </button>
            </div>
            {csvData && (
              <div className="card" style={{padding:'12px'}}>
                <div style={{fontSize:'0.72rem',color:'var(--text3)',fontFamily:'monospace',whiteSpace:'pre-wrap',maxHeight:'300px',overflowY:'auto'}}>
                  {csvData.split('\n').slice(0,6).join('\n')}...
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
