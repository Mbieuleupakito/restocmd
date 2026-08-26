'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Home() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)
  const [err, setErr] = useState(false)

  const goAdmin = () => {
    if (pin === '1234') { router.push('/admin') }
    else { setErr(true); setTimeout(() => setErr(false), 1500) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', gap:'36px' }}>

      {/* LOGO */}
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--font-d)', fontSize:'clamp(3.5rem,14vw,7rem)', letterSpacing:'6px', color:'var(--red)', lineHeight:1, textShadow:'0 0 50px rgba(204,20,20,0.3)' }}>
          LE BASSAMBA
        </div>
        <div style={{ width:'50px', height:'3px', background:'var(--gold)', margin:'12px auto', borderRadius:'2px' }}/>
        <div style={{ fontSize:'0.72rem', letterSpacing:'5px', color:'var(--text3)', textTransform:'uppercase' }}>
          Système de commandes
        </div>
      </div>

      {/* CARDS */}
      <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', justifyContent:'center', width:'100%', maxWidth:'680px' }}>
        {[
          { emoji:'🛎️', title:'ACCUEIL',    desc:'Saisir les commandes\nGérer les boissons\nÉmettre les factures', color:'var(--red)',   path:'/accueil' },
          { emoji:'👨‍🍳', title:'CUISINE',    desc:'Recevoir les plats\nAlertes en temps réel\nGérer les préparations', color:'var(--green)', path:'/cuisine' },
          { emoji:'📊', title:'HISTORIQUE', desc:'7 jours d\'historique\nChiffre d\'affaires\nStats et tendances', color:'var(--gold)',  path:'/historique' },
          { emoji:'👨‍💼', title:'PATRON',     desc:'Tableau de bord\nContrôle à distance\nStats complètes', color:'var(--blue)',  path:'/patron' },
        ].map(c => (
          <button key={c.path} onClick={() => router.push(c.path)}
            style={{ flex:'1', minWidth:'140px', maxWidth:'160px', background:'var(--surface)', border:`1px solid var(--border)`, borderRadius:'var(--r-lg)', padding:'24px 16px', cursor:'pointer', textAlign:'center', transition:'all 0.2s', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = c.color; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = `0 12px 30px ${c.color}22` }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.transform = ''; el.style.boxShadow = '' }}>
            <span style={{ fontSize:'2rem' }}>{c.emoji}</span>
            <div style={{ fontFamily:'var(--font-d)', fontSize:'1.4rem', letterSpacing:'2px', color: c.color }}>{c.title}</div>
            <div style={{ fontSize:'0.72rem', color:'var(--text2)', lineHeight:'1.7', whiteSpace:'pre-line' }}>{c.desc}</div>
          </button>
        ))}
      </div>

      {/* COMMANDE EN LIGNE */}
      <button onClick={() => router.push('/commander')}
        style={{ background:'var(--gold)', color:'#000', border:'none', borderRadius:'var(--r)', padding:'12px 28px', fontWeight:700, fontSize:'0.9rem', cursor:'pointer', letterSpacing:'1px' }}>
        🌐 Commander en ligne (clients)
      </button>

      {/* ADMIN */}
      <div>
        {!showAdmin ? (
          <button className="btn-ghost" onClick={() => setShowAdmin(true)} style={{ fontSize:'0.75rem', color:'var(--text3)' }}>⚙️ Administration</button>
        ) : (
          <div style={{ display:'flex', gap:'8px', alignItems:'center', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'10px 14px' }}>
            <input type="password" placeholder="Code admin" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key==='Enter' && goAdmin()} style={{ width:'130px', borderColor: err ? 'var(--red)' : undefined }} maxLength={4}/>
            <button className="btn-primary" onClick={goAdmin} style={{ padding:'10px 16px', whiteSpace:'nowrap' }}>Entrer</button>
            <button className="btn-ghost" onClick={() => setShowAdmin(false)}>✕</button>
          </div>
        )}
      </div>

      <div style={{ fontSize:'0.68rem', color:'var(--text3)', textAlign:'center' }}>
        41Bis, Rue Championnet — 75018 Paris · Métro Ligne 4
      </div>
    </div>
  )
}
