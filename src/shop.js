/**
 * Workd Builder — Overhauled Boutique Modal & Animated 3-Tier Loot Box Controller
 * Manages the 3 Shop sub-tabs ("Meubles", "Améliorations", "Trésors • Bientôt"),
 * Dual Currency display ("Éclats d'Architecte" & "Pièces d'Or"),
 * Sélection du Jour (PROMO deals), Catalogue Classique (12 transparent PNGs),
 * and choreographed Loot Box Opening Animations (Classique, Royal, Légendaire).
 */

import {
  FURNITURE_CATALOG,
  LOOT_BOXES,
  RARITY_META,
  SHOP_CATALOG,
} from './saveManager.js';

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

      card.innerHTML = `
        <span class="promo-ribbon">PROMO</span>
        <div class="furniture-thumb">
          <img src="${item.img}" alt="${item.name}" loading="lazy" />
        </div>
        <div class="furniture-name">${item.name}</div>
        <span class="rarity-badge rarity-badge--${item.rarity}" style="--rarity-color:${rarity.color}">
          ${rarity.label}
        </span>
      `;

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = `furniture-buy-btn${owned ? ' is-owned' : ''}`;
      buyBtn.dataset.furnitureDealId = item.id;
      buyBtn.disabled = owned || !canAfford;
      buyBtn.innerHTML = owned
        ? 'Possédé ✓'
        : `<span class="price-old">${item.price}</span> 💠 ${promoPrice}`;

      if (!owned) {
        buyBtn.addEventListener('click', () => {
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
      }

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

    // 3. Catalogue Classique (All 12 transparent PNG furniture items)
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
      card.innerHTML = `
        <div class="furniture-thumb">
          <img src="${item.img}" alt="${item.name}" loading="lazy" />
        </div>
        <div class="furniture-name">${item.name}</div>
        <span class="rarity-badge rarity-badge--${item.rarity}" style="--rarity-color:${rarity.color}">
          ${rarity.label}
        </span>
      `;

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = `furniture-buy-btn${owned ? ' is-owned' : ''}`;
      buyBtn.dataset.furnitureId = item.id;
      buyBtn.disabled = owned || !canAfford;
      buyBtn.textContent = owned ? 'Possédé ✓' : `💠 ${item.price} Éclats`;

      if (!owned) {
        buyBtn.addEventListener('click', () => {
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
      }

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
}
