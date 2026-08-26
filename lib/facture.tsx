// Composant Facture professionnel — inspiré ticket Bistrot Marsellus
import { RESTAURANT } from './menu'

interface Ligne {
  nom_plat: string; complement_nom?: string | null; quantite: number
  prix_unitaire: number; sous_total: number; remarque?: string | null
}
interface Commande {
  id: number; source: string; table_ref: string
  montant_total: number; heure_creation: string; lignes: Ligne[]
}

export function TicketContent({ cmd }: { cmd: Commande }) {
  const date = new Date(cmd.heure_creation)
  const dateStr = date.toLocaleDateString('fr-FR', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }).toUpperCase()
  const heureStr = date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
  const numTicket = String(cmd.id).padStart(6, '0')

  const S: Record<string, React.CSSProperties> = {
    wrap: { background:'#fff', color:'#000', fontFamily:'"Courier New", Courier, monospace', fontSize:'13px', width:'100%', maxWidth:'380px', margin:'0 auto', padding:'20px 16px', lineHeight:'1.5' },
    center: { textAlign:'center' },
    bold: { fontWeight:'bold' },
    line: { borderTop:'1px dashed #000', margin:'10px 0' },
    doubleLine: { borderTop:'2px solid #000', margin:'10px 0' },
    row: { display:'flex', justifyContent:'space-between' },
    rowThree: { display:'grid', gridTemplateColumns:'1fr auto auto', gap:'8px' },
    small: { fontSize:'11px' },
    large: { fontSize:'16px', fontWeight:'bold' },
    veryLarge: { fontSize:'20px', fontWeight:'900', letterSpacing:'1px' },
  }

  return (
    <div style={S.wrap}>
      {/* EN-TÊTE */}
      <div style={{ ...S.center, marginBottom:'12px' }}>
        <div style={{ ...S.veryLarge, fontSize:'18px' }}>{RESTAURANT.nom.toUpperCase()}</div>
        <div style={S.small}>{RESTAURANT.adresse}</div>
        <div style={S.small}>{RESTAURANT.codePostal} {RESTAURANT.ville.toUpperCase()}</div>
        <div style={S.small}>FRANCE</div>
        <div style={S.small}>TEL. {RESTAURANT.tel}</div>
        {RESTAURANT.siret && <div style={S.small}>SIRET {RESTAURANT.siret}</div>}
      </div>

      <div style={S.line}/>

      {/* INFOS COMMANDE */}
      <div style={{ ...S.row, marginBottom:'4px' }}>
        <div><span style={S.bold}>TABLE</span> {cmd.table_ref || '—'}</div>
        <div><span style={S.bold}>N°</span> {numTicket}</div>
      </div>
      <div style={{ marginBottom:'4px' }}><span style={S.bold}>SOURCE</span> {cmd.source.toUpperCase()}</div>
      <div style={{ ...S.center, marginBottom:'4px' }}>
        <span style={S.bold}>{dateStr}  {heureStr}</span>
      </div>

      <div style={S.doubleLine}/>

      {/* ENTÊTE TABLEAU */}
      <div style={{ ...S.rowThree, ...S.bold, ...S.small, marginBottom:'4px' }}>
        <span>QTE  DESIGNATION</span>
        <span style={{ textAlign:'right' }}>P.U</span>
        <span style={{ textAlign:'right' }}>TOTAL</span>
      </div>

      <div style={S.line}/>

      {/* LIGNES */}
      {(cmd.lignes || []).map((l, i) => (
        <div key={i} style={{ marginBottom:'6px' }}>
          <div style={S.rowThree}>
            <span style={S.bold}>{l.quantite}  {l.nom_plat.toUpperCase()}</span>
            <span style={{ textAlign:'right' }}>{Number(l.prix_unitaire).toFixed(2)}</span>
            <span style={{ textAlign:'right', ...S.bold }}>{Number(l.sous_total).toFixed(2)}</span>
          </div>
          {l.complement_nom && (
            <div style={{ ...S.small, paddingLeft:'16px', color:'#444' }}>
              + {l.complement_nom.toUpperCase()}
            </div>
          )}
          {l.remarque && (
            <div style={{ ...S.small, paddingLeft:'16px', color:'#666', fontStyle:'italic' }}>
              * {l.remarque}
            </div>
          )}
        </div>
      ))}

      <div style={S.line}/>

      {/* TOTAL */}
      <div style={{ ...S.row, ...S.large, margin:'8px 0' }}>
        <span>TOTAL TTC</span>
        <span>{Number(cmd.montant_total).toFixed(2)} €</span>
      </div>

      <div style={S.line}/>

      {/* TVA */}
      <div style={{ ...S.small, marginBottom:'8px' }}>
        <div style={{ ...S.row }}>
          <span>CODE</span><span>TVA</span><span>HT</span><span>TTC</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'4px', fontSize:'11px' }}>
          <span>0 TVA</span>
          <span style={{ textAlign:'center' }}>10.00%</span>
          <span style={{ textAlign:'right' }}>{(Number(cmd.montant_total)/1.10).toFixed(2)}</span>
          <span style={{ textAlign:'right' }}>{Number(cmd.montant_total).toFixed(2)}</span>
        </div>
        <div style={{ ...S.row, borderTop:'1px solid #000', marginTop:'4px', paddingTop:'4px' }}>
          <span>Totaux</span>
          <span>{(Number(cmd.montant_total)/1.10).toFixed(2)}</span>
          <span>{Number(cmd.montant_total).toFixed(2)}</span>
        </div>
      </div>

      <div style={S.line}/>

      {/* PAIEMENT */}
      <div style={{ ...S.row, marginBottom:'4px' }}>
        <span style={S.bold}>1 ESPECES</span>
        <span style={S.bold}>{Number(cmd.montant_total).toFixed(2)} €</span>
      </div>

      <div style={S.doubleLine}/>

      {/* PIED */}
      <div style={{ ...S.center, ...S.small, marginTop:'8px', lineHeight:'1.8' }}>
        <div>Merci de votre visite !</div>
        <div>Thank you for your visit!</div>
        <div style={{ marginTop:'6px', fontWeight:'bold', fontSize:'13px', letterSpacing:'2px' }}>
          BONNE DÉGUSTATION !
        </div>
        <div style={{ marginTop:'8px', color:'#555' }}>
          TICKET N° {numTicket}
        </div>
        <div style={{ color:'#555' }}>{RESTAURANT.metro}</div>
      </div>
    </div>
  )
}
