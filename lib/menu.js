// ============================================================
// MENU COMPLET — LE BASSAMBA
// 41Bis, Rue Championnet 75018 Paris
// ============================================================

export const RESTAURANT = {
  nom: 'Le Bassamba',
  nomLegal: 'Restaurant Le Bassamba',
  adresse: '41Bis, Rue Championnet',
  codePostal: '75018',
  ville: 'Paris',
  tel: '01 71 28 96 35',
  portable: '07 51 81 46 84 / 07 53 16 50 92',
  metro: 'Métro Simplon (ou) Porte de Clingnancourt (Ligne 4)',
  siret: '',          // à remplir
  tva: '',            // à remplir si assujetti
  wifi: 'QNXFDUEKM2M1',
}

// destination: 'cuisine' = envoyé en bas | 'accueil' = géré en haut
export const CATEGORIES = [
  { id: 'plats',      nom: 'Plats',       nom_en: 'Main Dishes',  destination: 'cuisine', emoji: '🍛' },
  { id: 'bieres',     nom: 'Bières',      nom_en: 'Beers',        destination: 'accueil', emoji: '🍺' },
  { id: 'vins',       nom: 'Vins',        nom_en: 'Wines',        destination: 'accueil', emoji: '🍷' },
  { id: 'sodas',      nom: 'Sodas',       nom_en: 'Soft Drinks',  destination: 'accueil', emoji: '🥤' },
  { id: 'champagnes', nom: 'Champagnes',  nom_en: 'Champagnes',   destination: 'accueil', emoji: '🍾' },
  { id: 'whiskys',    nom: 'Whiskys',     nom_en: 'Whiskys',      destination: 'accueil', emoji: '🥃' },
  { id: 'formules',   nom: 'Formules',    nom_en: 'Deals',        destination: 'accueil', emoji: '🎯' },
]

// prix: null = prix variable (à saisir manuellement), sinon fixe
// prix2: deuxième prix si le plat a 2 tailles
export const PLATS = [
  // ─── PLATS ───────────────────────────────────────────────
  { id: 1,  categorie: 'plats', nom: 'Soya simple',                   prix: 10,  prix2: null, complement: false },
  { id: 2,  categorie: 'plats', nom: 'Soya avec compléments',         prix: 15,  prix2: null, complement: true  },
  { id: 3,  categorie: 'plats', nom: 'Sauce pistache Gombo viande',   prix: 20,  prix2: null, complement: true  },
  { id: 4,  categorie: 'plats', nom: 'Sauce pistache poisson fumé',   prix: 20,  prix2: null, complement: true  },
  { id: 5,  categorie: 'plats', nom: 'Bongo Poisson Riz ou Ignane',   prix: 20,  prix2: null, complement: true  },
  { id: 6,  categorie: 'plats', nom: 'Kondre Viande',                 prix: 20,  prix2: null, complement: true  },
  { id: 7,  categorie: 'plats', nom: 'Sauce d\'arachide viande Riz',  prix: 20,  prix2: null, complement: true  },
  { id: 8,  categorie: 'plats', nom: 'Sauce d\'arachide poisson fumé',prix: 15,  prix2: null, complement: true  },
  { id: 9,  categorie: 'plats', nom: 'Tendons Riz ou bobolo',         prix: 15,  prix2: null, complement: true  },
  { id: 10, categorie: 'plats', nom: 'Porc Tape aloco',               prix: 7,   prix2: 13,   complement: true  },
  { id: 11, categorie: 'plats', nom: 'Brochettes simple',             prix: 10,  prix2: null, complement: false },
  { id: 12, categorie: 'plats', nom: 'Brochettes Riz ou Tape, Aloco', prix: 15,  prix2: null, complement: true  },
  { id: 13, categorie: 'plats', nom: 'Plat de Porc Riz',             prix: 15,  prix2: null, complement: true  },
  { id: 14, categorie: 'plats', nom: 'Plat d\'ailes de poulets',      prix: 7,   prix2: 13,   complement: true  },
  { id: 15, categorie: 'plats', nom: 'Taro Royal',                    prix: 25,  prix2: null, complement: true  },
  { id: 16, categorie: 'plats', nom: 'Taro simple',                   prix: 20,  prix2: null, complement: true  },
  { id: 17, categorie: 'plats', nom: 'Ndolé poisson fumé',            prix: 20,  prix2: null, complement: true  },
  { id: 18, categorie: 'plats', nom: 'Ndolé Royal',                   prix: 25,  prix2: null, complement: true  },
  { id: 19, categorie: 'plats', nom: 'ERU Water fufu ou tapioca',     prix: 20,  prix2: null, complement: true  },
  { id: 20, categorie: 'plats', nom: 'Légume sauté plantain',         prix: 20,  prix2: null, complement: true  },
  { id: 21, categorie: 'plats', nom: 'Légume Sauce poisson bar',      prix: 25,  prix2: null, complement: true  },
  { id: 22, categorie: 'plats', nom: 'Okok Bobolo',                   prix: 20,  prix2: null, complement: true  },
  { id: 23, categorie: 'plats', nom: 'Maquereaux',                    prix: 20,  prix2: null, complement: true  },
  { id: 24, categorie: 'plats', nom: 'Sole',                          prix: 50,  prix2: 60,   complement: true  },
  { id: 25, categorie: 'plats', nom: 'BAR, Capitaine',                prix: 25,  prix2: 30,   complement: true  },
  { id: 26, categorie: 'plats', nom: 'Tilapia',                       prix: 15,  prix2: 20,   complement: true  },
  { id: 27, categorie: 'plats', nom: 'Pepe soupe',                    prix: 15,  prix2: 20,   complement: false },
  { id: 28, categorie: 'plats', nom: 'Beignet haricots',              prix: 15,  prix2: null, complement: false },
  { id: 29, categorie: 'plats', nom: 'CORNTCHAP Viande',              prix: 20,  prix2: null, complement: true  },
  { id: 30, categorie: 'plats', nom: 'Atieke Poisson',                prix: 20,  prix2: 25,   complement: true  },
  { id: 31, categorie: 'plats', nom: 'Riz Sauce tomate Viande',       prix: 15,  prix2: null, complement: true  },
  { id: 32, categorie: 'plats', nom: 'Riz sauce tomate poisson',      prix: 20,  prix2: null, complement: true  },
  { id: 33, categorie: 'plats', nom: 'Poulet DG 1/2 plat',           prix: 30,  prix2: null, complement: true  },
  { id: 34, categorie: 'plats', nom: 'Poulet entier',                 prix: 50,  prix2: null, complement: true  },

  // ─── BIÈRES ──────────────────────────────────────────────
  { id: 40, categorie: 'bieres', nom: 'Heineken',       prix: 5,   prix2: null },
  { id: 41, categorie: 'bieres', nom: '1664',            prix: 7,   prix2: null },
  { id: 42, categorie: 'bieres', nom: 'Leffe',           prix: 5,   prix2: null },
  { id: 43, categorie: 'bieres', nom: 'Pelforth',        prix: 10,  prix2: null },
  { id: 44, categorie: 'bieres', nom: '33 Export',       prix: 10,  prix2: null },
  { id: 45, categorie: 'bieres', nom: 'Mutzig',          prix: 10,  prix2: null },
  { id: 46, categorie: 'bieres', nom: 'Castel',          prix: 10,  prix2: null },
  { id: 47, categorie: 'bieres', nom: 'Isenbeck',        prix: 10,  prix2: null },
  { id: 48, categorie: 'bieres', nom: 'Guinness 65cl',   prix: 10,  prix2: null },
  { id: 49, categorie: 'bieres', nom: 'Guinness 30cl',   prix: 5,   prix2: null },
  { id: 50, categorie: 'bieres', nom: 'F. Desperados',   prix: 12,  prix2: null },
  { id: 51, categorie: 'bieres', nom: 'G. Desperados',   prix: 10,  prix2: null },
  { id: 52, categorie: 'bieres', nom: 'G. Leffe',        prix: 10,  prix2: null },
  { id: 53, categorie: 'bieres', nom: 'P. Desperados',   prix: 12,  prix2: null },

  // ─── VINS ────────────────────────────────────────────────
  { id: 60, categorie: 'vins', nom: 'Roche mazet',        prix: 25,  prix2: null },
  { id: 61, categorie: 'vins', nom: 'Muscadet',           prix: 20,  prix2: null },
  { id: 62, categorie: 'vins', nom: 'Côtes du Rhône',     prix: 20,  prix2: null },
  { id: 63, categorie: 'vins', nom: 'Cabernet d\'anjou',  prix: 20,  prix2: null },
  { id: 64, categorie: 'vins', nom: 'Merlot',             prix: 20,  prix2: null },
  { id: 65, categorie: 'vins', nom: 'Bordeaux',           prix: 20,  prix2: null },
  { id: 66, categorie: 'vins', nom: 'Chateau barreyres',  prix: 15,  prix2: null },
  { id: 67, categorie: 'vins', nom: 'Mouton cadet',       prix: 25,  prix2: null },
  { id: 68, categorie: 'vins', nom: 'Muscador',           prix: 20,  prix2: null },
  { id: 69, categorie: 'vins', nom: 'Petit vins',         prix: 5,   prix2: 15   },

  // ─── SODAS ───────────────────────────────────────────────
  { id: 70, categorie: 'sodas', nom: 'Malta Guinness',  prix: 6,  prix2: null },
  { id: 71, categorie: 'sodas', nom: 'Coca',            prix: 3,  prix2: 5    },
  { id: 72, categorie: 'sodas', nom: 'Redbull',         prix: 5,  prix2: null },
  { id: 73, categorie: 'sodas', nom: 'Fanta',           prix: 5,  prix2: null },
  { id: 74, categorie: 'sodas', nom: 'Schweppes',       prix: 3,  prix2: null },
  { id: 75, categorie: 'sodas', nom: 'Top Soda',        prix: 6,  prix2: null },
  { id: 76, categorie: 'sodas', nom: 'Café',            prix: 2,  prix2: null },
  { id: 77, categorie: 'sodas', nom: 'Eau',             prix: 2,  prix2: 3    },

  // ─── CHAMPAGNES ──────────────────────────────────────────
  { id: 80, categorie: 'champagnes', nom: 'Ruinart',           prix: 100, prix2: null },
  { id: 81, categorie: 'champagnes', nom: 'Veuve Clicquot',    prix: 90,  prix2: null },
  { id: 82, categorie: 'champagnes', nom: 'Galuchat',          prix: 90,  prix2: null },
  { id: 83, categorie: 'champagnes', nom: 'Moët blanc',        prix: 100, prix2: null },
  { id: 84, categorie: 'champagnes', nom: 'G.H. MMM',          prix: 60,  prix2: null },
  { id: 85, categorie: 'champagnes', nom: 'Clément d\'alsace', prix: 60,  prix2: null, disponible: true },
  { id: 86, categorie: 'champagnes', nom: 'Laurent Perrier',   prix: 60,  prix2: null },
  { id: 87, categorie: 'champagnes', nom: 'Moët',              prix: 100, prix2: null },

  // ─── WHISKYS ─────────────────────────────────────────────
  { id: 90, categorie: 'whiskys', nom: 'Baley\'s',          prix: 50,  prix2: null },
  { id: 91, categorie: 'whiskys', nom: 'Cognac',            prix: 50,  prix2: null },
  { id: 92, categorie: 'whiskys', nom: 'Jack Daniel\'s',    prix: 60,  prix2: null },
  { id: 93, categorie: 'whiskys', nom: 'Chivas 12 ans',     prix: 60,  prix2: null },
  { id: 94, categorie: 'whiskys', nom: 'Chivas 18 ans',     prix: 100, prix2: null },
  { id: 95, categorie: 'whiskys', nom: 'Martini',           prix: 40,  prix2: null },
  { id: 96, categorie: 'whiskys', nom: 'Balantines',        prix: 50,  prix2: null },
  { id: 97, categorie: 'whiskys', nom: 'Poliakov vodka',    prix: 50,  prix2: null },
  { id: 98, categorie: 'whiskys', nom: 'Conso',             prix: 5,   prix2: 7.5  },

  // ─── FORMULES ────────────────────────────────────────────
  { id: 100, categorie: 'formules', nom: 'Formule 3 bières (Heineken / Desperados)', prix: 12, prix2: null, disponible: true },
]

// Compléments pour les plats (inclus dans le prix)
export const COMPLEMENTS = [
  { id: 1, nom: 'Riz',            prix_supplement: 0 },
  { id: 2, nom: 'Aloco',          prix_supplement: 0 },
  { id: 3, nom: 'Bobolo',         prix_supplement: 0 },
  { id: 4, nom: 'Plantain tapé',  prix_supplement: 0 },
  { id: 5, nom: 'Ignane',         prix_supplement: 0 },
  { id: 6, nom: 'Tapioca',        prix_supplement: 0 },
  { id: 7, nom: 'Water fufu',     prix_supplement: 0 },
  { id: 8, nom: 'Attiéké',        prix_supplement: 0 },
  // Suppléments payants
  { id: 9, nom: 'Complément simple', prix_supplement: 3 },
  { id: 10, nom: 'Complément maxi',  prix_supplement: 5 },
]
