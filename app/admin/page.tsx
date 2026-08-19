'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const CATEGORIES = [
  { id: 'plats',      nom: 'Plats',      destination: 'cuisine', emoji: '🍛' },
  { id: 'bieres',     nom: 'Bières',     destination: 'accueil', emoji: '🍺' },
  { id: 'vins',       nom: 'Vins',       destination: 'accueil', emoji: '🍷' },
  { id: 'sodas',      nom: 'Sodas',      destination: 'accueil', emoji: '🥤' },
  { id: 'champagnes', nom: 'Champagnes', destination: 'accueil', emoji: '🍾' },
  { id: 'whiskys',    nom: 'Whiskys',    destination: 'accueil', emoji: '🥃' },
  { id: 'formules',   nom: 'Formules',   destination: 'accueil', emoji: '🎯' },
]

const EMPTY_PLAT = { nom:'', categorie:'plats', prix_entier:'', prix_demi:'', a_demi_plat:false, complement:false }

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'menu'|'stats'|'csv'>('menu')
  const [menu, setMenu] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [newPlat, setNewPlat] = useState({ ...EMPTY_PLAT })
  const [editPlat, setEditPlat] = useState<any>(null)
  const [catFilter, setCatFilter] = useState('tous')
  const [stats, setStats] = useState<any>(null)
  const [csvData, setCsvData] = useState('')

  const loadMenu = async () => {
    const { data } = await supabase.from('menu').select('*').order('nom')
    setMenu(data || [])
  }

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  useEffect(() => { loadMenu() }, [])
  useEffect(() => { if (tab === 'stats') loadStats(); if (tab === 'csv') loadCSV() }, [tab])

  const loadStats = async () => {
    const il_y_a_7j = new Date(Date.now() - 7*86400000).toISOString()
    const { data: cmds } = await supabase.from('commandes').select('id,source,montant_total').gte('heure_creation', il_y_a_7j)
    const { data: lignes } = await supabase.from('lignes_commande').select('nom_plat,quantite,sous_total')
    if (!cmds || !lignes) return
    const ca = cmds.reduce((s:number,c:any) => s+(c.montant_total||0), 0)
    const bySource = cmds.reduce((acc:any,c:any) => { acc[c.source]=(acc[c.source]||0)+1; return acc }, {})
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
    const { data } = await supabase.from('commandes').select('id,source,table_ref,statut,montant_total,heure_creation').order('heure_creation',{ascending:false}).limit(200)
    if (!data) return
    const header = 'ID,Source,Table,Statut,Montant,Date\n'
    const rows = data.map((c:any) => `${c.id},"${c.source}","${c.table_ref||''}",${c.statut},${c.montant_total},"${new Date(c.heure_creation).toLocaleString('fr-FR')}"`).join('\n')
    setCsvData(header + rows)
  }

  const addPlat = async () => {
    if (!newPlat.nom || !newPlat.prix_entier) { showMsg('❌ Nom et prix requis'); return }
    const cat = CATEGORIES.find(c => c.id === newPlat.categorie)
    const { error } = await supabase.from('menu').insert({
      nom: newPlat.nom, categorie: newPlat.categorie,
      prix_entier: Number(newPlat.prix_entier),
      prix_demi: newPlat.a_demi_plat && newPlat.prix_demi ? Number(newPlat.prix_demi) : null,
      a_demi_plat: newPlat.a_demi_plat,
      complement: newPlat.complement, disponible: true,
      destination: cat?.destination || 'cuisine'
    })
    if (error) { showMsg('❌ Erreur: ' + error.message); return }
    showMsg('✅ Plat ajouté au menu !')
    setNewPlat({ ...EMPTY_PLAT })
    loadMenu()
  }

  const saveEdit = async () => {
    if (!editPlat) return
    const cat = CATEGORIES.find(c => c.id === editPlat.categorie)
    const { error } = await supabase.from('menu').update({
      nom: editPlat.nom, categorie: editPlat.categorie,
      prix_entier: Number(editPlat.prix_entier),
      prix_demi: editPlat.a_demi_plat && editPlat.prix_demi ? Number(editPlat.prix_demi) : null,
      a_demi_plat: editPlat.a_demi_plat,
      complement: editPlat.complement,
      destination: cat?.destination || 'cuisine'
    }).eq('id', editPlat.id)
    if (error) { showMsg('❌ Erreur: ' + error.message); return }
    showMsg('✅ Plat modifié !')
    setEditPlat(null)
    loadMenu()
  }

  const toggleDispo = async (id: number, disponible: boolean) => {
    await supabase.from('menu').update({ disponible: !disponible }).eq('id', id)
    loadMenu()
  }

  const deletePlat = async (id: number) => {
    if (!confirm('Supprimer ce plat définitivement ?')) return
    await supabase.from('menu').delete().eq('id', id)
    loadMenu()
  }

  const exportCSV = () => {
    const blob = new Blob([csvData], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download=`bassamba_${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const menuFiltré = catFilter === 'tous' ? menu : menu.filter(p => p.categorie === catFilter)

  const PlatForm = ({ data, setData, onSave, onCancel, title }: any) => (
    <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
      <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',letterSpacing:'2px',color:'var(--gold)',marginBottom:'4px'}}>{title}</div>
      <div><label className="field-label">Nom du plat / article</label>
        <input value={data.nom} onChange={e=>setData((p:any)=>({...p,nom:e.target.value}))} placeholder="Ex: Ndolé Royal"/>
      </div>
      <div><label className="field-label">Catégorie</label>
        <select value={data.categorie} onChange={e=>setData((p:any)=>({...p,categorie:e.target.value}))}>
          {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.nom} → {c.destination}</option>)}
        </select>
      </div>
      <div style={{display:'flex',gap:'10px'}}>
        <div style={{flex:1}}><label className="field-label">Prix entier (€)</label>
          <input type="number" value={data.prix_entier} onChange={e=>setData((p:any)=>({...p,prix_entier:e.target.value}))} placeholder="20"/>
        </div>
        <div style={{flex:1}}><label className="field-label">Prix demi-plat (€)</label>
          <input type="number" value={data.prix_demi||''} onChange={e=>setData((p:any)=>({...p,prix_demi:e.target.value}))} placeholder="10" disabled={!data.a_demi_plat} style={{opacity:data.a_demi_plat?1:0.4}}/>
        </div>
      </div>
      <div style={{display:'flex',gap:'20px',flexWrap:'wrap'}}>
        <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'0.85rem',cursor:'pointer'}}>
          <input type="checkbox" checked={data.a_demi_plat} onChange={e=>setData((p:any)=>({...p,a_demi_plat:e.target.checked}))} style={{width:'auto'}}/>
          🍽️ A un demi-plat
        </label>
        <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'0.85rem',cursor:'pointer'}}>
          <input type="checkbox" checked={data.complement} onChange={e=>setData((p:any)=>({...p,complement:e.target.checked}))} style={{width:'auto'}}/>
          🥗 A des compléments
        </label>
      </div>
      <div style={{display:'flex',gap:'10px',marginTop:'4px'}}>
        {onCancel && <button className="btn-ghost" onClick={onCancel} style={{flex:1}}>Annuler</button>}
        <button className="btn-primary" onClick={onSave} style={{flex:2}}>
          {onCancel ? '✅ Enregistrer' : '➕ Ajouter au menu'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
      <header className="app-header">
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span className="header-brand">ADMINISTRATION</span>
          <span className="badge badge-gold">ADMIN</span>
        </div>
        <button className="btn-ghost" onClick={() => router.push('/')}>← Accueil</button>
      </header>

      {msg && <div style={{background:msg.startsWith('✅')?'var(--green-soft)':'var(--red-soft)',color:msg.startsWith('✅')?'var(--green)':'var(--red)',padding:'10px 20px',fontSize:'0.85rem',textAlign:'center',borderBottom:'1px solid'}}>{msg}</div>}

      <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
        <div className="tabs">
          <button className={`tab ${tab==='menu'?'active':''}`} onClick={()=>setTab('menu')}>🍛 Menu ({menu.length})</button>
          <button className={`tab ${tab==='stats'?'active':''}`} onClick={()=>setTab('stats')}>📊 Stats</button>
          <button className={`tab ${tab==='csv'?'active':''}`} onClick={()=>setTab('csv')}>📥 CSV</button>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>

        {tab === 'menu' && (
          <>
            {/* AJOUTER */}
            <div className="card" style={{padding:'16px',marginBottom:'16px'}}>
              <PlatForm data={newPlat} setData={setNewPlat} onSave={addPlat} title="➕ AJOUTER UN ARTICLE" />
            </div>

            {/* FILTRES */}
            <div className="tabs" style={{marginBottom:'12px'}}>
              <button className={`tab ${catFilter==='tous'?'active':''}`} onClick={()=>setCatFilter('tous')}>Tous ({menu.length})</button>
              {CATEGORIES.map(c => {
                const nb = menu.filter(p => p.categorie === c.id).length
                return nb > 0 ? <button key={c.id} className={`tab ${catFilter===c.id?'active':''}`} onClick={()=>setCatFilter(c.id)}>{c.emoji} {c.nom} ({nb})</button> : null
              })}
            </div>

            {/* LISTE */}
            <div className="card">
              {menuFiltré.length === 0 && <div style={{padding:'20px',textAlign:'center',color:'var(--text3)'}}>Aucun article</div>}
              {menuFiltré.map((p,i) => (
                <div key={p.id} style={{padding:'12px 16px',borderBottom:i<menuFiltré.length-1?'1px solid var(--surface2)':'none',opacity:p.disponible?1:0.45}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:'0.95rem'}}>{p.nom}</div>
                      <div style={{display:'flex',gap:'8px',marginTop:'3px',flexWrap:'wrap'}}>
                        <span style={{fontSize:'0.7rem',color:'var(--text3)'}}>{CATEGORIES.find(c=>c.id===p.categorie)?.emoji} {p.categorie}</span>
                        {p.a_demi_plat && <span style={{fontSize:'0.7rem',color:'var(--blue)'}}>🍽️ demi: {p.prix_demi}€</span>}
                        <span style={{fontSize:'0.7rem',color:'var(--gold)',fontWeight:700}}>
                          {p.a_demi_plat ? `entier: ${p.prix_entier}€` : `${p.prix_entier}€`}
                        </span>
                        {p.complement && <span style={{fontSize:'0.7rem',color:'var(--green)'}}>🥗 compléments</span>}
                        <span style={{fontSize:'0.7rem',color:p.destination==='cuisine'?'var(--red)':'var(--blue)'}}>→ {p.destination}</span>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                      <button onClick={()=>setEditPlat({...p})} style={{fontSize:'0.7rem',padding:'4px 10px',borderRadius:'20px',border:'1px solid var(--blue)',background:'transparent',color:'var(--blue)',cursor:'pointer'}}>✏️</button>
                      <button onClick={()=>toggleDispo(p.id,p.disponible)} style={{fontSize:'0.7rem',padding:'4px 10px',borderRadius:'20px',border:`1px solid ${p.disponible?'var(--green)':'var(--border)'}`,background:'transparent',color:p.disponible?'var(--green)':'var(--text3)',cursor:'pointer'}}>
                        {p.disponible?'✓':'✗'}
                      </button>
                      <button onClick={()=>deletePlat(p.id)} style={{fontSize:'0.7rem',padding:'4px 8px',borderRadius:'20px',border:'1px solid transparent',background:'transparent',color:'var(--text3)',cursor:'pointer'}} onMouseEnter={e=>(e.currentTarget.style.color='var(--red)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text3)')}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

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
                <div className="card" style={{padding:'16px',marginBottom:'14px'}}>
                  <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',letterSpacing:'2px',marginBottom:'12px'}}>PAR SOURCE</div>
                  {Object.entries(stats.bySource).sort((a:any,b:any)=>b[1]-a[1]).map(([src,nb]:any)=>(
                    <div key={src} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--surface2)',fontSize:'0.85rem'}}>
                      <span>{src}</span><span style={{fontWeight:700,color:'var(--gold)'}}>{nb} cmd</span>
                    </div>
                  ))}
                </div>
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

        {tab === 'csv' && (
          <div>
            <div className="card" style={{padding:'20px',textAlign:'center',marginBottom:'16px'}}>
              <div style={{fontSize:'3rem',marginBottom:'12px'}}>📥</div>
              <div style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',letterSpacing:'2px',marginBottom:'8px'}}>EXPORT CSV</div>
              <div style={{fontSize:'0.82rem',color:'var(--text2)',marginBottom:'16px'}}>200 dernières commandes</div>
              <button className="btn-primary" onClick={exportCSV} style={{width:'100%'}}>📥 Télécharger</button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL MODIFIER */}
      {editPlat && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditPlat(null)}>
          <div className="modal" style={{maxWidth:'480px'}}>
            <div className="modal-header">
              <span className="modal-title">✏️ MODIFIER</span>
              <button className="btn-ghost" onClick={()=>setEditPlat(null)}>✕</button>
            </div>
            <div className="modal-body">
              <PlatForm data={editPlat} setData={setEditPlat} onSave={saveEdit} onCancel={()=>setEditPlat(null)} title="" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
