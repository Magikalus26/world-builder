/**
 * Workd Builder — Dual Currency Save Manager, Furniture Catalog & Loot Box Engine
 * Persists Gold Coins ("Pièces d'Or"), Roguelike Tokens ("Éclats d'Architecte"),
 * Tool Upgrades, Unlocked Furniture Inventory, and Placed In-Level Decorations
 * in localStorage under "workd_builder_save".
 */

const SAVE_KEY = 'workd_builder_save';

export const RARITY_META = {
  commun: { label: 'Commun', color: '#8fd4a4', glow: 'rgba(143, 212, 164, 0.45)' },
  rare: { label: 'Rare', color: '#6ec4ff', glow: 'rgba(110, 196, 255, 0.55)' },
  legendaire: { label: 'Légendaire', color: '#ffd25a', glow: 'rgba(255, 210, 90, 0.72)' },
};

export const SHOP_CATALOG = [
  {
    id: 'golden_chisel',
    name: "Ciseau d'Or (Taille x2)",
    desc: 'Taille chaque bloc de pierre 2× plus vite sur l’établi.',
    price: 80,
    badge: '⛏️',
  },
  {
    id: 'reinforced_sled',
    name: 'Traîneau Renforcé (+1 bloc)',
    desc: 'Ajoute un 4e emplacement doré et +25% de vitesse aux traîneaux.',
    price: 120,
    badge: '🛷',
  },
  {
    id: 'royal_gold_stone',
    name: 'Pierre Royale Dorée',
    desc: 'Reflet doré sur vos blocs taillés et +25% d’or à la fin des niveaux.',
    price: 160,
    badge: '🏛️',
  },
  {
    id: 'pyramidion_aura',
    name: 'Aura du Pyramidion',
    desc: 'Halo doré autour du chantier et aimantation +25% sur le plan.',
    price: 220,
    badge: '✨',
  },
];

export const FURNITURE_CATALOG = [
  {
    id: 'item_01',
    name: "Chevalet d'Outils",
    rarity: 'commun',
    price: 30,
    promoPrice: 15,
    img: './assets/furniture/item_01.png',
    scale: 1.55,
  },
  {
    id: 'item_02',
    name: 'Établi de Tailleur',
    rarity: 'commun',
    price: 35,
    promoPrice: 18,
    img: './assets/furniture/item_02.png',
    scale: 1.65,
  },
  {
    id: 'item_03',
    name: 'Lit Royal Doré',
    rarity: 'legendaire',
    price: 110,
    promoPrice: null,
    img: './assets/furniture/item_03.png',
    scale: 1.85,
  },
  {
    id: 'item_04',
    name: 'Trône du Pharaon',
    rarity: 'legendaire',
    price: 115,
    promoPrice: null,
    img: './assets/furniture/item_04.png',
    scale: 1.75,
  },
  {
    id: 'item_05',
    name: "Étagère d'Amphores",
    rarity: 'commun',
    price: 30,
    promoPrice: 16,
    img: './assets/furniture/item_05.png',
    scale: 1.6,
  },
  {
    id: 'item_06',
    name: "Pupitre d'Architecte",
    rarity: 'rare',
    price: 55,
    promoPrice: 25,
    img: './assets/furniture/item_06.png',
    scale: 1.65,
  },
  {
    id: 'item_07',
    name: 'Banc & Lanterne Impériale',
    rarity: 'rare',
    price: 60,
    promoPrice: null,
    img: './assets/furniture/item_07.png',
    scale: 1.8,
  },
  {
    id: 'item_08',
    name: 'Brasero de Pierre',
    rarity: 'rare',
    price: 50,
    promoPrice: 22,
    img: './assets/furniture/item_08.png',
    scale: 1.55,
  },
  {
    id: 'item_09',
    name: 'Étal du Marchand',
    rarity: 'rare',
    price: 65,
    promoPrice: null,
    img: './assets/furniture/item_09.png',
    scale: 1.9,
  },
  {
    id: 'item_10',
    name: 'Traîneau de Bâtisseur',
    rarity: 'commun',
    price: 40,
    promoPrice: 20,
    img: './assets/furniture/item_10.png',
    scale: 1.75,
  },
  {
    id: 'item_11',
    name: 'Coffre du Trésor Royal',
    rarity: 'legendaire',
    price: 100,
    promoPrice: null,
    img: './assets/furniture/item_11.png',
    scale: 1.6,
  },
  {
    id: 'item_12',
    name: "Fontaine de l'Oasis",
    rarity: 'legendaire',
    price: 120,
    promoPrice: null,
    img: './assets/furniture/item_12.png',
    scale: 2.0,
  },
  {
    id: 'item_13',
    name: 'Lanterne en Fer Forgé',
    rarity: 'rare',
    price: 55,
    promoPrice: null,
    img: './assets/furniture/item_13.svg',
    scale: 1.65,
  },
  {
    id: 'item_14',
    name: 'Chariot en Bois XIXe',
    rarity: 'rare',
    price: 60,
    promoPrice: null,
    img: './assets/furniture/item_14.svg',
    scale: 1.75,
  },
];

export const LOOT_BOXES = [
  {
    id: 'classic',
    name: 'Coffre Classique',
    price: 30,
    itemCount: 1,
    bonusCoins: 50,
    subtitle: '1 meuble aléatoire + 50 Or',
    badge: '📦',
    guaranteedHigh: false,
    weights: { commun: 0.62, rare: 0.30, legendaire: 0.08 },
  },
  {
    id: 'royal',
    name: 'Coffre Royal',
    price: 65,
    itemCount: 2,
    bonusCoins: 150,
    subtitle: '2 meubles aléatoires + 150 Or',
    badge: '👑',
    guaranteedHigh: false,
    weights: { commun: 0.30, rare: 0.50, legendaire: 0.20 },
  },
  {
    id: 'legendary',
    name: 'Coffre Légendaire',
    price: 120,
    itemCount: 3,
    bonusCoins: 400,
    subtitle: '3 meubles (Rare/Légendaire) + 400 Or',
    badge: '☀️',
    guaranteedHigh: true,
    weights: { commun: 0.0, rare: 0.48, legendaire: 0.52 },
  },
];

function createDefaultSave() {
  return {
    coins: 100,
    tokens: 45,
    upgrades: {
      golden_chisel: false,
      reinforced_sled: false,
      royal_gold_stone: false,
      pyramidion_aura: false,
    },
    furniture: [], // Array of unlocked furniture IDs (e.g. ['item_01'])
    decorations: {}, // Map of levelKey -> [{ uid, itemId, x, z, rotY }]
    completedLevels: {}, // Map of levelId -> true for first-completion rewards
    stats: {
      levelsCompleted: 0,
      roguelikeCompleted: 0,
      lootBoxesOpened: 0,
    },
  };
}

export function getFurnitureById(id) {
  return FURNITURE_CATALOG.find((f) => f.id === id) || null;
}

export class SaveManager {
  constructor() {
    this.data = this._load();
  }

  _load() {
    const fallback = createDefaultSave();
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);

      const validFurnitureIds = new Set(FURNITURE_CATALOG.map((f) => f.id));
      const furniture = Array.isArray(parsed.furniture)
        ? Array.from(new Set(parsed.furniture.filter((id) => validFurnitureIds.has(id))))
        : [];

      const decorations =
        parsed.decorations && typeof parsed.decorations === 'object' && !Array.isArray(parsed.decorations)
          ? parsed.decorations
          : {};

      const completedLevels =
        parsed.completedLevels &&
        typeof parsed.completedLevels === 'object' &&
        !Array.isArray(parsed.completedLevels)
          ? parsed.completedLevels
          : {};

      return {
        coins:
          typeof parsed.coins === 'number' && Number.isFinite(parsed.coins)
            ? Math.max(0, Math.floor(parsed.coins))
            : fallback.coins,
        tokens:
          typeof parsed.tokens === 'number' && Number.isFinite(parsed.tokens)
            ? Math.max(0, Math.floor(parsed.tokens))
            : fallback.tokens,
        upgrades: { ...fallback.upgrades, ...(parsed.upgrades || {}) },
        furniture,
        decorations,
        completedLevels,
        stats: { ...fallback.stats, ...(parsed.stats || {}) },
      };
    } catch (_) {
      return fallback;
    }
  }

  _persist() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (_) {
      // Ignore storage quota / private mode errors cleanly
    }
  }

  hasCompletedLevel(levelId) {
    return Boolean(this.data.completedLevels && this.data.completedLevels[levelId]);
  }

  markLevelCompleted(levelId) {
    if (!levelId) return { firstTime: false };
    const firstTime = !this.hasCompletedLevel(levelId);
    this.data.completedLevels[levelId] = true;
    this._persist();
    return { firstTime };
  }

  /* ---- Dual Currency ---- */
  getCoins() {
    return this.data.coins;
  }

  getTokens() {
    return this.data.tokens;
  }

  addCoins(amount, mode = 'level') {
    const gain = Math.max(0, Math.floor(amount));
    this.data.coins += gain;
    if (mode === 'roguelike') {
      this.data.stats.roguelikeCompleted += 1;
    } else if (mode === 'level') {
      this.data.stats.levelsCompleted += 1;
    }
    this._persist();
    return this.data.coins;
  }

  spendCoins(amount) {
    const cost = Math.max(0, Math.floor(amount));
    if (this.data.coins < cost) return { ok: false, coins: this.data.coins };
    this.data.coins -= cost;
    this._persist();
    return { ok: true, coins: this.data.coins };
  }

  addRoguelikeTokens(amount) {
    const gain = Math.max(0, Math.floor(amount));
    this.data.tokens += gain;
    this._persist();
    return this.data.tokens;
  }

  /* ---- Tool Upgrades (Gold Coins) ---- */
  getUpgrades() {
    return { ...this.data.upgrades };
  }

  hasUpgrade(id) {
    return Boolean(this.data.upgrades[id]);
  }

  purchaseUpgrade(id) {
    const item = SHOP_CATALOG.find((u) => u.id === id);
    if (!item) return { ok: false, reason: 'invalid' };
    if (this.data.upgrades[id]) return { ok: false, reason: 'owned' };
    if (this.data.coins < item.price) return { ok: false, reason: 'funds' };

    this.data.coins -= item.price;
    this.data.upgrades[id] = true;
    this._persist();
    return { ok: true, item, coins: this.data.coins };
  }

  /* ---- Furniture Inventory & Daily Deals (Roguelike Éclats) ---- */
  getUnlockedFurniture() {
    return this.data.furniture.slice();
  }

  hasFurniture(id) {
    return this.data.furniture.includes(id);
  }

  /**
   * Returns 3 featured daily bargain items (15–25 Éclats), deterministic per calendar day.
   */
  getDailyDeals() {
    const promoPool = FURNITURE_CATALOG.filter((f) => typeof f.promoPrice === 'number');
    const now = new Date();
    const daySeed = now.getUTCFullYear() * 372 + (now.getUTCMonth() + 1) * 31 + now.getUTCDate();
    const startIdx = daySeed % promoPool.length;
    const deals = [];
    for (let i = 0; i < 3 && i < promoPool.length; i++) {
      deals.push(promoPool[(startIdx + i * 2) % promoPool.length]);
    }
    return deals;
  }

  purchaseFurniture(id, usePromo = false) {
    const item = getFurnitureById(id);
    if (!item) return { ok: false, reason: 'invalid' };
    if (this.hasFurniture(id)) return { ok: false, reason: 'owned' };

    const cost = usePromo && typeof item.promoPrice === 'number' ? item.promoPrice : item.price;
    if (this.data.tokens < cost) return { ok: false, reason: 'funds' };

    this.data.tokens -= cost;
    this.data.furniture.push(id);
    this._persist();
    return { ok: true, item, cost, tokens: this.data.tokens };
  }

  /**
   * Unlocks one or more decorative furniture items awarded by level completion.
   * Returns the array of newly unlocked catalog entries.
   */
  unlockFurnitureReward(ids = []) {
    const newlyUnlocked = [];
    if (!Array.isArray(ids) || ids.length === 0) return newlyUnlocked;
    let changed = false;
    ids.forEach((id) => {
      const item = getFurnitureById(id);
      if (item && !this.data.furniture.includes(id)) {
        this.data.furniture.push(id);
        newlyUnlocked.push(item);
        changed = true;
      }
    });
    if (changed) this._persist();
    return newlyUnlocked;
  }

  /* ---- Loot Boxes (Roguelike Éclats -> Furniture + Gold Coin Bonus) ---- */
  openLootBox(boxId) {
    const box = LOOT_BOXES.find((b) => b.id === boxId);
    if (!box) return { ok: false, reason: 'invalid' };
    if (this.data.tokens < box.price) return { ok: false, reason: 'funds' };

    this.data.tokens -= box.price;
    this.data.stats.lootBoxesOpened = (this.data.stats.lootBoxesOpened || 0) + 1;

    const rewards = [];
    const rolledThisBox = new Set();
    let duplicateCoins = 0;

    for (let i = 0; i < box.itemCount; i++) {
      const rarity = this._rollRarity(box.weights, box.guaranteedHigh);
      let pool = FURNITURE_CATALOG.filter((f) => f.rarity === rarity);
      if (pool.length === 0) pool = FURNITURE_CATALOG;

      // Strongly favor unowned items not yet drawn in this chest
      const unownedPool = pool.filter(
        (f) => !this.data.furniture.includes(f.id) && !rolledThisBox.has(f.id)
      );
      const distinctPool = pool.filter((f) => !rolledThisBox.has(f.id));
      const pickFrom =
        unownedPool.length > 0 ? unownedPool : distinctPool.length > 0 ? distinctPool : pool;

      const picked = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      rolledThisBox.add(picked.id);

      const isNew = !this.data.furniture.includes(picked.id);
      if (isNew) {
        this.data.furniture.push(picked.id);
      } else {
        duplicateCoins += picked.rarity === 'legendaire' ? 60 : picked.rarity === 'rare' ? 35 : 20;
      }

      rewards.push({
        item: picked,
        isNew,
        duplicateBonus: isNew ? 0 : picked.rarity === 'legendaire' ? 60 : picked.rarity === 'rare' ? 35 : 20,
      });
    }

    const totalCoinsGained = box.bonusCoins + duplicateCoins;
    this.data.coins += totalCoinsGained;
    this._persist();

    return {
      ok: true,
      box,
      rewards,
      bonusCoins: box.bonusCoins,
      duplicateCoins,
      totalCoinsGained,
      tokens: this.data.tokens,
      coins: this.data.coins,
    };
  }

  _rollRarity(weights, guaranteedHigh) {
    const r = Math.random();
    if (guaranteedHigh) {
      return r < (weights.legendaire || 0.5) ? 'legendaire' : 'rare';
    }
    const wComm = weights.commun || 0;
    const wRare = weights.rare || 0;
    if (r < wComm) return 'commun';
    if (r < wComm + wRare) return 'rare';
    return 'legendaire';
  }

  /* ---- Placed Level Decorations ---- */
  getDecorations(levelKey) {
    const list = this.data.decorations[levelKey];
    return Array.isArray(list) ? list.map((d) => ({ ...d })) : [];
  }

  saveDecorations(levelKey, items) {
    this.data.decorations[levelKey] = items.map((d) => ({
      uid: d.uid,
      itemId: d.itemId,
      x: Math.round(d.x * 100) / 100,
      z: Math.round(d.z * 100) / 100,
      rotY: Math.round(d.rotY * 1000) / 1000,
    }));
    this._persist();
  }
}
