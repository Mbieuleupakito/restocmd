'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { COMPLEMENTS, RESTAURANT } from '@/lib/menu'

const CATEGORIES = [
  { id: 'plats',      nom: 'Plats',      destination: 'cuisine', emoji: '🍛' },
  { id: 'bieres',     nom: 'Bières',     destination: 'accueil', emoji: '🍺' },
  { id: 'vins',       nom: 'Vins',       destination: 'accueil', emoji: '🍷' },
  { id: 'sodas',      nom: 'Sodas',      destination: 'accueil', emoji: '🥤' },
  { id: 'champagnes', nom: 'Champagnes', destination: 'accueil', emoji: '🍾' },
  { id: 'whiskys',    nom: 'Whiskys',    destination: 'accueil', emoji: '🥃' },
  { id: 'formules',   nom: 'Formules',   destination: 'accueil', emoji: '🎯' },
]

type Source = 'Présentiel' | 'À emporter' | 'Deliveroo' | 'Uber Eats'
type Statut = 'nouvelle' | 'en_preparation' | 'prete' | 'servie'

interface Ligne {
  id?: number; plat_id: number | null; nom_plat: string
  complement_id: number | null; complement_nom: string | null
  quantite: number; prix_unitaire: number; remarque: string
  sous_total: number; destination: string
}
interface Commande {
  id: number; source: Source; table_ref: string; statut: Statut
  montant_total: number; heure_creation: string; notes: string; lignes: Ligne[]
}

const SOURCES: Source[] = ['Présentiel', 'À emporter', 'Deliveroo', 'Uber Eats']

export default function AccueilPage() {
  const router = useRouter()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [servies, setServies] = useState<Commande[]>([])
  const [menuDB, setMenuDB] = useState<any[]>([])
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
  const [portionChoisie, setPortionChoisie] = useState<'demi'|'entier'>('entier')
  const [notes, setNotes] = useState('')
  const [showFacture, setShowFacture] = useState<Commande | null>(null)
  const [loading, setLoading] = useState(false)
  const [showServies, setShowServies] = useState(false)
  const [modeManuel, setModeManuel] = useState(false)
  const [nomManuel, setNomManuel] = useState('')
  const [prixManuel, setPrixManuel] = useState('')
  const [destManuel, setDestManuel] = useState<'cuisine'|'accueil'>('cuisine')
  const [pretNotif, setPretNotif] = useState<number[]>([])
  const prevStatuts = useRef<Record<number,string>>({})

  // Charger menu depuis Supabase
  useEffect(() => {
    supabase.from('menu').select('*').eq('disponible', true).order('nom')
      .then(({ data }) => { if (data) setMenuDB(data) })
  }, [])

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

    const newActives = (actives||[]).map((c:any) => ({ ...c, lignes: lignesMap[c.id]||[] }))
    const nouvellesPretes = newActives.filter(c => c.statut === 'prete' && prevStatuts.current[c.id] && prevStatuts.current[c.id] !== 'prete')
    if (nouvellesPretes.length > 0) {
      setPretNotif(nouvellesPretes.map(c => c.id))
      playPretSound()
      setTimeout(() => setPretNotif([]), 5000)
    }
    newActives.forEach(c => { prevStatuts.current[c.id] = c.statut })
    setCommandes(newActives)
    setServies((done||[]).map((c:any) => ({ ...c, lignes: lignesMap[c.id]||[] })))
  }, [playPretSound])

  useEffect(() => {
    loadCommandes()
    const ch = supabase.channel('accueil-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, loadCommandes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lignes_commande' }, loadCommandes)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadCommandes])

  const today = new Date().toDateString()
  const toutesAujourdhui = [...commandes, ...servies].filter(c => new Date(c.heure_creation).toDateString() === today)
  const caJour = toutesAujourdhui.reduce((s, c) => s + (c.montant_total || 0), 0)

  const platActif = menuDB.find(p => p.id === platSelId)
  const platsCategorie = menuDB.filter(p => p.categorie === catActive)
  const catInfo = CATEGORIES.find(c => c.id === catActive)

  const getPrix = () => {
    if (!platActif) return 0
    if (platActif.a_demi_plat && portionChoisie === 'demi') return Number(platActif.prix_demi)
    return Number(platActif.prix_entier)
  }

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
      const prix = getPrix()
      const comp = COMPLEMENTS.find(c => c.id === complementId)
      const prixFinal = prix + (comp?.prix_supplement || 0)
      const nomPortion = platActif.a_demi_plat ? (portionChoisie === 'demi' ? ' (demi-plat)' : ' (plat entier)') : ''
      setPanier(p => [...p, {
        plat_id: platActif.id, nom_plat: platActif.nom + nomPortion,
        complement_id: complementId, complement_nom: comp?.nom || null,
        quantite, prix_unitaire: prixFinal, remarque,
        sous_total: quantite * prixFinal,
        destination: (catInfo?.destination || 'cuisine') as 'cuisine' | 'accueil'
      }])
      setPlatSelId(null); setComplementId(null); setQuantite(1); setRemarque(''); setPortionChoisie('entier')
    }
  }

  const totalPanier = panier.reduce((s, l) => s + l.sous_total, 0)

  const ouvrirForm = (cmd?: Commande) => {
    if (cmd) {
      setEditCmd(cmd); setSource(cmd.source); setTableRef(cmd.table_ref || '')
      setNotes(cmd.notes || ''); setPanier(cmd.lignes.map(l => ({ ...l })))
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
        await supabase.from('commandes').update({ source, table_ref: tableRef, montant_total: totalPanier, notes, heure_modif: new Date().toISOString() }).eq('id', editCmd.id)
        await supabase.from('lignes_commande').delete().eq('commande_id', editCmd.id)
        await supabase.from('lignes_commande').insert(panier.map(l => ({ commande_id: editCmd.id, plat_id: l.plat_id, nom_plat: l.nom_plat, complement_id: l.complement_id, complement_nom: l.complement_nom, quantite: l.quantite, prix_unitaire: l.prix_unitaire, remarque: l.remarque, sous_total: l.sous_total, destination: l.destination })))
      } else {
        const { data: cmd } = await supabase.from('commandes').insert({ source, table_ref: tableRef, statut: 'nouvelle', montant_total: totalPanier, notes }).select().single()
        if (!cmd) return
        await supabase.from('lignes_commande').insert(panier.map(l => ({ commande_id: cmd.id, plat_id: l.plat_id, nom_plat: l.nom_plat, complement_id: l.complement_id, complement_nom: l.complement_nom, quantite: l.quantite, prix_unitaire: l.prix_unitaire, remarque: l.remarque, sous_total: l.sous_total, destination: l.destination })))
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
          <button className="btn-ghost" style={{fontSize:'0.75rem'}} onClick={() => router.push('/admin')}>⚙️</button>
          <button className="btn-ghost" onClick={() => router.push('/historique')}>📊</button>
          <button className="btn-ghost" onClick={() => router.push('/')}>←</button>
        </div>
      </header>

      {pretNotif.length > 0 && (
        <div onClick={() => setPretNotif([])} style={{ background:'var(--green)', color:'#000', padding:'14px 20px', fontSize:'1rem', fontWeight:700, textAlign:'center', cursor:'pointer', letterSpacing:'1px', borderBottom:'3px solid #16a34a' }}>
          ✅ PLAT PRÊT — #{pretNotif.map(id => String(id).padStart(3,'0')).join(', #')} — Allez récupérer !
        </div>
      )}

      <div className="stat-bar">
        <div className="stat-item"><div className="stat-num" style={{color:'var(--red)'}}>{stats.nouvelles}</div><div className="stat-lbl">Nouvelles</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--yellow)'}}>{stats.prep}</div><div className="stat-lbl">En prép.</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--green)'}}>{stats.pretes}</div><div className="stat-lbl">Prêtes</div></div>
        <div className="stat-item"><div className="stat-num" style={{color:'var(--gold)',fontSize:'1.1rem'}}>{caJour}€</div><div className="stat-lbl">CA jour</div></div>
        <div className="stat-item" style={{marginLeft:'auto'}}>
          <button className="btn-primary" onClick={() => ouvrirForm()} style={{padding:'8px 16px',fontSize:'0.85rem'}}>+ Commande</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {commandes.length === 0 ? (
          <div className="empty-state"><span className="emoji">📋</span><p>Aucune commande active</p></div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {commandes.map(cmd => <CommandeCard key={cmd.id} cmd={cmd} onStatut={changerStatut} onEdit={() => ouvrirForm(cmd)} onDelete={() => supprimerCommande(cmd.id)} onFacture={() => setShowFacture(cmd)} />)}
          </div>
        )}
        <div style={{ marginTop:'16px' }}>
          <button onClick={() => setShowServies(s => !s)} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--text2)', borderRadius:'var(--radius)', padding:'8px 16px', fontSize:'0.8rem', width:'100%', cursor:'pointer' }}>
            {showServies ? '▲' : '▼'} Commandes servies aujourd'hui ({servies.filter(c => new Date(c.heure_creation).toDateString()===today).length})
          </button>
          {showServies && servies.filter(c => new Date(c.heure_creation).toDateString()===today).map(cmd => (
            <CommandeCard key={cmd.id} cmd={cmd} onStatut={changerStatut} onEdit={() => ouvrirForm(cmd)} onDelete={() => supprimerCommande(cmd.id)} onFacture={() => setShowFacture(cmd)} />
          ))}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{maxWidth:'620px'}}>
            <div className="modal-header">
              <span className="modal-title">{editCmd ? `MODIFIER #${String(editCmd.id).padStart(3,'0')}` : 'NOUVELLE COMMANDE'}</span>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="field-label">Source</label>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'14px'}}>
                {SOURCES.map(s => (
                  <button key={s} onClick={() => setSource(s)} style={{padding:'7px 12px',borderRadius:'20px',border:`2px solid ${source===s?'var(--red)':'var(--border)'}`,background:source===s?'var(--red-soft)':'transparent',color:source===s?'var(--red)':'var(--text2)',fontSize:'0.78rem',fontWeight:600}}>{s}</button>
                ))}
              </div>

              <label className="field-label">Table / N° référence</label>
              <input value={tableRef} onChange={e=>setTableRef(e.target.value)} placeholder="Table 3 / #1234" style={{marginBottom:'14px'}}/>

              <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
                <button onClick={()=>setModeManuel(false)} className={!modeManuel?'btn-secondary':'btn-ghost'} style={{flex:1,fontSize:'0.8rem'}}>📋 Menu</button>
                <button onClick={()=>setModeManuel(true)} className={modeManuel?'btn-secondary':'btn-ghost'} style={{flex:1,fontSize:'0.8rem'}}>✏️ Saisie libre</button>
              </div>

              {!modeManuel ? (
                <>
                  <div className="tabs" style={{marginBottom:'10px'}}>
                    {CATEGORIES.map(cat => (
                      <button key={cat.id} className={`tab ${catActive===cat.id?'active':''}`} onClick={()=>{setCatActive(cat.id);setPlatSelId(null);setPortionChoisie('entier')}}>
                        {cat.emoji} {cat.nom}
                      </button>
                    ))}
                  </div>

                  <select value={platSelId||''} onChange={e=>{setPlatSelId(Number(e.target.value)||null);setComplementId(null);setPortionChoisie('entier')}} style={{marginBottom:'10px'}}>
                    <option value="">— Sélectionner —</option>
                    {platsCategorie.map(p=>(
                      <option key={p.id} value={p.id}>
                        {p.nom} — {p.a_demi_plat ? `${p.prix_demi}€ / ${p.prix_entier}€` : `${p.prix_entier}€`}
                      </option>
                    ))}
                  </select>

                  {platActif?.a_demi_plat && (
                    <div style={{marginBottom:'10px'}}>
                      <label className="field-label">Portion</label>
                      <div style={{display:'flex',gap:'8px'}}>
                        <button onClick={()=>setPortionChoisie('demi')} style={{flex:1,padding:'10px',borderRadius:'var(--radius)',border:`2px solid ${portionChoisie==='demi'?'var(--red)':'var(--border)'}`,background:portionChoisie==='demi'?'var(--red-soft)':'transparent',color:'var(--text)',fontSize:'0.88rem',fontWeight:600}}>
                          🍽️ Demi-plat — {platActif.prix_demi}€
                        </button>
                        <button onClick={()=>setPortionChoisie('entier')} style={{flex:1,padding:'10px',borderRadius:'var(--radius)',border:`2px solid ${portionChoisie==='entier'?'var(--red)':'var(--border)'}`,background:portionChoisie==='entier'?'var(--red-soft)':'transparent',color:'var(--text)',fontSize:'0.88rem',fontWeight:600}}>
                          🍛 Plat entier — {platActif.prix_entier}€
                        </button>
                      </div>
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
                  <input value={nomManuel} onChange={e=>setNomManuel(e.target.value)} placeholder="Nom du plat / article"/>
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

      {showFacture && <FactureModal cmd={showFacture} onClose={()=>setShowFacture(null)}/>}
    </div>
  )
}

function CommandeCard({cmd,onStatut,onEdit,onDelete,onFacture}:{cmd:Commande;onStatut:(id:number,s:Statut)=>void;onEdit:()=>void;onDelete:()=>void;onFacture:()=>void}) {
  const [open,setOpen]=useState(cmd.statut!=='servie')
  const heure=new Date(cmd.heure_creation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
  const elapsed=Math.floor((Date.now()-new Date(cmd.heure_creation).getTime())/60000)
  const plats=(cmd.lignes||[]).filter((l:any)=>l.destination==='cuisine')
  const boissons=(cmd.lignes||[]).filter((l:any)=>l.destination==='accueil')
  const src = cmd.source as string
  const srcClass=src==='Deliveroo'?'source-deliveroo':src==='Uber Eats'?'source-ubereats':src==='À emporter'?'source-emporter':src==='En ligne'?'source-enligne':'source-presentiel'
  return (
    <div className={`commande-card ${cmd.statut}`} style={{opacity:cmd.statut==='servie'?0.6:1}}>
      <div style={{padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',color:cmd.statut==='nouvelle'?'var(--red)':cmd.statut==='en_preparation'?'var(--yellow)':cmd.statut==='prete'?'var(--green)':'var(--text2)'}}>#{String(cmd.id).padStart(3,'0')}</span>
          <span className={`source-tag ${srcClass}`}>{cmd.source}</span>
          {cmd.table_ref&&<span style={{fontSize:'0.8rem',color:'var(--text2)'}}>{cmd.table_ref}</span>}
          <span style={{fontSize:'0.7rem',color:elapsed>20&&cmd.statut!=='servie'?'var(--red)':'var(--text3)'}}>{elapsed}min</span>
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
          {plats.length>0&&<div style={{marginBottom:'8px'}}><div style={{fontSize:'0.62rem',color:'var(--red)',letterSpacing:'2px',marginBottom:'6px'}}>🍛 PLATS — CUISINE</div>{plats.map((l:any,i:number)=><div key={i} style={{padding:'6px 0',borderBottom:'1px solid var(--surface2)',display:'flex',alignItems:'center',gap:'10px'}}><span style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',color:'var(--red)',minWidth:'30px'}}>{l.quantite}×</span><div style={{flex:1}}><div style={{fontWeight:700,fontSize:'0.95rem'}}>{l.nom_plat}</div>{l.complement_nom&&<div style={{fontSize:'0.78rem',color:'var(--gold)'}}>↳ {l.complement_nom}</div>}{l.remarque&&<div style={{fontSize:'0.74rem',color:'var(--red)',fontStyle:'italic'}}>⚠ {l.remarque}</div>}</div><span style={{color:'var(--gold)',fontWeight:700,fontSize:'0.9rem'}}>{l.sous_total}€</span></div>)}</div>}
          {boissons.length>0&&<div style={{marginBottom:'8px'}}><div style={{fontSize:'0.62rem',color:'var(--blue)',letterSpacing:'2px',marginBottom:'6px'}}>🥤 BOISSONS — ACCUEIL</div>{boissons.map((l:any,i:number)=><div key={i} style={{padding:'5px 0',borderBottom:'1px solid var(--surface2)',display:'flex',alignItems:'center',gap:'10px'}}><span style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',color:'var(--blue)',minWidth:'30px'}}>{l.quantite}×</span><span style={{flex:1,fontWeight:600,fontSize:'0.9rem'}}>{l.nom_plat}</span><span style={{color:'var(--gold)',fontWeight:700,fontSize:'0.9rem'}}>{l.sous_total}€</span></div>)}</div>}
          <div style={{display:'flex',gap:'6px',marginTop:'10px',flexWrap:'wrap'}}>
            {cmd.statut==='nouvelle'&&<button className="btn-secondary" onClick={()=>onStatut(cmd.id,'en_preparation')} style={{fontSize:'0.75rem',padding:'6px 10px'}}>🔥 En préparation</button>}
            {cmd.statut==='en_preparation'&&<button className="btn-green" onClick={()=>onStatut(cmd.id,'prete')} style={{fontSize:'0.75rem',padding:'6px 10px'}}>✅ Prête</button>}
            {cmd.statut==='prete'&&<button className="btn-primary" onClick={()=>onStatut(cmd.id,'servie')} style={{fontSize:'0.75rem',padding:'6px 10px'}}>📦 Servie</button>}
            {cmd.statut!=='servie'&&<button className="btn-ghost" onClick={onEdit} style={{fontSize:'0.75rem',padding:'6px 10px'}}>✏️ Modifier</button>}
            <button className="btn-ghost" onClick={onFacture} style={{fontSize:'0.75rem',padding:'6px 10px'}}>🧾 Facture</button>
            <button onClick={onDelete} style={{fontSize:'0.75rem',padding:'6px 10px',background:'transparent',border:'1px solid transparent',color:'var(--text3)',borderRadius:'var(--radius)',cursor:'pointer',marginLeft:'auto'}} onMouseEnter={e=>(e.currentTarget.style.color='var(--red)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text3)')}>🗑️</button>
          </div>
        </div>
      )}
    </div>
  )
}

function FactureModal({cmd,onClose}:{cmd:Commande;onClose:()=>void}) {
  const now = new Date()
  const date = now.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })
  const heure = now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })

  const handlePrint = () => {
    const el = document.getElementById('facture-print-wrapper')
    if (!el) return
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(`<!DOCTYPE html><html><head><style>
      @import url('https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 12px; background: white; color: #000; width: 280px; padding: 10px; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .large { font-size: 16px; }
      .line { border-top: 1px dashed #000; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; padding: 2px 0; }
      .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; padding: 4px 0; }
    </style></head><body>${el.innerHTML}</body></html>`)
    doc.close()
    iframe.contentWindow?.focus()
    setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 1000) }, 500)
  }

  // Contenu ticket format thermique
  const ticketContent = (
    <div id="facture-print-wrapper" style={{ display:'none', fontFamily:"'Courier New', monospace", fontSize:'12px', width:'280px', padding:'10px', background:'white', color:'#000' }}>
      {/* EN-TÊTE */}
      <div style={{ textAlign:'center', marginBottom:'8px' }}>
        <div style={{ fontWeight:900, fontSize:'16px', letterSpacing:'2px' }}>LE BASSAMBA</div>
        <div>41Bis, Rue Championnet</div>
        <div>75018 Paris</div>
        <div>Tél: 01 71 28 96 35</div>
        <div>07 51 81 46 84 / 07 53 16 50 92</div>
      </div>
      <div style={{ borderTop:'1px dashed #000', margin:'8px 0' }} />

      {/* INFOS COMMANDE */}
      <div style={{ marginBottom:'6px' }}>
        {cmd.table_ref && <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span>TABLE / RÉF</span><span style={{ fontWeight:700 }}>{cmd.table_ref}</span>
        </div>}
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span>SOURCE</span><span>{cmd.source.toUpperCase()}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span>N° COMMANDE</span><span style={{ fontWeight:700 }}>#{String(cmd.id).padStart(4,'0')}</span>
        </div>
      </div>
      <div style={{ borderTop:'1px dashed #000', margin:'8px 0' }} />

      {/* DATE */}
      <div style={{ textAlign:'center', marginBottom:'8px', fontSize:'11px' }}>
        {date.toUpperCase()} {heure}
      </div>
      <div style={{ borderTop:'1px dashed #000', margin:'8px 0' }} />

      {/* EN-TÊTE COLONNES */}
      <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr', fontSize:'11px', fontWeight:700, marginBottom:'4px' }}>
        <span>DÉSIGNATION</span><span style={{ textAlign:'center' }}>QTÉ</span><span style={{ textAlign:'right' }}>P.U</span><span style={{ textAlign:'right' }}>TOTAL</span>
      </div>
      <div style={{ borderTop:'1px solid #000', margin:'4px 0' }} />

      {/* ARTICLES */}
      {(cmd.lignes||[]).map((l:any, i:number) => (
        <div key={i} style={{ marginBottom:'4px', paddingBottom:'4px', borderBottom:'1px dotted #ccc' }}>
          <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr', alignItems:'start' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:'12px' }}>{l.nom_plat}</div>
              {l.complement_nom && <div style={{ fontSize:'10px' }}>  + {l.complement_nom}</div>}
              {l.remarque && <div style={{ fontSize:'10px', fontStyle:'italic' }}>  * {l.remarque}</div>}
            </div>
            <div style={{ textAlign:'center', fontWeight:700 }}>{l.quantite}</div>
            <div style={{ textAlign:'right' }}>{Number(l.prix_unitaire).toFixed(2)}€</div>
            <div style={{ textAlign:'right', fontWeight:700 }}>{Number(l.sous_total).toFixed(2)}€</div>
          </div>
        </div>
      ))}

      <div style={{ borderTop:'1px solid #000', margin:'6px 0' }} />

      {/* TOTAL */}
      <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:'16px', padding:'4px 0' }}>
        <span>TOTAL TTC</span>
        <span>{Number(cmd.montant_total).toFixed(2)}€</span>
      </div>

      <div style={{ borderTop:'1px dashed #000', margin:'8px 0' }} />

      {/* MODE DE PAIEMENT */}
      <div style={{ fontSize:'11px', marginBottom:'6px' }}>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span>RÈGLEMENT</span><span>ESPÈCES / CB</span>
        </div>
      </div>

      <div style={{ borderTop:'1px dashed #000', margin:'8px 0' }} />

      {/* PIED */}
      <div style={{ textAlign:'center', fontSize:'11px', lineHeight:'1.8' }}>
        <div>Merci de votre visite !</div>
        <div>Thank you for your visit!</div>
        <div style={{ fontWeight:700, marginTop:'4px', letterSpacing:'1px' }}>BONNE DÉGUSTATION !</div>
        <div style={{ marginTop:'6px', fontSize:'10px', color:'#666' }}>
          Métro Simplon / Porte de Clignancourt (L4)
        </div>
      </div>
    </div>
  )

  // VERSION ÉCRAN
  return (
    <>
      {ticketContent}
      <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
        <div className="modal" style={{maxWidth:'500px'}}>
          <div className="modal-header">
            <span className="modal-title">🧾 FACTURE</span>
            <button className="btn-ghost" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body" style={{padding:'16px 20px'}}>
            {/* Aperçu écran */}
            <div style={{ background:'white', color:'#111', borderRadius:'8px', padding:'20px', fontFamily:"'Courier New', monospace", fontSize:'12px' }}>
              <div style={{ textAlign:'center', marginBottom:'10px' }}>
                <div style={{ fontWeight:900, fontSize:'15px', letterSpacing:'2px', color:'#CC1414' }}>LE BASSAMBA</div>
                <div style={{ fontSize:'11px', color:'#555' }}>41Bis, Rue Championnet 75018 Paris</div>
                <div style={{ fontSize:'11px', color:'#555' }}>Tél: 01 71 28 96 35</div>
              </div>
              <div style={{ borderTop:'1px dashed #ccc', margin:'8px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px', fontSize:'11px' }}>
                <span style={{ color:'#666' }}>N° COMMANDE</span>
                <span style={{ fontWeight:700 }}>#{String(cmd.id).padStart(4,'0')}</span>
              </div>
              {cmd.table_ref && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px', fontSize:'11px' }}>
                <span style={{ color:'#666' }}>TABLE / RÉF</span>
                <span style={{ fontWeight:700 }}>{cmd.table_ref}</span>
              </div>}
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px', fontSize:'11px' }}>
                <span style={{ color:'#666' }}>SOURCE</span>
                <span>{cmd.source}</span>
              </div>
              <div style={{ textAlign:'center', fontSize:'10px', color:'#888', margin:'6px 0' }}>
                {date.toUpperCase()} · {heure}
              </div>
              <div style={{ borderTop:'1px dashed #ccc', margin:'8px 0' }} />
              <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr', fontSize:'10px', fontWeight:700, color:'#888', marginBottom:'4px' }}>
                <span>DÉSIGNATION</span><span style={{textAlign:'center'}}>QTÉ</span><span style={{textAlign:'right'}}>P.U</span><span style={{textAlign:'right'}}>TOTAL</span>
              </div>
              {(cmd.lignes||[]).map((l:any,i:number)=>(
                <div key={i} style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr', padding:'4px 0', borderBottom:'1px dotted #eee', fontSize:'11px', alignItems:'start' }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{l.nom_plat}</div>
                    {l.complement_nom && <div style={{ fontSize:'10px', color:'#888' }}>+ {l.complement_nom}</div>}
                  </div>
                  <div style={{ textAlign:'center' }}>{l.quantite}</div>
                  <div style={{ textAlign:'right' }}>{Number(l.prix_unitaire).toFixed(2)}€</div>
                  <div style={{ textAlign:'right', fontWeight:700, color:'#b8860b' }}>{Number(l.sous_total).toFixed(2)}€</div>
                </div>
              ))}
              <div style={{ borderTop:'1px solid #111', margin:'8px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:'15px' }}>
                <span>TOTAL TTC</span>
                <span style={{ color:'#b8860b' }}>{Number(cmd.montant_total).toFixed(2)}€</span>
              </div>
              <div style={{ borderTop:'1px dashed #ccc', margin:'8px 0' }} />
              <div style={{ textAlign:'center', fontSize:'10px', color:'#888' }}>
                Merci de votre visite · Thank you for your visit<br/>
                <strong>BONNE DÉGUSTATION !</strong>
              </div>
            </div>
          </div>
          <div style={{padding:'0 20px 20px',display:'flex',gap:'10px'}}>
            <button className="btn-ghost" onClick={onClose} style={{flex:1}}>Fermer</button>
            <button className="btn-primary" onClick={handlePrint} style={{flex:2}}>🖨️ Imprimer</button>
          </div>
        </div>
      </div>
    </>
  )
}
