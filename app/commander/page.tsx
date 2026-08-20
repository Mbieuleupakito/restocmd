'use client'
import { useState, useEffect } from 'react'
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

interface Ligne {
  plat_id: number; nom_plat: string; complement_id: number | null
  complement_nom: string | null; quantite: number; prix_unitaire: number
  remarque: string; sous_total: number; destination: string
}

type Step = 'menu' | 'infos' | 'confirm' | 'success'

export default function CommanderPage() {
  const [menuDB, setMenuDB] = useState<any[]>([])
  const [step, setStep] = useState<Step>('menu')
  const [catActive, setCatActive] = useState('plats')
  const [panier, setPanier] = useState<Ligne[]>([])
  const [platSelId, setPlatSelId] = useState<number | null>(null)
  const [complementId, setComplementId] = useState<number | null>(null)
  const [quantite, setQuantite] = useState(1)
  const [remarque, setRemarque] = useState('')
  const [portion, setPortion] = useState<'demi'|'entier'>('entier')
  const [nom, setNom] = useState('')
  const [tel, setTel] = useState('')
  const [heure, setHeure] = useState('')
  const [typeService, setTypeService] = useState<'sur place'|'à emporter'>('sur place')
  const [loading, setLoading] = useState(false)
  const [cmdId, setCmdId] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('menu').select('*').eq('disponible', true).order('nom')
      .then(({ data }) => { if (data) setMenuDB(data) })
  }, [])

  const platActif = menuDB.find(p => p.id === platSelId)
  const platsCategorie = menuDB.filter(p => p.categorie === catActive)
  const catInfo = CATEGORIES.find(c => c.id === catActive)
  const total = panier.reduce((s, l) => s + l.sous_total, 0)

  const getPrix = () => {
    if (!platActif) return 0
    if (platActif.a_demi_plat && portion === 'demi') return Number(platActif.prix_demi)
    return Number(platActif.prix_entier)
  }

  const ajouterAuPanier = () => {
    if (!platActif) return
    const prix = getPrix()
    const comp = COMPLEMENTS.find(c => c.id === complementId)
    const prixFinal = prix + (comp?.prix_supplement || 0)
    const nomPortion = platActif.a_demi_plat ? (portion === 'demi' ? ' (demi-plat)' : ' (plat entier)') : ''
    setPanier(p => [...p, {
      plat_id: platActif.id, nom_plat: platActif.nom + nomPortion,
      complement_id: complementId, complement_nom: comp?.nom || null,
      quantite, prix_unitaire: prixFinal, remarque,
      sous_total: quantite * prixFinal,
      destination: (catInfo?.destination || 'cuisine') as string
    }])
    setPlatSelId(null); setComplementId(null); setQuantite(1); setRemarque(''); setPortion('entier')
  }

  const validerCommande = async () => {
    if (!nom || !tel || !heure) return
    setLoading(true)
    try {
      const { data: cmd } = await supabase.from('commandes').insert({
        source: 'En ligne',
        table_ref: `${typeService} — ${heure} — ${nom} (${tel})`,
        statut: 'nouvelle',
        montant_total: total,
        notes: `Commande en ligne · Arrivée prévue : ${heure} · ${typeService}`
      }).select().single()
      if (!cmd) return
      await supabase.from('lignes_commande').insert(panier.map(l => ({
        commande_id: cmd.id, plat_id: l.plat_id, nom_plat: l.nom_plat,
        complement_id: l.complement_id, complement_nom: l.complement_nom,
        quantite: l.quantite, prix_unitaire: l.prix_unitaire,
        remarque: l.remarque, sous_total: l.sous_total, destination: l.destination
      })))
      setCmdId(cmd.id)
      setStep('success')
    } finally { setLoading(false) }
  }

  // ── STYLES ──────────────────────────────────────────────────────────
  const S = {
    page: { minHeight:'100vh', background:'#0A0A0A', color:'#F0F0F0', fontFamily:'DM Sans, sans-serif' } as React.CSSProperties,
    header: { background:'#141414', borderBottom:'1px solid #2E2E2E', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' } as React.CSSProperties,
    brand: { fontFamily:'Bebas Neue, sans-serif', fontSize:'1.8rem', letterSpacing:'4px', color:'#CC1414' } as React.CSSProperties,
    body: { maxWidth:'600px', margin:'0 auto', padding:'20px 16px' } as React.CSSProperties,
    card: { background:'#141414', border:'1px solid #2E2E2E', borderRadius:'14px', overflow:'hidden', marginBottom:'14px' } as React.CSSProperties,
    cardHead: { background:'#1C1C1C', padding:'12px 16px', borderBottom:'1px solid #2E2E2E', fontFamily:'Bebas Neue, sans-serif', letterSpacing:'2px', fontSize:'0.95rem' } as React.CSSProperties,
    input: { width:'100%', background:'#1C1C1C', border:'1px solid #2E2E2E', borderRadius:'10px', color:'#F0F0F0', padding:'12px 14px', fontSize:'0.9rem', fontFamily:'DM Sans, sans-serif', outline:'none', boxSizing:'border-box' as const },
    btnPrimary: { width:'100%', background:'#CC1414', color:'white', border:'none', borderRadius:'10px', padding:'14px', fontSize:'1rem', fontWeight:700, cursor:'pointer', fontFamily:'DM Sans, sans-serif' } as React.CSSProperties,
    btnSecondary: { width:'100%', background:'#1C1C1C', color:'#F0F0F0', border:'1px solid #2E2E2E', borderRadius:'10px', padding:'12px', fontSize:'0.9rem', cursor:'pointer', fontFamily:'DM Sans, sans-serif' } as React.CSSProperties,
    tag: { fontSize:'0.65rem', fontWeight:700, padding:'3px 10px', borderRadius:'20px', letterSpacing:'1px' } as React.CSSProperties,
  }

  if (step === 'success') return (
    <div style={S.page}>
      <header style={S.header}>
        <span style={S.brand}>LE BASSAMBA</span>
      </header>
      <div style={{ ...S.body, textAlign:'center', paddingTop:'60px' }}>
        <div style={{ fontSize:'5rem', marginBottom:'20px' }}>✅</div>
        <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'2.5rem', color:'#22C55E', letterSpacing:'3px', marginBottom:'10px' }}>
          COMMANDE CONFIRMÉE !
        </div>
        <div style={{ fontSize:'0.9rem', color:'#A0A0A0', marginBottom:'8px' }}>
          N° de commande : <strong style={{color:'#D4A843',fontSize:'1.2rem'}}>#{String(cmdId).padStart(4,'0')}</strong>
        </div>
        <div style={{ fontSize:'0.9rem', color:'#A0A0A0', marginBottom:'4px' }}>
          Bonjour <strong style={{color:'#F0F0F0'}}>{nom}</strong> !
        </div>
        <div style={{ fontSize:'0.9rem', color:'#A0A0A0', marginBottom:'24px' }}>
          Votre commande est en préparation. À tout à l'heure à <strong style={{color:'#CC1414'}}>{heure}</strong> !
        </div>

        <div style={{ ...S.card, textAlign:'left' }}>
          <div style={S.cardHead}>📋 RÉCAPITULATIF</div>
          <div style={{ padding:'14px 16px' }}>
            {panier.map((l,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #1C1C1C', fontSize:'0.85rem' }}>
                <div>
                  <strong>{l.quantite}× {l.nom_plat}</strong>
                  {l.complement_nom && <div style={{fontSize:'0.75rem',color:'#D4A843'}}>+ {l.complement_nom}</div>}
                </div>
                <span style={{color:'#D4A843',fontWeight:700}}>{l.sous_total}€</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'12px', fontFamily:'Bebas Neue, sans-serif', fontSize:'1.4rem' }}>
              <span>TOTAL</span>
              <span style={{color:'#D4A843'}}>{total}€</span>
            </div>
            <div style={{ marginTop:'10px', fontSize:'0.8rem', color:'#606060' }}>Paiement à l'arrivée</div>
          </div>
        </div>

        <div style={{ background:'#1C1C1C', borderRadius:'10px', padding:'14px', fontSize:'0.82rem', color:'#A0A0A0', marginBottom:'20px' }}>
          📍 {RESTAURANT.adresse}, {RESTAURANT.codePostal} {RESTAURANT.ville}<br/>
          🚇 {RESTAURANT.metro}<br/>
          📞 {RESTAURANT.tel}
        </div>

        <button style={S.btnSecondary} onClick={() => { setPanier([]); setStep('menu'); setNom(''); setTel(''); setHeure('') }}>
          Passer une autre commande
        </button>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      {/* HEADER */}
      <header style={S.header}>
        <div>
          <div style={S.brand}>LE BASSAMBA</div>
          <div style={{ fontSize:'0.7rem', color:'#606060', letterSpacing:'2px' }}>COMMANDER EN LIGNE</div>
        </div>
        {panier.length > 0 && (
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.4rem', color:'#D4A843' }}>{total}€</div>
            <div style={{ fontSize:'0.7rem', color:'#A0A0A0' }}>{panier.length} article{panier.length>1?'s':''}</div>
          </div>
        )}
      </header>

      {/* STEPS */}
      <div style={{ background:'#141414', borderBottom:'1px solid #2E2E2E', padding:'12px 20px', display:'flex', gap:'8px', alignItems:'center', justifyContent:'center' }}>
        {[{id:'menu',label:'1. Menu'},{id:'infos',label:'2. Infos'},{id:'confirm',label:'3. Confirmation'}].map((s,i) => (
          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'0.78rem', fontWeight:600, color: step===s.id?'#CC1414':'#606060', letterSpacing:'1px' }}>{s.label}</span>
            {i < 2 && <span style={{color:'#2E2E2E'}}>→</span>}
          </div>
        ))}
      </div>

      <div style={S.body}>

        {/* ── ÉTAPE 1 : MENU ── */}
        {step === 'menu' && (
          <>
            <div style={{ marginBottom:'16px' }}>
              <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.4rem', letterSpacing:'3px', marginBottom:'4px' }}>
                🍽️ CHOISISSEZ VOS PLATS
              </div>
              <div style={{ fontSize:'0.8rem', color:'#606060' }}>
                {RESTAURANT.adresse}, {RESTAURANT.codePostal} Paris · {RESTAURANT.metro}
              </div>
            </div>

            {/* CATÉGORIES */}
            <div style={{ display:'flex', gap:'6px', overflowX:'auto', marginBottom:'14px', paddingBottom:'4px' }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => { setCatActive(cat.id); setPlatSelId(null) }}
                  style={{ padding:'8px 14px', borderRadius:'20px', border:`2px solid ${catActive===cat.id?'#CC1414':'#2E2E2E'}`, background:catActive===cat.id?'rgba(204,20,20,0.12)':'transparent', color:catActive===cat.id?'#CC1414':'#A0A0A0', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                  {cat.emoji} {cat.nom}
                </button>
              ))}
            </div>

            {/* LISTE PLATS */}
            <div style={S.card}>
              {platsCategorie.length === 0 && <div style={{padding:'20px',textAlign:'center',color:'#606060',fontSize:'0.85rem'}}>Aucun article dans cette catégorie</div>}
              {platsCategorie.map((p, i) => (
                <div key={p.id} onClick={() => { setPlatSelId(platSelId===p.id?null:p.id); setComplementId(null); setPortion('entier') }}
                  style={{ padding:'14px 16px', borderBottom:i<platsCategorie.length-1?'1px solid #1C1C1C':'none', cursor:'pointer', background:platSelId===p.id?'rgba(204,20,20,0.06)':'transparent', transition:'background 0.15s' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:'0.95rem' }}>{p.nom}</div>
                      {p.complement && <div style={{ fontSize:'0.72rem', color:'#D4A843', marginTop:'2px' }}>+ accompagnement au choix</div>}
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0, marginLeft:'12px' }}>
                      {p.a_demi_plat ? (
                        <div>
                          <div style={{ fontSize:'0.75rem', color:'#A0A0A0' }}>demi : {p.prix_demi}€</div>
                          <div style={{ fontWeight:700, color:'#D4A843' }}>entier : {p.prix_entier}€</div>
                        </div>
                      ) : (
                        <div style={{ fontWeight:700, color:'#D4A843', fontSize:'1rem' }}>{p.prix_entier}€</div>
                      )}
                    </div>
                  </div>

                  {/* SÉLECTION PORTION + COMPLÉMENT */}
                  {platSelId === p.id && (
                    <div style={{ marginTop:'12px', paddingTop:'12px', borderTop:'1px solid #2E2E2E' }} onClick={e=>e.stopPropagation()}>
                      {p.a_demi_plat && (
                        <div style={{ marginBottom:'10px' }}>
                          <div style={{ fontSize:'0.72rem', color:'#A0A0A0', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Portion</div>
                          <div style={{ display:'flex', gap:'8px' }}>
                            <button onClick={()=>setPortion('demi')} style={{ flex:1, padding:'8px', borderRadius:'8px', border:`2px solid ${portion==='demi'?'#CC1414':'#2E2E2E'}`, background:portion==='demi'?'rgba(204,20,20,0.1)':'transparent', color:'#F0F0F0', fontSize:'0.82rem', cursor:'pointer' }}>
                              🍽️ Demi — {p.prix_demi}€
                            </button>
                            <button onClick={()=>setPortion('entier')} style={{ flex:1, padding:'8px', borderRadius:'8px', border:`2px solid ${portion==='entier'?'#CC1414':'#2E2E2E'}`, background:portion==='entier'?'rgba(204,20,20,0.1)':'transparent', color:'#F0F0F0', fontSize:'0.82rem', cursor:'pointer' }}>
                              🍛 Entier — {p.prix_entier}€
                            </button>
                          </div>
                        </div>
                      )}

                      {p.complement && (
                        <div style={{ marginBottom:'10px' }}>
                          <div style={{ fontSize:'0.72rem', color:'#A0A0A0', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Accompagnement (inclus)</div>
                          <select value={complementId||''} onChange={e=>setComplementId(Number(e.target.value)||null)}
                            style={{ ...S.input }}>
                            <option value="">Sans accompagnement</option>
                            {COMPLEMENTS.map(c=><option key={c.id} value={c.id}>{c.nom}{c.prix_supplement>0?` (+${c.prix_supplement}€)`:''}</option>)}
                          </select>
                        </div>
                      )}

                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                        <div style={{ fontSize:'0.72rem', color:'#A0A0A0', letterSpacing:'2px', textTransform:'uppercase' }}>Quantité</div>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginLeft:'auto' }}>
                          <button onClick={()=>setQuantite(q=>Math.max(1,q-1))} style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#1C1C1C', border:'1px solid #2E2E2E', color:'#F0F0F0', fontSize:'1.1rem', cursor:'pointer' }}>−</button>
                          <span style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.4rem', minWidth:'24px', textAlign:'center' }}>{quantite}</span>
                          <button onClick={()=>setQuantite(q=>q+1)} style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#1C1C1C', border:'1px solid #2E2E2E', color:'#F0F0F0', fontSize:'1.1rem', cursor:'pointer' }}>+</button>
                        </div>
                      </div>

                      <input value={remarque} onChange={e=>setRemarque(e.target.value)} placeholder="Remarque (sans piment, bien cuit...)" style={{ ...S.input, marginBottom:'10px' }}/>

                      <button onClick={ajouterAuPanier} style={{ ...S.btnPrimary, padding:'10px' }}>
                        ➕ Ajouter au panier — {(getPrix() + (COMPLEMENTS.find(c=>c.id===complementId)?.prix_supplement||0)) * quantite}€
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* PANIER */}
            {panier.length > 0 && (
              <div style={S.card}>
                <div style={S.cardHead}>🛒 MON PANIER — {total}€</div>
                <div style={{ padding:'12px 16px' }}>
                  {panier.map((l,i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #1C1C1C', fontSize:'0.85rem' }}>
                      <div style={{ flex:1 }}>
                        <strong>{l.quantite}× {l.nom_plat}</strong>
                        {l.complement_nom && <div style={{fontSize:'0.75rem',color:'#D4A843'}}>+ {l.complement_nom}</div>}
                        {l.remarque && <div style={{fontSize:'0.72rem',color:'#606060',fontStyle:'italic'}}>{l.remarque}</div>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                        <span style={{ color:'#D4A843', fontWeight:700 }}>{l.sous_total}€</span>
                        <button onClick={()=>setPanier(p=>p.filter((_,j)=>j!==i))} style={{ background:'transparent', border:'none', color:'#CC1414', cursor:'pointer', fontSize:'1rem', padding:'0 4px' }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'12px', fontFamily:'Bebas Neue, sans-serif', fontSize:'1.3rem' }}>
                    <span>TOTAL À PAYER</span>
                    <span style={{color:'#D4A843'}}>{total}€</span>
                  </div>
                  <div style={{ fontSize:'0.75rem', color:'#606060', marginTop:'4px' }}>Paiement à l'arrivée au restaurant</div>
                </div>
              </div>
            )}

            <button onClick={() => panier.length > 0 && setStep('infos')}
              style={{ ...S.btnPrimary, opacity: panier.length > 0 ? 1 : 0.4 }}>
              Continuer → {panier.length > 0 ? `(${panier.length} article${panier.length>1?'s':''} · ${total}€)` : 'Ajoutez des articles'}
            </button>
          </>
        )}

        {/* ── ÉTAPE 2 : INFOS CLIENT ── */}
        {step === 'infos' && (
          <>
            <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.4rem', letterSpacing:'3px', marginBottom:'16px' }}>
              👤 VOS INFORMATIONS
            </div>

            <div style={S.card}>
              <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:'14px' }}>
                <div>
                  <div style={{ fontSize:'0.72rem', color:'#A0A0A0', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Votre nom *</div>
                  <input value={nom} onChange={e=>setNom(e.target.value)} placeholder="Prénom Nom" style={S.input}/>
                </div>
                <div>
                  <div style={{ fontSize:'0.72rem', color:'#A0A0A0', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Téléphone *</div>
                  <input value={tel} onChange={e=>setTel(e.target.value)} placeholder="06 12 34 56 78" type="tel" style={S.input}/>
                </div>
                <div>
                  <div style={{ fontSize:'0.72rem', color:'#A0A0A0', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Heure d'arrivée prévue *</div>
                  <input value={heure} onChange={e=>setHeure(e.target.value)} type="time" style={S.input}/>
                  <div style={{ fontSize:'0.72rem', color:'#606060', marginTop:'4px' }}>La cuisine préparera votre commande pour cette heure</div>
                </div>
                <div>
                  <div style={{ fontSize:'0.72rem', color:'#A0A0A0', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' }}>Type de service</div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {(['sur place','à emporter'] as const).map(t => (
                      <button key={t} onClick={()=>setTypeService(t)}
                        style={{ flex:1, padding:'10px', borderRadius:'10px', border:`2px solid ${typeService===t?'#CC1414':'#2E2E2E'}`, background:typeService===t?'rgba(204,20,20,0.1)':'transparent', color:'#F0F0F0', fontSize:'0.85rem', cursor:'pointer', fontWeight:600 }}>
                        {t === 'sur place' ? '🍽️ Sur place' : '📦 À emporter'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={()=>setStep('menu')} style={{ ...S.btnSecondary, flex:1 }}>← Retour</button>
              <button onClick={()=>(nom&&tel&&heure)&&setStep('confirm')}
                style={{ ...S.btnPrimary, flex:2, opacity:(nom&&tel&&heure)?1:0.4 }}>
                Continuer →
              </button>
            </div>
          </>
        )}

        {/* ── ÉTAPE 3 : CONFIRMATION ── */}
        {step === 'confirm' && (
          <>
            <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'1.4rem', letterSpacing:'3px', marginBottom:'16px' }}>
              ✅ CONFIRMER LA COMMANDE
            </div>

            <div style={S.card}>
              <div style={S.cardHead}>📋 RÉCAPITULATIF</div>
              <div style={{ padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem', marginBottom:'10px', paddingBottom:'10px', borderBottom:'1px solid #1C1C1C' }}>
                  <div>
                    <div><strong>{nom}</strong></div>
                    <div style={{color:'#A0A0A0',fontSize:'0.8rem'}}>{tel}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{color:'#CC1414',fontWeight:700}}>{heure}</div>
                    <div style={{color:'#A0A0A0',fontSize:'0.8rem'}}>{typeService}</div>
                  </div>
                </div>
                {panier.map((l,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #1C1C1C', fontSize:'0.85rem' }}>
                    <div>
                      <strong>{l.quantite}× {l.nom_plat}</strong>
                      {l.complement_nom && <div style={{fontSize:'0.75rem',color:'#D4A843'}}>+ {l.complement_nom}</div>}
                    </div>
                    <span style={{color:'#D4A843',fontWeight:700}}>{l.sous_total}€</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'12px', fontFamily:'Bebas Neue, sans-serif', fontSize:'1.4rem' }}>
                  <span>TOTAL</span>
                  <span style={{color:'#D4A843'}}>{total}€</span>
                </div>
                <div style={{ marginTop:'8px', padding:'10px', background:'#1C1C1C', borderRadius:'8px', fontSize:'0.78rem', color:'#A0A0A0' }}>
                  💳 Paiement à l'arrivée au restaurant
                </div>
              </div>
            </div>

            <div style={{ background:'rgba(204,20,20,0.08)', border:'1px solid #CC1414', borderRadius:'10px', padding:'12px 14px', marginBottom:'14px', fontSize:'0.82rem', color:'#F0F0F0' }}>
              📍 <strong>Le Bassamba</strong> · {RESTAURANT.adresse}, 75018 Paris<br/>
              🚇 {RESTAURANT.metro}<br/>
              📞 {RESTAURANT.tel}
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={()=>setStep('infos')} style={{ ...S.btnSecondary, flex:1 }}>← Retour</button>
              <button onClick={validerCommande} disabled={loading}
                style={{ ...S.btnPrimary, flex:2, opacity:loading?0.6:1 }}>
                {loading ? '⏳ Envoi...' : '🍽️ CONFIRMER MA COMMANDE'}
              </button>
            </div>
          </>
        )}

        <div style={{ textAlign:'center', marginTop:'24px', fontSize:'0.72rem', color:'#444', lineHeight:'1.8' }}>
          Le Bassamba · 41Bis Rue Championnet 75018 Paris<br/>
          {RESTAURANT.tel} · {RESTAURANT.portable}
        </div>
      </div>
    </div>
  )
}
