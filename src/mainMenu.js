/**
 * Workd Builder — Main Menu Controller
 * Manages the 3-card carved wood & gold bottom dock (BOUTIQUE • SÉLECTION DE NIVEAU • ROGUELIKE),
 * tactile spring-bounce + golden rim flash feedback, and dual-currency HUD sync.
 */

export { SaveManager, SHOP_CATALOG } from './saveManager.js';

function triggerCardBounceFlash(cardEl) {
  if (!cardEl) return;
  cardEl.classList.remove('is-bouncing', 'is-gold-flash');
  void cardEl.offsetWidth;
  cardEl.classList.add('is-bouncing', 'is-gold-flash');
  setTimeout(() => {
    cardEl.classList.remove('is-bouncing', 'is-gold-flash');
  }, 360);
}

export class MainMenuController {
  constructor({ audio, save, shop, onOpenWorldMap, onStartRoguelike }) {
    this.audio = audio;
    this.save = save;
    this.shop = shop;
    this.onOpenWorldMap = onOpenWorldMap;
    this.onStartRoguelike = onStartRoguelike;

    // Menu root & 3 tactile bottom dock cards
    this.menuOverlay = document.getElementById('main-menu-overlay');
    this.menuCoinsVal = document.getElementById('menu-coins-val');
    this.menuTokensVal = document.getElementById('menu-tokens-val');
    this.btnShop = document.getElementById('menu-card-shop');
    this.btnLevels = document.getElementById('menu-card-levels');
    this.btnRoguelike = document.getElementById('menu-card-roguelike');

    // World Map dual currency pills
    this.mapCoinsVal = document.getElementById('map-coins-val');
    this.mapTokensVal = document.getElementById('map-tokens-val');

    this._bindEvents();
    this.refreshBalances();
  }

  _bindEvents() {
    this.btnShop.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playTabBounce();
      this.audio.playWoodCardTap();
      triggerCardBounceFlash(this.btnShop);
      this.openShop('meubles');
    });

    this.btnLevels.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playTabBounce();
      this.audio.playCameraWhoosh();
      triggerCardBounceFlash(this.btnLevels);
      this.closeShop();
      setTimeout(() => {
        if (this.onOpenWorldMap) this.onOpenWorldMap();
      }, 110);
    });

    this.btnRoguelike.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.playTabBounce();
      this.audio.playDiceChime();
      triggerCardBounceFlash(this.btnRoguelike);
      this.closeShop();
      setTimeout(() => {
        if (this.onStartRoguelike) this.onStartRoguelike();
      }, 120);
    });
  }

  show() {
    this.refreshBalances();
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

  refreshBalances() {
    const coins = this.save.getCoins();
    const tokens = this.save.getTokens();
    if (this.menuCoinsVal) this.menuCoinsVal.textContent = `${coins} Or`;
    if (this.menuTokensVal) this.menuTokensVal.textContent = `${tokens} Éclats`;
    if (this.mapCoinsVal) this.mapCoinsVal.textContent = `${coins}`;
    if (this.mapTokensVal) this.mapTokensVal.textContent = `${tokens}`;
  }

  // Backward-compatible alias
  refreshCoins() {
    this.refreshBalances();
  }

  openShop(tab = 'meubles') {
    if (this.shop) this.shop.open(tab);
  }

  closeShop() {
    if (this.shop) this.shop.close();
  }
}
