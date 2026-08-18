'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Home() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)

  const goAdmin = () => {
    if (pin === '1234') { router.push('/admin') }
    else { alert('Code incorrect') }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', gap:'40px' }}>
      {/* LOGO */}
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(3rem,12vw,7rem)', letterSpacing:'6px', color:'var(--red)', lineHeight:1, textShadow:'0 0 60px rgba(204,20,20,0.4)' }}>
          LE BASSAMBA
        </div>
        <div style={{ fontSize:'0.75rem', letterSpacing:'5px', color:'var(--text2)', marginTop:'8px', textTransform:'uppercase' }}>
          Système de commandes
        </div>
        <div style={{ width:'60px', height:'3px', background:'var(--gold)', margin:'16px auto 0', borderRadius:'2px' }} />
      </div>

      {/* CARDS */}
      <div style={{ display:'flex', gap:'20px', flexWrap:'wrap', justifyContent:'center', width:'100%', maxWidth:'700px' }}>
        <SelectCard emoji="🛎️" title="ACCUEIL" desc="Saisir les commandes\nGérer les boissons\nÉmettre les factures" color="var(--red)" onClick={() => router.push('/accueil')} />
        <SelectCard emoji="👨‍🍳" title="CUISINE" desc="Recevoir les plats\nAlertes en temps réel\nGérer les préparations" color="var(--green)" onClick={() => router.push('/cuisine')} />
        <SelectCard emoji="📊" title="HISTORIQUE" desc="7 jours d'historique\nChiffre d'affaires\nStats par source" color="var(--gold)" onClick={() => router.push('/historique')} />
      </div>

      {/* ADMIN */}
      <div>
        {!showAdmin ? (
          <button className="btn-ghost" onClick={() => setShowAdmin(true)} style={{ fontSize:'0.75rem' }}>
            ⚙️ Accès Administration
          </button>
        ) : (
          <div style={{ display:'flex', gap:'10px', alignItems:'center', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'12px 16px' }}>
            <input type="password" placeholder="Code admin" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && goAdmin()} style={{ width:'140px' }} />
            <button className="btn-primary" onClick={goAdmin}>Entrer</button>
            <button className="btn-ghost" onClick={() => setShowAdmin(false)}>✕</button>
          </div>
        )}
      </div>

      <div style={{ fontSize:'0.7rem', color:'var(--text3)', textAlign:'center' }}>
        41Bis, Rue Championnet 75018 Paris · Ligne 4
      </div>
    </div>
  )
}

function SelectCard({ emoji, title, desc, color, onClick }: { emoji:string; title:string; desc:string; color:string; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ flex:'1', minWidth:'200px', maxWidth:'220px', background:'var(--surface)', border:`1px solid var(--border)`, borderRadius:'var(--radius-lg)', padding:'32px 24px', cursor:'pointer', textAlign:'center', transition:'all 0.2s', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 40px ${color}22` }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
      <span style={{ fontSize:'2.5rem' }}>{emoji}</span>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', letterSpacing:'3px', color }}>{title}</div>
      <div style={{ fontSize:'0.78rem', color:'var(--text2)', lineHeight:'1.6', whiteSpace:'pre-line' }}>{desc}</div>
    </button>
  )
}
