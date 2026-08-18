'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, PLATS, COMPLEMENTS, RESTAURANT } from '@/lib/menu'

type Source = 'Présentiel' | 'À emporter' | 'Deliveroo' | 'Uber Eats'
type Statut = 'nouvelle' | 'en_preparation' | 'prete' | 'servie'

interface LigneCommande {
  plat_id: number; nom: string; complement_id: number | null; complement_nom: string | null
  quantite: number; prix_unitaire: number; remarque: string; sous_total: number; destination: string
}
interface Commande {
  id: number; numero: number; source: Source; table_ref: string; statut: Statut
  montant_total: number; heure_creation: string; notes: string; lignes: LigneCommande[]
}

export default function AccueilPage() {
  const router = useRouter()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [showForm, setShowForm] = useState(false)
  const [source, setSource] = useState<Source>('Présentiel')
  const [tableRef, setTableRef] = useState('')
  const [panier, setPanier] = useState<LigneCommande[]>([])
  const [catActive, setCatActive] = useState('plats')
  const [platSelId, setPlatSelId] = useState<number | null>(null)
  const [complementId, setComplementId] = useState<number | null>(null)
  const [quantite, setQuantite] = useState(1)
  const [remarque, setRemarque] = useState('')
  const [prixChoisi, setPrixChoisi] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [showFacture, setShowFacture] = useState<Commande | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadCommandes = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('commandes')
        .select('id, numero, source, table_ref, statut, montant_total, heure_creation, notes')
        .neq('statut', 'servie')
        .order('heure_creation', { ascending: false })
      if (err) { setError('Erreur connexion Supabase: ' + err.message); return }
      if (!data) return
      // Load lignes separately
      const ids = data.map((c: any) => c.id)
      let lignesMap: Record<number, LigneCommande[]> = {}
      if (ids.length > 0) {
        const { data: lignes } = await supabase.from('lignes_commande').select('*').in('commande_id', ids)
        if (lignes) {
          lignes.forEach((l: any) => {
            if (!lignesMap[l.commande_id]) lignesMap[l.commande_id] = []
            lignesMap[l.commande_id].push(l)
          })
        }
      }
      setCommandes(data.map((c: any) => ({ ...c, lignes: lignesMap[c.id] || [] })))
      setError('')
    } catch(e: any) { setError('Erreur: ' + e.message) }
  }, [])

  useEffect(() => {
    loadCommandes()
    const channel = supabase.channel('accueil-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => loadCommandes())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadCommandes])

  const platActif = PLATS.find(p => p.id === platSelId)
  const platsCategorie = PLATS.filter(p => p.categorie === catActive)
  const catInfo = CATEGORIES.find(c => c.id === catActive)

  const ajouterAuPanier = () => {
    if (!platActif) return
    const prix = prixChoisi || platActif.prix
    const comp = COMPLEMENTS.find(c => c.id === complementId)
    const prixFinal = prix + (comp?.prix_supplement || 0)
    setPanier(p => [...p, {
      plat_id: platActif.id, nom: platActif.nom,
      complement_id: complementId, complement_nom: comp?.nom || null,
      quantite, prix_unitaire: prixFinal, remarque,
      sous_total: quantite * prixFinal,
      destination: (catInfo?.destination || 'cuisine') as 'cuisine' | 'accueil',
    }])
    setPlatSelId(null); setComplementId(null); setQuantite(1); setRemarque(''); setPrixChoisi(0)
  }

  const totalPanier = panier.reduce((s, l) => s + l.sous_total, 0)

  const envoyerCommande = async () => {
    if (panier.length === 0) return
    setLoading(true)
    try {
      const { data: cmd, error: err } = await supabase.from('commandes').insert({
        source, table_ref: tableRef, statut: 'nouvelle', montant_total: totalPanier, notes,
      }).select().single()
      if (err || !cmd) { alert('Erreur: ' + err?.message); return }
      await supabase.from('lignes_commande').insert(panier.map(l => ({
        commande_id: cmd.id, plat_id: l.plat_id, nom_plat: l.nom,
        complement_id: l.complement_id, complement_nom: l.complement_nom,
        quantite: l.quantite, prix_unitaire: l.prix_unitaire,
        remarque: l.remarque, sous_total: l.sous_total, destination: l.destination,
      })))
      setPanier([]); setTableRef(''); setNotes(''); setShowForm(false); loadCommandes()
    } finally { setLoading(false) }
  }

  const changerStatut = async (id: number, statut: Statut) => {
    await supabase.from('commandes').update({ statut, heure_modif: new Date().toISOString() }).eq('id', id)
    loadCommandes()
  }

  const stats = {
    nouvelles: commandes.filter(c => c.statut === 'nouvelle').length,
    prep: commandes.filter(c => c.statut === 'en_preparation').length,
    pretes: commandes.filter(c => c.statut === 'prete').length,
    total: commandes.length,
    ca: commandes.reduce((s, c) => s + (c.montant_total || 0), 0),
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <header className="app-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span className="live-dot" />
          <span className="header-brand">LE BASSAMBA</span>
          <span className="badge badge-red">ACCUEIL</span>
        </div>
        <div className="header-right">
          <button className="btn-ghost" onClick={() => router.push('/historique')}>📊</button>
          <button className="btn-ghost" onClick={() => router.push('/')}>←</button>
        </div>
      </header>

      {error && <div style={{ background:'rgba(204,20,20,0.15)', color:'var(--red)', padding:'10px 20px', fontSize:'0.82rem', borderBottom:'1px solid var(--red)' }}>⚠️ {error}</div>}

      <div className="stat-bar">
        <div className="stat-item"><div className="stat-num" style={{color:'var(--red)'}}>{stats.nouvelles}</div><div className="stat-lbl">Nouvelles</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--yellow)'}}>{stats.prep}</div><div className="stat-lbl">En prép.</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--green)'}}>{stats.pretes}</div><div className="stat-lbl">Prêtes</div></div>
        <div className="stat-item"><div className="stat-num">{stats.total}</div><div className="stat-lbl">Actives</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--gold)',fontSize:'1.2rem'}}>{stats.ca}€</div><div className="stat-lbl">CA jour</div></div>
        <div className="stat-item" style={{marginLeft:'auto'}}>
          <button className="btn-primary" onClick={() => setShowForm(true)} style={{padding:'8px 16px',fontSize:'0.85rem'}}>+ Commande</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {commandes.length === 0 && !error ? (
          <div className="empty-state"><span className="emoji">📋</span><p>Aucune commande active</p></div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {commandes.map(cmd => <CommandeCard key={cmd.id} cmd={cmd} onStatut={changerStatut} onFacture={() => setShowFacture(cmd)} />)}
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{maxWidth:'600px'}}>
            <div className="modal-header">
              <span className="modal-title">NOUVELLE COMMANDE</span>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="field-label">Source</label>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'16px'}}>
                {(['Présentiel','À emporter','Deliveroo','Uber Eats'] as Source[]).map(s => (
                  <button key={s} onClick={() => setSource(s)} style={{padding:'8px 14px',borderRadius:'20px',border:`2px solid ${source===s?'var(--red)':'var(--border)'}`,background:source===s?'var(--red-soft)':'transparent',color:source===s?'var(--red)':'var(--text2)',fontSize:'0.8rem',fontWeight:600}}>{s}</button>
                ))}
              </div>
              <label className="field-label">Table / N° référence</label>
              <input value={tableRef} onChange={e=>setTableRef(e.target.value)} placeholder="Table 3 / #1234" style={{marginBottom:'16px'}}/>

              <label className="field-label">Ajouter un article</label>
              <div className="tabs" style={{marginBottom:'12px'}}>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} className={`tab ${catActive===cat.id?'active':''}`} onClick={()=>{setCatActive(cat.id);setPlatSelId(null)}}>
                    {cat.emoji} {cat.nom}
                  </button>
                ))}
              </div>

              <select value={platSelId||''} onChange={e=>{const id=Number(e.target.value);setPlatSelId(id);setComplementId(null);setPrixChoisi(PLATS.find(x=>x.id===id)?.prix||0)}} style={{marginBottom:'10px'}}>
                <option value="">— Sélectionner —</option>
                {platsCategorie.map(p=><option key={p.id} value={p.id}>{p.nom} — {p.prix}€{p.prix2?` / ${p.prix2}€`:''}</option>)}
              </select>

              {platActif?.prix2 && (
                <div style={{marginBottom:'10px'}}>
                  <label className="field-label">Taille</label>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button onClick={()=>setPrixChoisi(platActif.prix)} style={{flex:1,padding:'8px',borderRadius:'var(--radius)',border:`2px solid ${prixChoisi===platActif.prix?'var(--red)':'var(--border)'}`,background:prixChoisi===platActif.prix?'var(--red-soft)':'transparent',color:'var(--text)',fontSize:'0.85rem'}}>Petit — {platActif.prix}€</button>
                    <button onClick={()=>setPrixChoisi(platActif.prix2!)} style={{flex:1,padding:'8px',borderRadius:'var(--radius)',border:`2px solid ${prixChoisi===platActif.prix2?'var(--red)':'var(--border)'}`,background:prixChoisi===platActif.prix2?'var(--red-soft)':'transparent',color:'var(--text)',fontSize:'0.85rem'}}>Grand — {platActif.prix2}€</button>
                  </div>
                </div>
              )}

              {platActif?.complement && (
                <div style={{marginBottom:'10px'}}>
                  <label className="field-label">Complément</label>
                  <select value={complementId||''} onChange={e=>setComplementId(Number(e.target.value)||null)}>
                    <option value="">Sans complément</option>
                    {COMPLEMENTS.map(c=><option key={c.id} value={c.id}>{c.nom}{c.prix_supplement>0?` (+${c.prix_supplement}€)`:' (inclus)'}</option>)}
                  </select>
                </div>
              )}

              <div style={{display:'flex',gap:'10px',marginBottom:'12px'}}>
                <div style={{flex:1}}>
                  <label className="field-label">Qté</label>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <button onClick={()=>setQuantite(q=>Math.max(1,q-1))} style={{width:'36px',height:'36px',borderRadius:'50%',background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'1.2rem'}}>−</button>
                    <span style={{fontFamily:'var(--font-display)',fontSize:'1.5rem',minWidth:'30px',textAlign:'center'}}>{quantite}</span>
                    <button onClick={()=>setQuantite(q=>q+1)} style={{width:'36px',height:'36px',borderRadius:'50%',background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'1.2rem'}}>+</button>
                  </div>
                </div>
                <div style={{flex:2}}>
                  <label className="field-label">Remarque</label>
                  <input value={remarque} onChange={e=>setRemarque(e.target.value)} placeholder="Sans piment..."/>
                </div>
              </div>

              <button className="btn-secondary" onClick={ajouterAuPanier} disabled={!platSelId} style={{width:'100%',marginBottom:'16px',opacity:platSelId?1:0.5}}>
                ➕ Ajouter au panier
              </button>

              {panier.length > 0 && (
                <div style={{background:'var(--surface2)',borderRadius:'var(--radius)',padding:'14px',marginBottom:'16px'}}>
                  <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',letterSpacing:'2px',marginBottom:'10px',display:'flex',justifyContent:'space-between'}}>
                    <span>PANIER</span><span style={{color:'var(--gold)'}}>{totalPanier}€</span>
                  </div>
                  {panier.map((l,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:'0.85rem'}}>
                      <div>
                        <span style={{color:l.destination==='cuisine'?'var(--red)':'var(--blue)'}}>{l.destination==='cuisine'?'🍛':'🥤'} </span>
                        {l.quantite}× {l.nom}
                        {l.complement_nom && <span style={{color:'var(--text2)'}}> + {l.complement_nom}</span>}
                        {l.remarque && <span style={{color:'var(--text3)',fontStyle:'italic'}}> ({l.remarque})</span>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{color:'var(--gold)',fontWeight:600}}>{l.sous_total}€</span>
                        <button onClick={()=>setPanier(p=>p.filter((_,j)=>j!==i))} style={{color:'var(--text3)',background:'transparent',fontSize:'0.8rem'}}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <label className="field-label">Notes cuisine</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Allergie, demande spéciale..." style={{minHeight:'60px',marginBottom:'16px'}}/>

              <div style={{display:'flex',gap:'10px'}}>
                <button className="btn-ghost" onClick={()=>{setPanier([]);setShowForm(false)}} style={{flex:1}}>Annuler</button>
                <button className="btn-primary" onClick={envoyerCommande} disabled={panier.length===0||loading} style={{flex:2,opacity:panier.length>0?1:0.5}}>
                  {loading?'⏳ Envoi...':`📨 ENVOYER — ${totalPanier}€`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFacture && <FactureModal cmd={showFacture} onClose={()=>setShowFacture(null)}/>}
    </div>
  )
}

function CommandeCard({cmd,onStatut,onFacture}:{cmd:Commande;onStatut:(id:number,s:Statut)=>void;onFacture:()=>void}) {
  const [open,setOpen]=useState(true)
  const heure=new Date(cmd.heure_creation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
  const plats=(cmd.lignes||[]).filter(l=>l.destination==='cuisine')
  const boissons=(cmd.lignes||[]).filter(l=>l.destination==='accueil')
  const srcClass=cmd.source==='Deliveroo'?'source-deliveroo':cmd.source==='Uber Eats'?'source-ubereats':cmd.source==='À emporter'?'source-emporter':'source-presentiel'
  return (
    <div className={`commande-card ${cmd.statut}`}>
      <div style={{padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',color:cmd.statut==='nouvelle'?'var(--red)':cmd.statut==='en_preparation'?'var(--yellow)':cmd.statut==='prete'?'var(--green)':'var(--text2)'}}>#{String(cmd.id).padStart(3,'0')}</span>
          <span className={`source-tag ${srcClass}`}>{cmd.source}</span>
          {cmd.table_ref&&<span style={{fontSize:'0.8rem',color:'var(--text2)'}}>{cmd.table_ref}</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',color:'var(--gold)'}}>{cmd.montant_total}€</span>
          <span className={`badge ${cmd.statut==='nouvelle'?'badge-red':cmd.statut==='prete'?'badge-green':'badge-gray'}`}>{cmd.statut==='nouvelle'?'Nouvelle':cmd.statut==='en_preparation'?'En prép.':cmd.statut==='prete'?'Prête ✓':'Servie'}</span>
          <span style={{color:'var(--text3)',fontSize:'0.75rem'}}>{heure}</span>
          <span style={{color:'var(--text3)'}}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open&&(
        <div style={{borderTop:'1px solid var(--border)',padding:'12px 16px'}}>
          {plats.length>0&&<div style={{marginBottom:'8px'}}>
            <div style={{fontSize:'0.65rem',color:'var(--red)',letterSpacing:'2px',marginBottom:'8px'}}>🍛 PLATS — CUISINE</div>
            {plats.map((l:any,i:number)=>(
              <div key={i} style={{padding:'8px 0',borderBottom:'1px solid var(--surface2)'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <span style={{fontFamily:'var(--font-display)',fontSize:'1.6rem',color:'var(--red)',minWidth:'32px'}}>{l.quantite}×</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:'1rem',color:'var(--text)'}}>{l.nom_plat||l.nom}</div>
                    {l.complement_nom&&<div style={{fontSize:'0.82rem',color:'var(--gold)',marginTop:'2px'}}>↳ Avec : {l.complement_nom}</div>}
                    {l.remarque&&<div style={{fontSize:'0.78rem',color:'var(--red)',fontStyle:'italic',marginTop:'2px'}}>⚠ {l.remarque}</div>}
                  </div>
                  <span style={{color:'var(--gold)',fontWeight:700,marginLeft:'auto'}}>{l.sous_total}€</span>
                </div>
              </div>
            ))}
          </div>}
          {boissons.length>0&&<div style={{marginBottom:'8px'}}>
            <div style={{fontSize:'0.65rem',color:'var(--blue)',letterSpacing:'2px',marginBottom:'8px'}}>🥤 BOISSONS — ACCUEIL</div>
            {boissons.map((l:any,i:number)=>(
              <div key={i} style={{padding:'6px 0',borderBottom:'1px solid var(--surface2)',display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',color:'var(--blue)',minWidth:'32px'}}>{l.quantite}×</span>
                <span style={{fontWeight:700,fontSize:'0.95rem'}}>{l.nom_plat||l.nom}</span>
                <span style={{color:'var(--gold)',fontWeight:700,marginLeft:'auto'}}>{l.sous_total}€</span>
              </div>
            ))}
          </div>}
          <div style={{display:'flex',gap:'8px',marginTop:'12px',flexWrap:'wrap'}}>
            {cmd.statut==='nouvelle'&&<button className="btn-secondary" onClick={()=>onStatut(cmd.id,'en_preparation')} style={{fontSize:'0.78rem',padding:'7px 12px'}}>🔥 En préparation</button>}
            {cmd.statut==='en_preparation'&&<button className="btn-green" onClick={()=>onStatut(cmd.id,'prete')} style={{fontSize:'0.78rem',padding:'7px 12px'}}>✅ Prête</button>}
            {cmd.statut==='prete'&&<button className="btn-primary" onClick={()=>onStatut(cmd.id,'servie')} style={{fontSize:'0.78rem',padding:'7px 12px'}}>📦 Servie</button>}
            <button className="btn-ghost" onClick={onFacture} style={{fontSize:'0.78rem',padding:'7px 12px'}}>🧾 Facture</button>
          </div>
        </div>
      )}
    </div>
  )
}

function FactureModal({cmd,onClose}:{cmd:Commande;onClose:()=>void}) {
  const now=new Date()
  const date=now.toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})
  const heure=now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:'480px'}}>
        <div className="modal-header"><span className="modal-title">🧾 FACTURE / RECEIPT</span><button className="btn-ghost" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{textAlign:'center',marginBottom:'20px',paddingBottom:'16px',borderBottom:'2px dashed var(--border)'}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:'2rem',color:'var(--red)',letterSpacing:'4px'}}>{RESTAURANT.nom}</div>
            <div style={{fontSize:'0.8rem',color:'var(--text2)',marginTop:'4px'}}>{RESTAURANT.adresse} — {RESTAURANT.codePostal} {RESTAURANT.ville}</div>
            <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>Tél: {RESTAURANT.tel}</div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'16px',fontSize:'0.82rem'}}>
            <div><div style={{color:'var(--text2)'}}>N° Commande / Order #</div><div style={{fontFamily:'var(--font-display)',fontSize:'1.2rem'}}>#{String(cmd.id).padStart(4,'0')}</div></div>
            <div style={{textAlign:'right'}}><div style={{color:'var(--text2)'}}>Date</div><div>{date} · {heure}</div></div>
          </div>
          {cmd.table_ref&&<div style={{fontSize:'0.82rem',marginBottom:'8px'}}><span style={{color:'var(--text2)'}}>Table / Réf : </span>{cmd.table_ref}</div>}
          <div style={{fontSize:'0.82rem',marginBottom:'16px'}}><span style={{color:'var(--text2)'}}>Source : </span>{cmd.source}</div>
          <div style={{borderTop:'1px solid var(--border)',paddingTop:'12px',marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem',color:'var(--text3)',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'1px'}}>
              <span>Article / Item</span><span>Qté</span><span>Prix</span><span>Total</span>
            </div>
            {(cmd.lignes||[]).map((l,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'0.85rem',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{flex:3}}>{l.nom}{l.complement_nom&&<div style={{fontSize:'0.72rem',color:'var(--text3)'}}>+ {l.complement_nom}</div>}</div>
                <div style={{flex:1,textAlign:'center'}}>{l.quantite}</div>
                <div style={{flex:1,textAlign:'right'}}>{l.prix_unitaire}€</div>
                <div style={{flex:1,textAlign:'right',fontWeight:600,color:'var(--gold)'}}>{l.sous_total}€</div>
              </div>
            ))}
          </div>
          <div style={{background:'var(--surface2)',borderRadius:'var(--radius)',padding:'12px 16px',marginBottom:'16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-display)',fontSize:'1.6rem',letterSpacing:'2px'}}>
              <span>TOTAL</span><span style={{color:'var(--gold)'}}>{cmd.montant_total}€</span>
            </div>
          </div>
          <div style={{textAlign:'center',fontSize:'0.75rem',color:'var(--text3)',paddingTop:'12px',borderTop:'2px dashed var(--border)',lineHeight:'1.8'}}>
            <div>Merci de votre visite ! · Thank you for your visit!</div>
            <div style={{marginTop:'8px',fontFamily:'var(--font-display)',fontSize:'1rem',color:'var(--gold)',letterSpacing:'2px'}}>Bonne Dégustation !</div>
          </div>
        </div>
        <div style={{padding:'0 20px 20px',display:'flex',gap:'10px'}}>
          <button className="btn-ghost" onClick={onClose} style={{flex:1}}>Fermer</button>
          <button className="btn-primary" onClick={()=>window.print()} style={{flex:2}}>🖨️ Imprimer / Print</button>
        </div>
      </div>
    </div>
  )
}
