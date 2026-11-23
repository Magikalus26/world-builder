/**
 * Workd Builder — Main Menu, Persistent Save System & Mobile Shop Controller
 * Manages localStorage ("workd_builder_save"), the 3-card carved wood & gold bottom dock
 * (BOUTIQUE • SÉLECTION DE NIVEAU • ROGUELIKE), and the tactile upgrade Shop modal.
 */

const SAVE_KEY = 'workd_builder_save';

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

function createDefaultSave() {
  return {
    coins: 100,
    upgrades: {
      golden_chisel: false,
      reinforced_sled: false,
      royal_gold_stone: false,
      pyramidion_aura: false,
    },
    stats: {
      levelsCompleted: 0,
      roguelikeCompleted: 0,
    },
  };
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
      return {
        coins: typeof parsed.coins === 'number' && Number.isFinite(parsed.coins) ? Math.max(0, Math.floor(parsed.coins)) : fallback.coins,
        upgrades: { ...fallback.upgrades, ...(parsed.upgrades || {}) },
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

  getCoins() {
    return this.data.coins;
  }

  getUpgrades() {
    return { ...this.data.upgrades };
  }

  hasUpgrade(id) {
    return Boolean(this.data.upgrades[id]);
  }

  addCoins(amount, mode = 'level') {
    const gain = Math.max(0, Math.floor(amount));
    this.data.coins += gain;
    if (mode === 'roguelike') {
      this.data.stats.roguelikeCompleted += 1;
    } else {
      this.data.stats.levelsCompleted += 1;
    }
    this._persist();
    return this.data.coins;
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
}

export class MainMenuController {
  constructor({ audio, save, onOpenWorldMap, onStartRoguelike }) {
    this.audio = audio;
    this.save = save;
    this.onOpenWorldMap = onOpenWorldMap;
    this.onStartRoguelike = onStartRoguelike;

    // Menu root & 3 tactile bottom dock cards
    this.menuOverlay = document.getElementById('main-menu-overlay');
    this.menuCoinsVal = document.getElementById('menu-coins-val');
    this.btnShop = document.getElementById('menu-card-shop');
    this.btnLevels = document.getElementById('menu-card-levels');
    this.btnRoguelike = document.getElementById('menu-card-roguelike');

    // Tactile Shop modal elements
    this.shopModal = document.getElementById('shop-modal');
    this.shopBackdrop = document.getElementById('shop-backdrop');
    this.shopCloseBtn = document.getElementById('shop-close-btn');
    this.shopCoinsVal = document.getElementById('shop-coins-val');
    this.shopItemsList = document.getElementById('shop-items-list');

    // Also sync World Map coin pill if present
    this.mapCoinsVal = document.getElementById('map-coins-val');

    this._bindEvents();
    this.refreshCoins();
    this.renderShop();
  }

  _bindEvents() {
    this.btnShop.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playWoodCardTap();
      this.openShop();
    });

    this.btnLevels.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playWoodCardTap();
      this.audio.playCameraWhoosh();
      this.closeShop();
      if (this.onOpenWorldMap) this.onOpenWorldMap();
    });

    this.btnRoguelike.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playDiceChime();
      this.closeShop();
      if (this.onStartRoguelike) this.onStartRoguelike();
    });

    this.shopCloseBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playWoodCardTap();
      this.closeShop();
    });

    this.shopBackdrop.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playWoodCardTap();
      this.closeShop();
    });
  }

  show() {
    this.refreshCoins();
    this.menuOverlay.hidden = false;
    requestAnimationFrame(() => {
      this.menuOverlay.classList.add('is-visible');
    });
  }

  hide() {
    this.closeShop();
    this.menuOverlay.classList.remove('is-visible');
    this.menuOverlay.hidden = true;
  }

  refreshCoins() {
    const coins = this.save.getCoins();
    if (this.menuCoinsVal) this.menuCoinsVal.textContent = `${coins} Or`;
    if (this.shopCoinsVal) this.shopCoinsVal.textContent = `${coins} Or`;
    if (this.mapCoinsVal) this.mapCoinsVal.textContent = `${coins} Or`;
  }

  openShop() {
    this.refreshCoins();
    this.renderShop();
    this.shopModal.hidden = false;
    requestAnimationFrame(() => {
      this.shopModal.classList.add('is-visible');
    });
  }

  closeShop() {
    this.shopModal.classList.remove('is-visible');
    this.shopModal.hidden = true;
  }

  renderShop() {
    if (!this.shopItemsList) return;
    const coins = this.save.getCoins();
    this.shopItemsList.innerHTML = '';

    SHOP_CATALOG.forEach((item) => {
      const owned = this.save.hasUpgrade(item.id);
      const canAfford = coins >= item.price;

      const row = document.createElement('div');
      row.className = `shop-item${owned ? ' is-owned' : ''}`;

      const iconEl = document.createElement('div');
      iconEl.className = 'shop-item-icon';
      iconEl.textContent = item.badge;

      const info = document.createElement('div');
      info.className = 'shop-item-info';

      const title = document.createElement('div');
      title.className = 'shop-item-name';
      title.textContent = item.name;

      const desc = document.createElement('div');
      desc.className = 'shop-item-desc';
      desc.textContent = item.desc;

      info.appendChild(title);
      info.appendChild(desc);

      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = `shop-buy-btn${owned ? ' is-owned' : ''}`;
      actionBtn.dataset.upgradeId = item.id;
      actionBtn.disabled = owned || !canAfford;
      actionBtn.textContent = owned ? 'Équipé ✓' : `${item.price} Or`;

      if (!owned) {
        actionBtn.addEventListener('click', () => {
          this.audio.unlock();
          const res = this.save.purchaseUpgrade(item.id);
          if (res.ok) {
            this.audio.playCoinClink();
            this.refreshCoins();
            this.renderShop();
          } else {
            this.audio.playMapTap(true);
          }
        });
      }

      row.appendChild(iconEl);
      row.appendChild(info);
      row.appendChild(actionBtn);
      this.shopItemsList.appendChild(row);
    });
  }
}
