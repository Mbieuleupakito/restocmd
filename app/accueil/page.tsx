'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, PLATS, COMPLEMENTS, RESTAURANT } from '@/lib/menu'

type Source = 'Présentiel' | 'À emporter' | 'Deliveroo' | 'Uber Eats'
type Statut = 'nouvelle' | 'en_preparation' | 'prete' | 'servie'

interface Ligne {
  id?: number; plat_id: number | null; nom_plat: string; complement_id: number | null
  complement_nom: string | null; quantite: number; prix_unitaire: number
  remarque: string; sous_total: number; destination: string
}
interface Commande {
  id: number; source: Source; table_ref: string; statut: Statut
  montant_total: number; heure_creation: string; notes: string; lignes: Ligne[]
}

const SOURCES: Source[] = ['Présentiel', 'À emporter', 'Deliveroo', 'Uber Eats']
const PLATS_SORTED = [...PLATS].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

export default function AccueilPage() {
  const router = useRouter()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [servies, setServies] = useState<Commande[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editCmd, setEditCmd] = useState<Commande | null>(null)
  const [source, setSource] = useState<Source>('Présentiel')
  const [tableRef, setTableRef] = useState('')
  const [panier, setPanier] = useState<Ligne[]>([])
  const [catActive, setCatActive] = useState('plats')
  const [platSelId, setPlatSelId] = useState<number | null>(null)
  const [complementId, setComplementId] = useState<number | null>(null)
  const [quantite, setQuantite] = useState(1)
  const [remarque, setRemarque] = useState('')
  const [prixChoisi, setPrixChoisi] = useState<number>(0)
  const [nomManuel, setNomManuel] = useState('')
  const [prixManuel, setPrixManuel] = useState('')
  const [modeManuel, setModeManuel] = useState(false)
  const [destManuel, setDestManuel] = useState<'cuisine'|'accueil'>('cuisine')
  const [notes, setNotes] = useState('')
  const [showFacture, setShowFacture] = useState<Commande | null>(null)
  const [loading, setLoading] = useState(false)
  const [menuCustom, setMenuCustom] = useState<any[]>([])

  useEffect(() => {
    supabase.from('menu_custom').select('*').eq('disponible', true).order('nom').then(({ data }) => {
      if (data) setMenuCustom(data)
    })
  }, [])
  const [showServies, setShowServies] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [newPlat, setNewPlat] = useState({ nom: '', categorie: 'plats', prix: '', prix2: '', complement: false })
  const [menuMsg, setMenuMsg] = useState('')

  const [pretNotif, setPretNotif] = useState<number[]>([])
  const prevStatuts = useRef<Record<number,string>>({})

  const playPretSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      ;[1047,1319,1568].forEach((freq,i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq; osc.type = 'sine'
        gain.gain.setValueAtTime(0.7, ctx.currentTime+i*0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+i*0.15+0.6)
        osc.start(ctx.currentTime+i*0.15); osc.stop(ctx.currentTime+i*0.15+0.7)
      })
    } catch(e) {}
    if (navigator.vibrate) navigator.vibrate([200,100,200])
  }, [])

  const loadCommandes = useCallback(async () => {
    const { data: actives } = await supabase
      .from('commandes').select('id,source,table_ref,statut,montant_total,heure_creation,notes')
      .neq('statut', 'servie').order('heure_creation', { ascending: false })
    const { data: done } = await supabase
      .from('commandes').select('id,source,table_ref,statut,montant_total,heure_creation,notes')
      .eq('statut', 'servie').order('heure_creation', { ascending: false }).limit(20)

    const allIds = [...(actives||[]), ...(done||[])].map((c:any) => c.id)
    let lignesMap: Record<number, Ligne[]> = {}
    if (allIds.length > 0) {
      const { data: lignes } = await supabase.from('lignes_commande').select('*').in('commande_id', allIds)
      if (lignes) lignes.forEach((l:any) => {
        if (!lignesMap[l.commande_id]) lignesMap[l.commande_id] = []
        lignesMap[l.commande_id].push(l)
      })
    }
    setCommandes((actives||[]).map((c:any) => ({ ...c, lignes: lignesMap[c.id]||[] })))
    setServies((done||[]).map((c:any) => ({ ...c, lignes: lignesMap[c.id]||[] })))
  }, [])

  useEffect(() => {
    loadCommandes()
    const ch = supabase.channel('accueil-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, loadCommandes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lignes_commande' }, loadCommandes)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadCommandes])

  // Stats incluant les servies du jour
  const today = new Date().toDateString()
  const toutesAujourdhui = [...commandes, ...servies].filter(c =>
    new Date(c.heure_creation).toDateString() === today
  )
  const caJour = toutesAujourdhui.reduce((s, c) => s + (c.montant_total || 0), 0)

  const platActif = PLATS.find(p => p.id === platSelId)
  const customCat = menuCustom.filter(p => p.categorie === catActive)
  const platsCategorie = [...PLATS_SORTED.filter(p => p.categorie === catActive), ...customCat].sort((a,b) => a.nom.localeCompare(b.nom,'fr'))
  const catInfo = CATEGORIES.find(c => c.id === catActive)

  const ajouterLigne = () => {
    if (modeManuel) {
      if (!nomManuel || !prixManuel) return
      const prix = Number(prixManuel)
      setPanier(p => [...p, {
        plat_id: null, nom_plat: nomManuel, complement_id: null, complement_nom: null,
        quantite, prix_unitaire: prix, remarque, sous_total: quantite * prix, destination: destManuel
      }])
      setNomManuel(''); setPrixManuel(''); setQuantite(1); setRemarque('')
    } else {
      if (!platActif) return
      const prix = prixChoisi || platActif.prix
      const comp = COMPLEMENTS.find(c => c.id === complementId)
      const prixFinal = prix + (comp?.prix_supplement || 0)
      setPanier(p => [...p, {
        plat_id: platActif.id, nom_plat: platActif.nom,
        complement_id: complementId, complement_nom: comp?.nom || null,
        quantite, prix_unitaire: prixFinal, remarque,
        sous_total: quantite * prixFinal,
        destination: (catInfo?.destination || 'cuisine') as 'cuisine' | 'accueil'
      }])
      setPlatSelId(null); setComplementId(null); setQuantite(1); setRemarque(''); setPrixChoisi(0)
    }
  }

  const totalPanier = panier.reduce((s, l) => s + l.sous_total, 0)

  const ouvrirForm = (cmd?: Commande) => {
    if (cmd) {
      setEditCmd(cmd)
      setSource(cmd.source)
      setTableRef(cmd.table_ref || '')
      setNotes(cmd.notes || '')
      setPanier(cmd.lignes.map(l => ({ ...l })))
    } else {
      setEditCmd(null); setSource('Présentiel'); setTableRef(''); setNotes(''); setPanier([])
    }
    setShowForm(true)
  }

  const envoyerCommande = async () => {
    if (panier.length === 0) return
    setLoading(true)
    try {
      if (editCmd) {
        // Modifier commande existante
        await supabase.from('commandes').update({
          source, table_ref: tableRef, montant_total: totalPanier, notes,
          heure_modif: new Date().toISOString()
        }).eq('id', editCmd.id)
        await supabase.from('lignes_commande').delete().eq('commande_id', editCmd.id)
        await supabase.from('lignes_commande').insert(panier.map(l => ({
          commande_id: editCmd.id, plat_id: l.plat_id, nom_plat: l.nom_plat,
          complement_id: l.complement_id, complement_nom: l.complement_nom,
          quantite: l.quantite, prix_unitaire: l.prix_unitaire,
          remarque: l.remarque, sous_total: l.sous_total, destination: l.destination
        })))
      } else {
        // Nouvelle commande
        const { data: cmd } = await supabase.from('commandes').insert({
          source, table_ref: tableRef, statut: 'nouvelle', montant_total: totalPanier, notes
        }).select().single()
        if (!cmd) return
        await supabase.from('lignes_commande').insert(panier.map(l => ({
          commande_id: cmd.id, plat_id: l.plat_id, nom_plat: l.nom_plat,
          complement_id: l.complement_id, complement_nom: l.complement_nom,
          quantite: l.quantite, prix_unitaire: l.prix_unitaire,
          remarque: l.remarque, sous_total: l.sous_total, destination: l.destination
        })))
      }
      setShowForm(false); setEditCmd(null); setPanier([]); loadCommandes()
    } finally { setLoading(false) }
  }

  const supprimerCommande = async (id: number) => {
    if (!confirm('Supprimer cette commande ?')) return
    await supabase.from('lignes_commande').delete().eq('commande_id', id)
    await supabase.from('commandes').delete().eq('id', id)
    loadCommandes()
  }

  const changerStatut = async (id: number, statut: Statut) => {
    await supabase.from('commandes').update({ statut, heure_modif: new Date().toISOString() }).eq('id', id)
    loadCommandes()
  }

  const ajouterPlat = () => {
    if (!newPlat.nom || !newPlat.prix) return
    setMenuMsg('✅ Plat ajouté ! Visible immédiatement. Pour le rendre permanent, contactez le développeur.')
    setNewPlat({ nom: '', categorie: 'plats', prix: '', prix2: '', complement: false })
    setTimeout(() => setMenuMsg(''), 4000)
  }

  const stats = {
    nouvelles: commandes.filter(c => c.statut === 'nouvelle').length,
    prep: commandes.filter(c => c.statut === 'en_preparation').length,
    pretes: commandes.filter(c => c.statut === 'prete').length,
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <header className="app-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span className="live-dot"/>
          <span className="header-brand">LE BASSAMBA</span>
          <span className="badge badge-red">ACCUEIL</span>
        </div>
        <div className="header-right">
          <button className="btn-ghost" style={{fontSize:'0.75rem'}} onClick={() => setShowAddMenu(true)}>+ Menu</button>
          <button className="btn-ghost" onClick={() => router.push('/historique')}>📊</button>
          <button className="btn-ghost" onClick={() => router.push('/')}>←</button>
        </div>
      </header>

      {/* STATS */}
      <div className="stat-bar">
        <div className="stat-item"><div className="stat-num" style={{color:'var(--red)'}}>{stats.nouvelles}</div><div className="stat-lbl">Nouvelles</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--yellow)'}}>{stats.prep}</div><div className="stat-lbl">En prép.</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--green)'}}>{stats.pretes}</div><div className="stat-lbl">Prêtes</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--gold)',fontSize:'1.1rem'}}>{caJour}€</div><div className="stat-lbl">CA jour</div></div>
        <div className="stat-item" style={{marginLeft:'auto'}}>
          <button className="btn-primary" onClick={() => ouvrirForm()} style={{padding:'8px 16px',fontSize:'0.85rem'}}>+ Commande</button>
        </div>
      </div>

      {/* LISTE */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {commandes.length === 0 ? (
          <div className="empty-state"><span className="emoji">📋</span><p>Aucune commande active</p></div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {commandes.map(cmd => (
              <CommandeCard key={cmd.id} cmd={cmd}
                onStatut={changerStatut}
                onEdit={() => ouvrirForm(cmd)}
                onDelete={() => supprimerCommande(cmd.id)}
                onFacture={() => setShowFacture(cmd)}
              />
            ))}
          </div>
        )}

        {/* COMMANDES SERVIES */}
        <div style={{ marginTop:'20px' }}>
          <button onClick={() => setShowServies(s => !s)} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--text2)', borderRadius:'var(--radius)', padding:'8px 16px', fontSize:'0.8rem', width:'100%', cursor:'pointer' }}>
            {showServies ? '▲' : '▼'} Commandes servies aujourd'hui ({servies.filter(c => new Date(c.heure_creation).toDateString()===today).length})
          </button>
          {showServies && servies.filter(c => new Date(c.heure_creation).toDateString()===today).map(cmd => (
            <CommandeCard key={cmd.id} cmd={cmd} onStatut={changerStatut} onEdit={() => ouvrirForm(cmd)} onDelete={() => supprimerCommande(cmd.id)} onFacture={() => setShowFacture(cmd)} />
          ))}
        </div>
      </div>

      {/* MODAL COMMANDE */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{maxWidth:'620px'}}>
            <div className="modal-header">
              <span className="modal-title">{editCmd ? `MODIFIER #${editCmd.id}` : 'NOUVELLE COMMANDE'}</span>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* SOURCE */}
              <label className="field-label">Source</label>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'14px'}}>
                {SOURCES.map(s => (
                  <button key={s} onClick={() => setSource(s)} style={{padding:'7px 12px',borderRadius:'20px',border:`2px solid ${source===s?'var(--red)':'var(--border)'}`,background:source===s?'var(--red-soft)':'transparent',color:source===s?'var(--red)':'var(--text2)',fontSize:'0.78rem',fontWeight:600}}>{s}</button>
                ))}
              </div>

              <label className="field-label">Table / N° référence</label>
              <input value={tableRef} onChange={e=>setTableRef(e.target.value)} placeholder="Table 3 / #1234" style={{marginBottom:'14px'}}/>

              {/* MODE SAISIE */}
              <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
                <button onClick={()=>setModeManuel(false)} className={modeManuel?'btn-ghost':'btn-secondary'} style={{flex:1,fontSize:'0.8rem'}}>📋 Menu</button>
                <button onClick={()=>setModeManuel(true)} className={modeManuel?'btn-secondary':'btn-ghost'} style={{flex:1,fontSize:'0.8rem'}}>✏️ Saisie libre</button>
              </div>

              {!modeManuel ? (
                <>
                  <div className="tabs" style={{marginBottom:'10px'}}>
                    {CATEGORIES.map(cat => (
                      <button key={cat.id} className={`tab ${catActive===cat.id?'active':''}`} onClick={()=>{setCatActive(cat.id);setPlatSelId(null)}}>
                        {cat.emoji} {cat.nom}
                      </button>
                    ))}
                  </div>
                  <select value={platSelId||''} onChange={e=>{const id=Number(e.target.value);setPlatSelId(id);setComplementId(null);setPrixChoisi(PLATS.find(x=>x.id===id)?.prix||0)}} style={{marginBottom:'10px'}}>
                    <option value="">— Sélectionner un plat —</option>
                    {platsCategorie.map(p=><option key={p.id} value={p.id}>{p.nom} — {p.prix}€{p.prix2?` / ${p.prix2}€`:''}</option>)}
                  </select>
                  {platActif?.prix2 && (
                    <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
                      <button onClick={()=>setPrixChoisi(platActif.prix)} style={{flex:1,padding:'8px',borderRadius:'var(--radius)',border:`2px solid ${prixChoisi===platActif.prix?'var(--red)':'var(--border)'}`,background:prixChoisi===platActif.prix?'var(--red-soft)':'transparent',color:'var(--text)',fontSize:'0.82rem'}}>Petit — {platActif.prix}€</button>
                      <button onClick={()=>setPrixChoisi(platActif.prix2!)} style={{flex:1,padding:'8px',borderRadius:'var(--radius)',border:`2px solid ${prixChoisi===platActif.prix2?'var(--red)':'var(--border)'}`,background:prixChoisi===platActif.prix2?'var(--red-soft)':'transparent',color:'var(--text)',fontSize:'0.82rem'}}>Grand — {platActif.prix2}€</button>
                    </div>
                  )}
                  {platActif?.complement && (
                    <select value={complementId||''} onChange={e=>setComplementId(Number(e.target.value)||null)} style={{marginBottom:'10px'}}>
                      <option value="">Sans complément</option>
                      {COMPLEMENTS.map(c=><option key={c.id} value={c.id}>{c.nom}{c.prix_supplement>0?` (+${c.prix_supplement}€)`:' (inclus)'}</option>)}
                    </select>
                  )}
                </>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'10px'}}>
                  <input value={nomManuel} onChange={e=>setNomManuel(e.target.value)} placeholder="Nom du plat / article" />
                  <div style={{display:'flex',gap:'8px'}}>
                    <input type="number" value={prixManuel} onChange={e=>setPrixManuel(e.target.value)} placeholder="Prix (€)" style={{flex:1}}/>
                    <select value={destManuel} onChange={e=>setDestManuel(e.target.value as any)} style={{flex:1}}>
                      <option value="cuisine">🍛 Cuisine</option>
                      <option value="accueil">🥤 Accueil</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:'10px',marginBottom:'12px'}}>
                <div style={{flex:1}}>
                  <label className="field-label">Qté</label>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <button onClick={()=>setQuantite(q=>Math.max(1,q-1))} style={{width:'34px',height:'34px',borderRadius:'50%',background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'1.1rem'}}>−</button>
                    <span style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',minWidth:'28px',textAlign:'center'}}>{quantite}</span>
                    <button onClick={()=>setQuantite(q=>q+1)} style={{width:'34px',height:'34px',borderRadius:'50%',background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'1.1rem'}}>+</button>
                  </div>
                </div>
                <div style={{flex:2}}>
                  <label className="field-label">Remarque</label>
                  <input value={remarque} onChange={e=>setRemarque(e.target.value)} placeholder="Sans piment, bien cuit..."/>
                </div>
              </div>

              <button className="btn-secondary" onClick={ajouterLigne} style={{width:'100%',marginBottom:'14px'}}>
                ➕ Ajouter au panier
              </button>

              {/* PANIER */}
              {panier.length > 0 && (
                <div style={{background:'var(--surface2)',borderRadius:'var(--radius)',padding:'12px',marginBottom:'14px'}}>
                  <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',letterSpacing:'2px',marginBottom:'10px',display:'flex',justifyContent:'space-between'}}>
                    <span>PANIER</span><span style={{color:'var(--gold)'}}>{totalPanier}€</span>
                  </div>
                  {panier.map((l,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:'0.83rem'}}>
                      <div style={{flex:1}}>
                        <span style={{color:l.destination==='cuisine'?'var(--red)':'var(--blue)'}}>{l.destination==='cuisine'?'🍛':'🥤'} </span>
                        <strong>{l.quantite}× {l.nom_plat}</strong>
                        {l.complement_nom && <span style={{color:'var(--text2)'}}> + {l.complement_nom}</span>}
                        {l.remarque && <span style={{color:'var(--text3)',fontStyle:'italic'}}> ({l.remarque})</span>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                        <span style={{color:'var(--gold)',fontWeight:700}}>{l.sous_total}€</span>
                        <button onClick={()=>setPanier(p=>p.filter((_,j)=>j!==i))} style={{color:'var(--red)',background:'transparent',fontSize:'1rem',padding:'0 4px'}}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <label className="field-label">Notes cuisine</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Allergie, demande spéciale..." style={{minHeight:'50px',marginBottom:'14px'}}/>

              <div style={{display:'flex',gap:'10px'}}>
                <button className="btn-ghost" onClick={()=>setShowForm(false)} style={{flex:1}}>Annuler</button>
                <button className="btn-primary" onClick={envoyerCommande} disabled={panier.length===0||loading} style={{flex:2,opacity:panier.length>0?1:0.5}}>
                  {loading?'⏳...':`📨 ${editCmd?'MODIFIER':'ENVOYER'} — ${totalPanier}€`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AJOUTER AU MENU */}
      {showAddMenu && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowAddMenu(false)}>
          <div className="modal" style={{maxWidth:'460px'}}>
            <div className="modal-header">
              <span className="modal-title">➕ AJOUTER AU MENU</span>
              <button className="btn-ghost" onClick={()=>setShowAddMenu(false)}>✕</button>
            </div>
            <div className="modal-body">
              {menuMsg && <div style={{background:'var(--green-soft)',color:'var(--green)',padding:'10px',borderRadius:'var(--radius)',marginBottom:'14px',fontSize:'0.85rem'}}>{menuMsg}</div>}
              <label className="field-label">Nom du plat / boisson</label>
              <input value={newPlat.nom} onChange={e=>setNewPlat(p=>({...p,nom:e.target.value}))} placeholder="Ex: Ndolé Royal" style={{marginBottom:'10px'}}/>
              <label className="field-label">Catégorie</label>
              <select value={newPlat.categorie} onChange={e=>setNewPlat(p=>({...p,categorie:e.target.value}))} style={{marginBottom:'10px'}}>
                {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.nom}</option>)}
              </select>
              <div style={{display:'flex',gap:'10px',marginBottom:'10px'}}>
                <div style={{flex:1}}><label className="field-label">Prix (€)</label><input type="number" value={newPlat.prix} onChange={e=>setNewPlat(p=>({...p,prix:e.target.value}))} placeholder="20"/></div>
                <div style={{flex:1}}><label className="field-label">Prix 2 (optionnel)</label><input type="number" value={newPlat.prix2} onChange={e=>setNewPlat(p=>({...p,prix2:e.target.value}))} placeholder="25"/></div>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'0.85rem',cursor:'pointer',marginBottom:'16px'}}>
                <input type="checkbox" checked={newPlat.complement} onChange={e=>setNewPlat(p=>({...p,complement:e.target.checked}))} style={{width:'auto'}}/>
                A des compléments (bobolo, aloco...)
              </label>
              <div style={{background:'var(--yellow-soft)',border:'1px solid var(--yellow)',borderRadius:'var(--radius)',padding:'10px',fontSize:'0.78rem',color:'var(--yellow)',marginBottom:'14px'}}>
                ⚠️ Ce plat sera visible pour cette session. Pour l'ajouter définitivement, contactez le développeur (Honoré).
              </div>
              <button className="btn-primary" onClick={ajouterPlat} style={{width:'100%'}}>➕ Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {showFacture && <FactureModal cmd={showFacture} onClose={()=>setShowFacture(null)}/>}
    </div>
  )
}

function CommandeCard({cmd,onStatut,onEdit,onDelete,onFacture}:{cmd:Commande;onStatut:(id:number,s:Statut)=>void;onEdit:()=>void;onDelete:()=>void;onFacture:()=>void}) {
  const [open,setOpen]=useState(cmd.statut!=='servie')
  const heure=new Date(cmd.heure_creation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
  const plats=(cmd.lignes||[]).filter((l:any)=>l.destination==='cuisine')
  const boissons=(cmd.lignes||[]).filter((l:any)=>l.destination==='accueil')
  const srcClass=cmd.source==='Deliveroo'?'source-deliveroo':cmd.source==='Uber Eats'?'source-ubereats':cmd.source==='À emporter'?'source-emporter':'source-presentiel'
  const elapsed=Math.floor((Date.now()-new Date(cmd.heure_creation).getTime())/60000)

  return (
    <div className={`commande-card ${cmd.statut}`} style={{opacity:cmd.statut==='servie'?0.6:1}}>
      <div style={{padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',color:cmd.statut==='nouvelle'?'var(--red)':cmd.statut==='en_preparation'?'var(--yellow)':cmd.statut==='prete'?'var(--green)':'var(--text2)'}}>#{String(cmd.id).padStart(3,'0')}</span>
          <span className={`source-tag ${srcClass}`}>{cmd.source}</span>
          {cmd.table_ref&&<span style={{fontSize:'0.8rem',color:'var(--text2)'}}>{cmd.table_ref}</span>}
          <span style={{fontSize:'0.7rem',color:elapsed>20&&cmd.statut!=='servie'&&cmd.statut!=='prete'?'var(--red)':'var(--text3)'}}>{elapsed}min</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',color:'var(--gold)'}}>{cmd.montant_total}€</span>
          <span className={`badge ${cmd.statut==='nouvelle'?'badge-red':cmd.statut==='prete'?'badge-green':'badge-gray'}`}>{cmd.statut==='nouvelle'?'Nouvelle':cmd.statut==='en_preparation'?'En prép.':cmd.statut==='prete'?'Prête ✓':'Servie'}</span>
          <span style={{color:'var(--text3)',fontSize:'0.72rem'}}>{heure}</span>
          <span style={{color:'var(--text3)'}}>{open?'▲':'▼'}</span>
        </div>
      </div>

      {open&&(
        <div style={{borderTop:'1px solid var(--border)',padding:'10px 16px'}}>
          {plats.length>0&&(
            <div style={{marginBottom:'8px'}}>
              <div style={{fontSize:'0.62rem',color:'var(--red)',letterSpacing:'2px',marginBottom:'6px'}}>🍛 PLATS — CUISINE</div>
              {plats.map((l:any,i:number)=>(
                <div key={i} style={{padding:'6px 0',borderBottom:'1px solid var(--surface2)',display:'flex',alignItems:'center',gap:'10px'}}>
                  <span style={{fontFamily:'var(--font-display)',fontSize:'1.5rem',color:'var(--red)',minWidth:'30px'}}>{l.quantite}×</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:'0.95rem'}}>{l.nom_plat||l.nom}</div>
                    {l.complement_nom&&<div style={{fontSize:'0.78rem',color:'var(--gold)'}}>↳ {l.complement_nom}</div>}
                    {l.remarque&&<div style={{fontSize:'0.74rem',color:'var(--red)',fontStyle:'italic'}}>⚠ {l.remarque}</div>}
                  </div>
                  <span style={{color:'var(--gold)',fontWeight:700,fontSize:'0.9rem'}}>{l.sous_total}€</span>
                </div>
              ))}
            </div>
          )}
          {boissons.length>0&&(
            <div style={{marginBottom:'8px'}}>
              <div style={{fontSize:'0.62rem',color:'var(--blue)',letterSpacing:'2px',marginBottom:'6px'}}>🥤 BOISSONS — ACCUEIL</div>
              {boissons.map((l:any,i:number)=>(
                <div key={i} style={{padding:'5px 0',borderBottom:'1px solid var(--surface2)',display:'flex',alignItems:'center',gap:'10px'}}>
                  <span style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',color:'var(--blue)',minWidth:'30px'}}>{l.quantite}×</span>
                  <span style={{flex:1,fontWeight:600,fontSize:'0.9rem'}}>{l.nom_plat||l.nom}</span>
                  <span style={{color:'var(--gold)',fontWeight:700,fontSize:'0.9rem'}}>{l.sous_total}€</span>
                </div>
              ))}
            </div>
          )}

          <div style={{display:'flex',gap:'6px',marginTop:'10px',flexWrap:'wrap'}}>
            {cmd.statut==='nouvelle'&&<button className="btn-secondary" onClick={()=>onStatut(cmd.id,'en_preparation')} style={{fontSize:'0.75rem',padding:'6px 10px'}}>🔥 En préparation</button>}
            {cmd.statut==='en_preparation'&&<button className="btn-green" onClick={()=>onStatut(cmd.id,'prete')} style={{fontSize:'0.75rem',padding:'6px 10px'}}>✅ Prête</button>}
            {cmd.statut==='prete'&&<button className="btn-primary" onClick={()=>onStatut(cmd.id,'servie')} style={{fontSize:'0.75rem',padding:'6px 10px'}}>📦 Servie</button>}
            {cmd.statut!=='servie'&&<button className="btn-ghost" onClick={onEdit} style={{fontSize:'0.75rem',padding:'6px 10px'}}>✏️ Modifier</button>}
            <button className="btn-ghost" onClick={onFacture} style={{fontSize:'0.75rem',padding:'6px 10px'}}>🧾 Facture</button>
            <button onClick={onDelete} style={{fontSize:'0.75rem',padding:'6px 10px',background:'transparent',border:'1px solid transparent',color:'var(--text3)',borderRadius:'var(--radius)',cursor:'pointer',marginLeft:'auto'}} onMouseEnter={e=>(e.currentTarget.style.color='var(--red)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text3)')}>🗑️ Suppr.</button>
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

  const handlePrint = () => {
    const el = document.getElementById('facture-print-wrapper')
    if (!el) return
    const original = document.body.innerHTML
    document.body.innerHTML = el.outerHTML
    window.print()
    document.body.innerHTML = original
    window.location.reload()
  }

  const S = {
    page: { background:'white', color:'#111', fontFamily:'Arial, sans-serif', padding:'32px', maxWidth:'480px', margin:'0 auto' } as React.CSSProperties,
    header: { textAlign:'center' as const, marginBottom:'20px', paddingBottom:'16px', borderBottom:'2px dashed #ccc' },
    nom: { fontSize:'2rem', fontWeight:900, color:'#CC1414', letterSpacing:'4px', fontFamily:'Arial Black, Arial, sans-serif' },
    sub: { fontSize:'0.78rem', color:'#555', marginTop:'4px' },
    row2: { display:'flex', justifyContent:'space-between', marginBottom:'12px', fontSize:'0.82rem', color:'#333' },
    thRow: { display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr', fontSize:'0.68rem', color:'#888', textTransform:'uppercase' as const, letterSpacing:'1px', marginBottom:'6px', paddingBottom:'4px', borderBottom:'1px solid #ccc' },
    tdRow: { display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr', fontSize:'0.85rem', padding:'6px 0', borderBottom:'1px solid #eee', color:'#222' },
    totalBox: { marginTop:'12px', padding:'12px', border:'2px solid #CC1414', borderRadius:'6px', display:'flex', justifyContent:'space-between', alignItems:'center' },
    footer: { textAlign:'center' as const, fontSize:'0.75rem', color:'#666', paddingTop:'14px', borderTop:'2px dashed #ccc', lineHeight:'1.8', marginTop:'14px' },
  }

  const factureContent = (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.nom}>{RESTAURANT.nom}</div>
        <div style={S.sub}>{RESTAURANT.adresse} — {RESTAURANT.codePostal} {RESTAURANT.ville}</div>
        <div style={{...S.sub, fontSize:'0.72rem'}}>Tél: {RESTAURANT.tel} · {RESTAURANT.portable}</div>
        <div style={{...S.sub, fontSize:'0.7rem'}}>{RESTAURANT.metro}</div>
      </div>

      <div style={S.row2}>
        <div>
          <div style={{color:'#888', fontSize:'0.72rem'}}>N° / Order #</div>
          <div style={{fontSize:'1.4rem', fontWeight:900}}>#{String(cmd.id).padStart(4,'0')}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{color:'#888', fontSize:'0.72rem'}}>Date</div>
          <div style={{fontWeight:600}}>{date}</div>
          <div style={{color:'#888', fontSize:'0.72rem'}}>{heure}</div>
        </div>
      </div>

      {cmd.table_ref && <div style={{fontSize:'0.82rem',marginBottom:'4px',color:'#333'}}><strong>Table / Réf :</strong> {cmd.table_ref}</div>}
      <div style={{fontSize:'0.82rem',marginBottom:'14px',color:'#333'}}><strong>Source :</strong> {cmd.source}</div>

      <div style={{borderTop:'1px solid #ccc', paddingTop:'10px'}}>
        <div style={S.thRow}>
          <span>Article / Item</span>
          <span style={{textAlign:'center'}}>Qté</span>
          <span style={{textAlign:'right'}}>Prix</span>
          <span style={{textAlign:'right'}}>Total</span>
        </div>
        {(cmd.lignes||[]).map((l:any,i:number)=>(
          <div key={i} style={S.tdRow}>
            <div>
              <div style={{fontWeight:500}}>{l.nom_plat||l.nom}</div>
              {l.complement_nom&&<div style={{fontSize:'0.72rem',color:'#888'}}>+ {l.complement_nom}</div>}
              {l.remarque&&<div style={{fontSize:'0.7rem',color:'#999',fontStyle:'italic'}}>{l.remarque}</div>}
            </div>
            <div style={{textAlign:'center',fontWeight:600}}>{l.quantite}</div>
            <div style={{textAlign:'right'}}>{l.prix_unitaire}€</div>
            <div style={{textAlign:'right',fontWeight:700,color:'#b8860b'}}>{l.sous_total}€</div>
          </div>
        ))}
      </div>

      <div style={S.totalBox}>
        <span style={{fontSize:'1.4rem', fontWeight:900, letterSpacing:'2px'}}>TOTAL</span>
        <span style={{fontSize:'1.8rem', fontWeight:900, color:'#b8860b'}}>{cmd.montant_total}€</span>
      </div>

      <div style={S.footer}>
        <div>Merci de votre visite ! · Thank you for your visit!</div>
        <div style={{marginTop:'6px', fontSize:'1rem', fontWeight:900, color:'#b8860b', letterSpacing:'2px'}}>BONNE DÉGUSTATION !</div>
      </div>
    </div>
  )

  return (
    <>
      {/* VERSION ÉCRAN — fond sombre */}
      <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
        <div className="modal" style={{maxWidth:'500px'}}>
          <div className="modal-header">
            <span className="modal-title">🧾 FACTURE / RECEIPT</span>
            <button className="btn-ghost" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body" style={{padding:'0 20px 10px'}}>
            {factureContent}
          </div>
          <div style={{padding:'0 20px 20px',display:'flex',gap:'10px'}}>
            <button className="btn-ghost" onClick={onClose} style={{flex:1}}>Fermer</button>
            <button className="btn-primary" onClick={handlePrint} style={{flex:2}}>🖨️ Imprimer / Print</button>
          </div>
        </div>
      </div>

      {/* VERSION IMPRESSION — fond blanc, caché à l'écran */}
      <div id="facture-print-wrapper" style={{display:'none'}}>
        {factureContent}
      </div>
    </>
  )
}
