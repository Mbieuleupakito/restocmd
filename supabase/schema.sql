-- ================================================
-- RESTOCMD — LE BASSAMBA — Schema Supabase
-- Coller dans : Supabase > SQL Editor > New Query
-- ================================================

-- Activer le realtime sur les tables
-- (fait automatiquement via Supabase dashboard)

-- ── COMMANDES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS commandes (
  id              BIGSERIAL PRIMARY KEY,
  numero          BIGSERIAL,
  source          TEXT NOT NULL DEFAULT 'Présentiel'
                  CHECK(source IN ('Présentiel','À emporter','Deliveroo','Uber Eats')),
  table_ref       TEXT DEFAULT '',
  statut          TEXT NOT NULL DEFAULT 'nouvelle'
                  CHECK(statut IN ('nouvelle','en_preparation','prete','servie','annulee')),
  montant_total   NUMERIC(8,2) DEFAULT 0,
  heure_creation  TIMESTAMPTZ DEFAULT NOW(),
  heure_modif     TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT DEFAULT ''
);

-- ── LIGNES DE COMMANDE ────────────────────────────
CREATE TABLE IF NOT EXISTS lignes_commande (
  id              BIGSERIAL PRIMARY KEY,
  commande_id     BIGINT NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  plat_id         INTEGER NOT NULL,
  nom_plat        TEXT NOT NULL,
  complement_id   INTEGER,
  complement_nom  TEXT,
  quantite        INTEGER NOT NULL DEFAULT 1,
  prix_unitaire   NUMERIC(8,2) NOT NULL,
  remarque        TEXT DEFAULT '',
  sous_total      NUMERIC(8,2) NOT NULL DEFAULT 0,
  destination     TEXT NOT NULL DEFAULT 'cuisine'
                  CHECK(destination IN ('cuisine','accueil'))
);

-- ── HISTORIQUE JOURNALIER ─────────────────────────
CREATE TABLE IF NOT EXISTS historique_journalier (
  id               BIGSERIAL PRIMARY KEY,
  date_journee     DATE NOT NULL UNIQUE,
  nb_commandes     INTEGER DEFAULT 0,
  nb_presentiel    INTEGER DEFAULT 0,
  nb_emporter      INTEGER DEFAULT 0,
  nb_deliveroo     INTEGER DEFAULT 0,
  nb_ubereats      INTEGER DEFAULT 0,
  chiffre_affaires NUMERIC(10,2) DEFAULT 0,
  detail_json      TEXT,
  heure_creation   TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEX ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes(statut);
CREATE INDEX IF NOT EXISTS idx_commandes_date   ON commandes(heure_creation);
CREATE INDEX IF NOT EXISTS idx_lignes_cmd       ON lignes_commande(commande_id);
CREATE INDEX IF NOT EXISTS idx_hist_date        ON historique_journalier(date_journee);

-- ── REALTIME ──────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE commandes;
ALTER PUBLICATION supabase_realtime ADD TABLE lignes_commande;

-- ── RLS (Row Level Security) ──────────────────────
-- Pour usage interne restaurant : on désactive RLS
ALTER TABLE commandes DISABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_commande DISABLE ROW LEVEL SECURITY;
ALTER TABLE historique_journalier DISABLE ROW LEVEL SECURITY;
