/**
 * Workd Builder — Overhauled Boutique Modal & Animated 3-Tier Loot Box Controller
 * Manages the 3 Shop sub-tabs ("Meubles", "Améliorations", "Trésors • Bientôt"),
 * Dual Currency display ("Éclats d'Architecte" & "Pièces d'Or"),
 * Sélection du Jour (PROMO deals), Catalogue Classique (12 transparent PNGs),
 * and choreographed Loot Box Opening Animations (Classique, Royal, Légendaire).
 */

import * as THREE from 'three';
import {
  FURNITURE_CATALOG,
  LOOT_BOXES,
  RARITY_META,
  SHOP_CATALOG,
} from './saveManager.js';
import {
  createFurniture3D,
  updateFurniture3D,
  disposeFurniture3DInstance,
} from './furnitureModels.js';

function triggerTactileBounce(el) {
  if (!el) return;
  el.classList.remove('is-bouncing');
  void el.offsetWidth;
  el.classList.add('is-bouncing');
  setTimeout(() => el.classList.remove('is-bouncing'), 320);
}

/**
 * Generates a stylized SVG chest illustration tailored to each Loot Box tier
 * with separate lid, body, and lock elements for multi-stage CSS choreography.
 */
function buildChestMarkup(tier) {
  if (tier === 'classic') {
    return `
      <div class="chest-rig chest-rig--classic">
        <div class="chest-dust chest-dust--left"></div>
        <div class="chest-dust chest-dust--right"></div>
        <div class="chest-sparkles"></div>
        <div class="chest-lid">
          <div class="chest-band"></div>
          <div class="chest-latch"></div>
        </div>
        <div class="chest-body">
          <div class="chest-band"></div>
          <div class="chest-wood-grain"></div>
          <div class="chest-keyhole"></div>
        </div>
      </div>
    `;
  }

  if (tier === 'royal') {
    return `
      <div class="chest-rig chest-rig--royal">
        <div class="royal-vortex"></div>
        <div class="royal-beam"></div>
        <div class="chest-lock chest-lock--left">🔒</div>
        <div class="chest-lock chest-lock--right">🔒</div>
        <div class="chest-lid">
          <div class="chest-gem chest-gem--sapphire"></div>
          <div class="chest-band"></div>
        </div>
        <div class="chest-body">
          <div class="chest-band"></div>
          <div class="chest-trim-royal"></div>
          <div class="chest-keyhole"></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="chest-rig chest-rig--legendary">
      <div class="legendary-runes">
        <span>☥</span><span>☀</span><span>✦</span><span>☥</span><span>☀</span><span>✦</span>
      </div>
      <div class="legendary-rays"></div>
      <div class="legendary-starburst"></div>
      <div class="chest-lid">
        <div class="chest-sun-crest">☀</div>
        <div class="chest-band"></div>
      </div>
      <div class="chest-body">
        <div class="chest-band"></div>
        <div class="chest-temple-relief"></div>
        <div class="chest-keyhole"></div>
      </div>
    </div>
  `;
}

export class ShopController {
  constructor({ audio, save, onBalanceChange }) {
    this.audio = audio;
    this.save = save;
    this.onBalanceChange = onBalanceChange;

    this.activeTab = 'meubles'; // 'meubles' | 'ameliorations' | 'tresors'
    this.lootTimers = [];
    this.isOpeningBox = false;

    // Modal DOM
    this.modal = document.getElementById('shop-modal');
    this.backdrop = document.getElementById('shop-backdrop');
    this.closeBtn = document.getElementById('shop-close-btn');
    this.coinsVal = document.getElementById('shop-coins-val');
    this.tokensVal = document.getElementById('shop-tokens-val');
    this.tabButtons = Array.from(document.querySelectorAll('.shop-tab-btn'));
    this.contentEl = document.getElementById('shop-tab-content');

    // Full-screen Loot Box Opening Stage DOM
    this.lootStage = document.getElementById('lootbox-stage');
    this.lootCard = document.getElementById('lootbox-stage-card');
    this.lootTitle = document.getElementById('lootbox-stage-title');
    this.lootArena = document.getElementById('lootbox-arena');
    this.lootRewardsEl = document.getElementById('lootbox-rewards');
    this.lootCoinsBadge = document.getElementById('lootbox-coins-badge');
    this.lootClaimBtn = document.getElementById('lootbox-claim-btn');

    // Interactive 3D Turntable Preview Modal DOM & dedicated lazy mini-WebGL state
    this.previewModal = document.getElementById('furniture-preview-modal');
    this.previewBackdrop = document.getElementById('preview-backdrop');
    this.previewCloseBtn = document.getElementById('preview-close-btn');
    this.previewCanvas = document.getElementById('preview-3d-canvas');
    this.previewItemName = document.getElementById('preview-item-name');
    this.previewItemRarity = document.getElementById('preview-item-rarity');
    this.previewItemImg = document.getElementById('preview-item-img');
    this.previewBuyBtn = document.getElementById('preview-buy-btn');

    this._previewAssetKey = {}; // Dedicated WebGL context asset cache key
    this._previewRenderer = null;
    this._previewScene = null;
    this._previewCamera = null;
    this._previewTurntable = null;
    this._previewModel = null;
    this._previewRafId = null;
    this._previewLastTime = 0;
    this._previewElapsed = 0;
    this._previewDragging = false;
    this._previewDragX = 0;
    this._previewCurrentItem = null;
    this._previewUsePromo = false;

    this._bindEvents();
    this.refreshBalances();
    this.render();
  }

  _bindEvents() {
    this.closeBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playWoodCardTap();
      this.close();
    });

    this.backdrop.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playWoodCardTap();
      this.close();
    });

    this.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.shopTab;
        if (!nextTab) return;
        this.audio.unlock();
        this.audio.playTabBounce();
        triggerTactileBounce(btn);
        this.activeTab = nextTab;
        this._syncTabActiveStates();
        this.render();
      });
    });

    this.lootClaimBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playCoinClink();
      this.closeLootStage();
    });

    if (this.previewCloseBtn) {
      this.previewCloseBtn.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playTabBounce();
        this.closePreview();
      });
    }
    if (this.previewBackdrop) {
      this.previewBackdrop.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playTabBounce();
        this.closePreview();
      });
    }
    if (this.previewBuyBtn) {
      this.previewBuyBtn.addEventListener('click', () => {
        if (!this._previewCurrentItem) return;
        this.audio.unlock();
        const res = this.save.purchaseFurniture(this._previewCurrentItem.id, this._previewUsePromo);
        if (res.ok) {
          this.audio.playCoinClink();
          triggerTactileBounce(this.previewBuyBtn);
          this.refreshBalances();
          this.render();
          this._syncPreviewBuyButton();
        } else {
          this.audio.playMapTap(true);
        }
      });
    }
    if (this.previewCanvas) {
      this.previewCanvas.addEventListener('pointerdown', (e) => {
        this._previewDragging = true;
        this._previewDragX = e.clientX;
        try {
          this.previewCanvas.setPointerCapture(e.pointerId);
        } catch (_) {
          // Ignore unsupported capture
        }
      });
      this.previewCanvas.addEventListener('pointermove', (e) => {
        if (!this._previewDragging || !this._previewTurntable) return;
        const dx = e.clientX - this._previewDragX;
        this._previewDragX = e.clientX;
        this._previewTurntable.rotation.y += dx * 0.015;
      });
      const stopDrag = () => {
        this._previewDragging = false;
      };
      this.previewCanvas.addEventListener('pointerup', stopDrag);
      this.previewCanvas.addEventListener('pointercancel', stopDrag);
    }
  }

  _syncTabActiveStates() {
    this.tabButtons.forEach((btn) => {
      const active = btn.dataset.shopTab === this.activeTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  refreshBalances() {
    if (this.coinsVal) this.coinsVal.textContent = `${this.save.getCoins()} Or`;
    if (this.tokensVal) this.tokensVal.textContent = `${this.save.getTokens()} Éclats`;
    if (this.onBalanceChange) this.onBalanceChange();
  }

  open(initialTab = 'meubles') {
    this.activeTab = initialTab;
    this._syncTabActiveStates();
    this.refreshBalances();
    this.render();
    this.modal.hidden = false;
    requestAnimationFrame(() => {
      this.modal.classList.add('is-visible');
    });
  }

  close() {
    this.closePreview();
    this.closeLootStage();
    this.modal.classList.remove('is-visible');
    this.modal.hidden = true;
  }

  render() {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = '';
    this.contentEl.scrollTop = 0;

    if (this.activeTab === 'meubles') {
      this._renderMeublesTab();
    } else if (this.activeTab === 'ameliorations') {
      this._renderAmeliorationsTab();
    } else {
      this._renderTresorsSoonTab();
    }
  }

  /* ============================================================================
   * TAB 1: MEUBLES (Sélection du Jour + Coffres Mystères + Catalogue Classique)
   * ========================================================================== */
  _renderMeublesTab() {
    const tokens = this.save.getTokens();
    const dailyDeals = this.save.getDailyDeals();

    // 1. Sélection du Jour (3 PROMO bargains at 15–25 Éclats)
    const dealsSection = document.createElement('section');
    dealsSection.className = 'shop-section';
    dealsSection.innerHTML = `
      <div class="shop-section-head">
        <h2 class="shop-section-title">✨ Sélection du Jour</h2>
        <span class="shop-section-tag">PROMO</span>
      </div>
    `;
    const dealsRow = document.createElement('div');
    dealsRow.className = 'deals-grid';

    dailyDeals.forEach((item) => {
      const owned = this.save.hasFurniture(item.id);
      const promoPrice = item.promoPrice ?? item.price;
      const canAfford = tokens >= promoPrice;
      const rarity = RARITY_META[item.rarity] || RARITY_META.commun;

      const card = document.createElement('div');
      card.className = `furniture-card furniture-card--deal${owned ? ' is-owned' : ''}`;
      card.dataset.rarity = item.rarity;
      card.dataset.previewItemId = item.id;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      card.innerHTML = `
        <span class="promo-ribbon">PROMO</span>
        <span class="preview-3d-chip" aria-hidden="true">3D</span>
        <div class="furniture-thumb">
          <img src="${item.img}" alt="${item.name}" loading="lazy" />
        </div>
        <div class="furniture-name">${item.name}</div>
        <span class="rarity-badge rarity-badge--${item.rarity}" style="--rarity-color:${rarity.color}">
          ${rarity.label}
        </span>
      `;

      card.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playTabBounce();
        this.openPreview(item, true);
      });

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = `furniture-buy-btn${owned ? ' is-owned' : ''}`;
      buyBtn.dataset.furnitureDealId = item.id;
      buyBtn.disabled = owned || !canAfford;
      buyBtn.innerHTML = owned
        ? 'Possédé ✓'
        : `<span class="price-old">${item.price}</span> 💠 ${promoPrice}`;

      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (owned) return;
        this.audio.unlock();
        const res = this.save.purchaseFurniture(item.id, true);
        if (res.ok) {
          this.audio.playCoinClink();
          triggerTactileBounce(card);
          this.refreshBalances();
          this.render();
        } else {
          this.audio.playMapTap(true);
        }
      });

      card.appendChild(buyBtn);
      dealsRow.appendChild(card);
    });
    dealsSection.appendChild(dealsRow);
    this.contentEl.appendChild(dealsSection);

    // 2. Coffres Mystères (3 Animated Loot Boxes)
    const boxesSection = document.createElement('section');
    boxesSection.className = 'shop-section';
    boxesSection.innerHTML = `
      <div class="shop-section-head">
        <h2 class="shop-section-title">🎁 Coffres Mystères</h2>
        <span class="shop-section-sub">Meubles + Bonus Or</span>
      </div>
    `;
    const boxesGrid = document.createElement('div');
    boxesGrid.className = 'lootbox-grid';

    LOOT_BOXES.forEach((box) => {
      const canAfford = tokens >= box.price;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `lootbox-card lootbox-card--${box.id}`;
      card.dataset.lootboxId = box.id;
      card.disabled = !canAfford || this.isOpeningBox;

      card.innerHTML = `
        <span class="lootbox-emblem" aria-hidden="true">${box.badge}</span>
        <span class="lootbox-info">
          <span class="lootbox-name">${box.name}</span>
          <span class="lootbox-desc">${box.subtitle}</span>
        </span>
        <span class="lootbox-price-pill">💠 ${box.price}</span>
      `;

      card.addEventListener('click', () => {
        if (this.isOpeningBox) return;
        this.audio.unlock();
        triggerTactileBounce(card);
        const result = this.save.openLootBox(box.id);
        if (!result.ok) {
          this.audio.playMapTap(true);
          return;
        }
        this.refreshBalances();
        this.render();
        this._playLootBoxSequence(result);
      });

      boxesGrid.appendChild(card);
    });
    boxesSection.appendChild(boxesGrid);
    this.contentEl.appendChild(boxesSection);

    // 3. Catalogue Classique (All 12 transparent PNG furniture items — tap any card for live 3D preview)
    const ownedCount = this.save.getUnlockedFurniture().length;
    const catSection = document.createElement('section');
    catSection.className = 'shop-section';
    catSection.innerHTML = `
      <div class="shop-section-head">
        <h2 class="shop-section-title">🪑 Catalogue Classique</h2>
        <span class="shop-section-sub">${ownedCount} / ${FURNITURE_CATALOG.length} débloqués</span>
      </div>
    `;
    const catGrid = document.createElement('div');
    catGrid.className = 'catalog-grid';

    FURNITURE_CATALOG.forEach((item) => {
      const owned = this.save.hasFurniture(item.id);
      const canAfford = tokens >= item.price;
      const rarity = RARITY_META[item.rarity] || RARITY_META.commun;

      const card = document.createElement('div');
      card.className = `furniture-card${owned ? ' is-owned' : ''}`;
      card.dataset.rarity = item.rarity;
      card.dataset.previewCatalogId = item.id;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML = `
        <span class="preview-3d-chip" aria-hidden="true">3D</span>
        <div class="furniture-thumb">
          <img src="${item.img}" alt="${item.name}" loading="lazy" />
        </div>
        <div class="furniture-name">${item.name}</div>
        <span class="rarity-badge rarity-badge--${item.rarity}" style="--rarity-color:${rarity.color}">
          ${rarity.label}
        </span>
      `;

      card.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playTabBounce();
        this.openPreview(item, false);
      });

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = `furniture-buy-btn${owned ? ' is-owned' : ''}`;
      buyBtn.dataset.furnitureId = item.id;
      buyBtn.disabled = owned || !canAfford;
      buyBtn.textContent = owned ? 'Possédé ✓' : `💠 ${item.price} Éclats`;

      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (owned) return;
        this.audio.unlock();
        const res = this.save.purchaseFurniture(item.id, false);
        if (res.ok) {
          this.audio.playCoinClink();
          triggerTactileBounce(card);
          this.refreshBalances();
          this.render();
        } else {
          this.audio.playMapTap(true);
        }
      });

      card.appendChild(buyBtn);
      catGrid.appendChild(card);
    });

    catSection.appendChild(catGrid);
    this.contentEl.appendChild(catSection);
  }

  /* ============================================================================
   * TAB 2: AMÉLIORATIONS (Gold Coin Tool & Sled Upgrades)
   * ========================================================================== */
  _renderAmeliorationsTab() {
    const coins = this.save.getCoins();
    const list = document.createElement('div');
    list.className = 'shop-upgrades-list';

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
      actionBtn.textContent = owned ? 'Équipé ✓' : `🪙 ${item.price} Or`;

      if (!owned) {
        actionBtn.addEventListener('click', () => {
          this.audio.unlock();
          const res = this.save.purchaseUpgrade(item.id);
          if (res.ok) {
            this.audio.playCoinClink();
            triggerTactileBounce(row);
            this.refreshBalances();
            this.render();
          } else {
            this.audio.playMapTap(true);
          }
        });
      }

      row.appendChild(iconEl);
      row.appendChild(info);
      row.appendChild(actionBtn);
      list.appendChild(row);
    });

    this.contentEl.appendChild(list);
  }

  /* ============================================================================
   * TAB 3: TRÉSORS • BIENTÔT (Upcoming Gold Coin Vault)
   * ========================================================================== */
  _renderTresorsSoonTab() {
    const wrap = document.createElement('div');
    wrap.className = 'tresors-soon-panel';
    wrap.innerHTML = `
      <div class="tresors-soon-emblem">🏺✨👑</div>
      <h3 class="tresors-soon-title">Trésors des Civilisations</h3>
      <p class="tresors-soon-desc">
        Conservez vos <strong>Pièces d'Or</strong> ! Reliques de Rome, lanternes célestes de Chine
        et statues monumentales arrivent très bientôt dans le Coffre des Trésors.
      </p>
      <div class="tresors-soon-pill">⏳ Ouverture prochaine</div>
    `;
    this.contentEl.appendChild(wrap);
  }

  /* ============================================================================
   * MULTI-STAGE LOOT BOX OPENING ANIMATION SEQUENCES
   * ========================================================================== */
  _clearLootTimers() {
    this.lootTimers.forEach((id) => clearTimeout(id));
    this.lootTimers = [];
  }

  _scheduleLoot(ms, fn) {
    const id = setTimeout(fn, ms);
    this.lootTimers.push(id);
  }

  closeLootStage() {
    this._clearLootTimers();
    this.isOpeningBox = false;
    if (!this.lootStage) return;
    this.lootStage.classList.remove('is-visible', 'is-shaking');
    this.lootStage.dataset.tier = '';
    this.lootStage.dataset.phase = '';
    this.lootStage.hidden = true;
    this.render();
  }

  _playLootBoxSequence(result) {
    this._clearLootTimers();
    this.isOpeningBox = true;

    const { box, rewards, totalCoinsGained, duplicateCoins } = result;
    const tier = box.id; // 'classic' | 'royal' | 'legendary'

    this.lootStage.dataset.tier = tier;
    this.lootStage.dataset.phase = 'drop';
    this.lootStage.classList.remove('is-shaking');
    this.lootTitle.textContent = box.name;
    this.lootArena.innerHTML = buildChestMarkup(tier);
    this.lootRewardsEl.innerHTML = '';
    this.lootRewardsEl.classList.remove('is-revealed');
    this.lootCoinsBadge.hidden = true;
    this.lootClaimBtn.hidden = true;

    // Pre-build reward cards (hidden until reveal phase)
    rewards.forEach((entry, idx) => {
      const rarity = RARITY_META[entry.item.rarity] || RARITY_META.commun;
      const card = document.createElement('div');
      card.className = `loot-reward-card loot-reward-card--${entry.item.rarity}`;
      card.style.setProperty('--reveal-delay', `${idx * 170}ms`);
      card.style.setProperty('--rarity-glow', rarity.glow);
      card.innerHTML = `
        <span class="loot-reward-tag">${entry.isNew ? 'NOUVEAU !' : `+${entry.duplicateBonus} Or`}</span>
        <div class="loot-reward-img-wrap">
          <img src="${entry.item.img}" alt="${entry.item.name}" />
        </div>
        <div class="loot-reward-name">${entry.item.name}</div>
        <span class="rarity-badge rarity-badge--${entry.item.rarity}" style="--rarity-color:${rarity.color}">
          ${rarity.label}
        </span>
      `;
      this.lootRewardsEl.appendChild(card);
    });

    const coinSummary =
      duplicateCoins > 0
        ? `🪙 +${totalCoinsGained} Pièces d'Or (dont +${duplicateCoins} doublons)`
        : `🪙 +${totalCoinsGained} Pièces d'Or bonus !`;
    this.lootCoinsBadge.textContent = coinSummary;

    this.lootStage.hidden = false;
    requestAnimationFrame(() => {
      this.lootStage.classList.add('is-visible');
    });

    // Stage 1: Drop in
    this._scheduleLoot(120, () => {
      this.audio.playLootDrop(tier);
      if (tier === 'legendary') {
        this.lootStage.classList.add('is-shaking');
        this._scheduleLoot(280, () => this.lootStage.classList.remove('is-shaking'));
      }
    });

    if (tier === 'classic') {
      // Stage 2: 2 wooden shakes with dust puffs
      this._scheduleLoot(420, () => {
        this.lootStage.dataset.phase = 'anticipation';
        this.audio.playLootShake(false);
      });
      this._scheduleLoot(720, () => {
        this.audio.playLootShake(false);
      });
      // Stage 3: Lid pop + sparkles + card reveal
      this._scheduleLoot(1040, () => {
        this._enterRevealPhase(tier);
      });
    } else if (tier === 'royal') {
      // Stage 2: Swirling turquoise wind vortex + 2 sequential metallic lock snaps
      this._scheduleLoot(460, () => {
        this.lootStage.dataset.phase = 'anticipation';
        this.audio.playLootShake(true);
      });
      this._scheduleLoot(820, () => {
        this.lootStage.dataset.phase = 'anticipation-2';
        this.audio.playLootShake(true);
      });
      // Stage 3: Blue-gold vertical light beam + dual card flip
      this._scheduleLoot(1180, () => {
        this._enterRevealPhase(tier);
      });
    } else {
      // 'legendary': Runes ignite -> levitate & spin with sunbeams -> starburst + 3 sequential cards
      this._scheduleLoot(480, () => {
        this.lootStage.dataset.phase = 'anticipation';
        this.audio.playLootShake(true);
      });
      this._scheduleLoot(880, () => {
        this.lootStage.dataset.phase = 'levitate';
        this.audio.playLootShake(true);
      });
      this._scheduleLoot(1420, () => {
        this.lootStage.classList.add('is-shaking');
        this._scheduleLoot(320, () => this.lootStage.classList.remove('is-shaking'));
        this._enterRevealPhase(tier);
      });
    }
  }

  _enterRevealPhase(tier) {
    this.lootStage.dataset.phase = 'open';
    this.audio.playLootOpen(tier);

    this._scheduleLoot(160, () => {
      this.lootRewardsEl.classList.add('is-revealed');
    });

    const claimDelay = tier === 'legendary' ? 680 : tier === 'royal' ? 520 : 380;
    this._scheduleLoot(claimDelay, () => {
      this.lootCoinsBadge.hidden = false;
      this.lootClaimBtn.hidden = false;
    });
  }

  /* ============================================================================
   * INTERACTIVE 3D FURNITURE TURNTABLE PREVIEW (Lazy Mini-WebGL Pedestal)
   * ========================================================================== */
  _ensurePreviewRenderer() {
    if (this._previewRenderer || !this.previewCanvas) return;

    const w = 310;
    const h = 230;
    this._previewRenderer = new THREE.WebGLRenderer({
      canvas: this.previewCanvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this._previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this._previewRenderer.setSize(w, h, false);
    this._previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this._previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._previewRenderer.toneMappingExposure = 1.12;
    this._previewRenderer.shadowMap.enabled = true;
    this._previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this._previewScene = new THREE.Scene();

    this._previewCamera = new THREE.PerspectiveCamera(34, w / h, 0.2, 30);
    this._previewCamera.position.set(0, 1.85, 3.25);
    this._previewCamera.lookAt(0, 0.56, 0);

    // Warm studio diorama lighting
    const hemi = new THREE.HemisphereLight('#fff8eb', '#a67442', 1.15);
    this._previewScene.add(hemi);

    const key = new THREE.DirectionalLight('#fff2d4', 2.2);
    key.position.set(-2.6, 4.5, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 2;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.001;
    this._previewScene.add(key);

    const rim = new THREE.DirectionalLight('#7ad8ec', 0.65);
    rim.position.set(3.2, 2.0, -2.6);
    this._previewScene.add(rim);

    // Carved circular golden-sandstone turntable pedestal
    this._previewTurntable = new THREE.Group();
    const baseGeo = new THREE.CylinderGeometry(0.96, 1.08, 0.16, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: '#d8b478',
      roughness: 0.72,
      metalness: 0.08,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.08;
    baseMesh.receiveShadow = true;
    this._previewTurntable.add(baseMesh);

    const trimGeo = new THREE.TorusGeometry(0.98, 0.032, 10, 36);
    trimGeo.rotateX(Math.PI / 2);
    const trimMat = new THREE.MeshStandardMaterial({
      color: '#f7ca59',
      roughness: 0.28,
      metalness: 0.85,
    });
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.y = -0.005;
    this._previewTurntable.add(trimMesh);

    this._previewScene.add(this._previewTurntable);
    this._tickPreview = this._tickPreview.bind(this);
  }

  openPreview(item, usePromo = false) {
    if (!this.previewModal || !item) return;
    this._previewCurrentItem = item;
    this._previewUsePromo = Boolean(usePromo && typeof item.promoPrice === 'number');

    const rarity = RARITY_META[item.rarity] || RARITY_META.commun;
    if (this.previewItemName) this.previewItemName.textContent = item.name;
    if (this.previewItemRarity) {
      this.previewItemRarity.textContent = rarity.label;
      this.previewItemRarity.style.setProperty('--rarity-color', rarity.color);
    }
    if (this.previewItemImg) {
      this.previewItemImg.src = item.img;
      this.previewItemImg.alt = item.name;
    }
    this._syncPreviewBuyButton();

    this._ensurePreviewRenderer();

    // Swap active 3D model on the turntable cleanly
    if (this._previewModel && this._previewTurntable) {
      this._previewTurntable.remove(this._previewModel);
      disposeFurniture3DInstance(this._previewModel);
      this._previewModel = null;
    }
    if (this._previewTurntable) {
      this._previewModel = createFurniture3D(item.id, this._previewAssetKey);
      this._previewTurntable.rotation.y = 0.45;
      this._previewTurntable.add(this._previewModel);
    }

    this.previewModal.hidden = false;
    requestAnimationFrame(() => {
      this.previewModal.classList.add('is-visible');
    });

    if (!this._previewRafId && this._previewRenderer) {
      this._previewLastTime = performance.now();
      this._previewRafId = requestAnimationFrame(this._tickPreview);
    }
  }

  closePreview() {
    if (this._previewRafId) {
      cancelAnimationFrame(this._previewRafId);
      this._previewRafId = null;
    }
    if (this._previewModel && this._previewTurntable) {
      this._previewTurntable.remove(this._previewModel);
      disposeFurniture3DInstance(this._previewModel);
      this._previewModel = null;
    }
    this._previewCurrentItem = null;
    if (this.previewModal) {
      this.previewModal.classList.remove('is-visible');
      this.previewModal.hidden = true;
    }
  }

  _syncPreviewBuyButton() {
    if (!this.previewBuyBtn || !this._previewCurrentItem) return;
    const item = this._previewCurrentItem;
    const owned = this.save.hasFurniture(item.id);
    const cost = this._previewUsePromo && typeof item.promoPrice === 'number' ? item.promoPrice : item.price;
    const canAfford = this.save.getTokens() >= cost;

    this.previewBuyBtn.classList.toggle('is-owned', owned);
    this.previewBuyBtn.disabled = owned || !canAfford;
    if (owned) {
      this.previewBuyBtn.textContent = 'Possédé ✓';
    } else if (this._previewUsePromo) {
      this.previewBuyBtn.textContent = `PROMO • 💠 ${cost} Éclats`;
    } else {
      this.previewBuyBtn.textContent = `Acheter • 💠 ${cost} Éclats`;
    }
  }

  _tickPreview(now) {
    this._previewRafId = requestAnimationFrame(this._tickPreview);
    const dt = Math.min(Math.max((now - this._previewLastTime) / 1000, 0.001), 0.05);
    this._previewLastTime = now;
    this._previewElapsed += dt;

    if (this._previewTurntable && !this._previewDragging) {
      this._previewTurntable.rotation.y += dt * 0.68;
    }
    if (this._previewModel) {
      updateFurniture3D(this._previewModel, dt, this._previewElapsed);
    }
    if (this._previewRenderer && this._previewScene && this._previewCamera) {
      this._previewRenderer.render(this._previewScene, this._previewCamera);
    }
  }
}
