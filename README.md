# RestoCMD — Le Bassamba 🍛

Système de gestion des commandes en temps réel.

## Stack
- Next.js 14 (App Router)
- Supabase (PostgreSQL + Realtime)
- Vercel (déploiement)

## Installation
\`\`\`bash
npm install
cp .env.example .env.local
# Remplir les variables Supabase
npm run dev
\`\`\`

## SQL Supabase
Exécuter le fichier `supabase/schema.sql` dans l'éditeur SQL Supabase.

## Pages
- `/` → Sélection (Accueil / Cuisine / Historique)
- `/accueil` → Saisie commandes + facturation
- `/cuisine` → Affichage plats + alertes
- `/historique` → 7 jours d'historique
- `/admin` → Gestion menu + stats (code: 1234)
