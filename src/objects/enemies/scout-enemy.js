import { ColliderComponent } from '../../components/collider/collider-component.js';
import { CUSTOM_EVENTS, EventBusComponent } from '../../components/events/event-bus-component.js';
import { HealthComponent } from '../../components/health/health-component.js';
import { BotScoutInputComponent } from '../../components/input/bot-scout-input-component.js';
import { HorizontalMovementComponent } from '../../components/movement/horizontal-movement-component.js';
import { VerticalMovementComponent } from '../../components/movement/vertical-movement-component.js';
import * as CONFIG from '../../config.js';

export class ScoutEnemy extends Phaser.GameObjects.Container {
  #isInitialized;
  #inputComponent;
  #horizontalMovementComponent;
  #verticalMovementComponent;
  #healthComponent;
  #colliderComponent;
  #eventBusComponent;
  #shipSprite;
  #shipEngineSprite;

  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   */
  constructor(scene, x, y) {
    super(scene, x, y, []);

    this.#isInitialized = false;
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);
    this.body.setSize(24, 24);
    this.body.setOffset(-12, -12);

    // track whether we've already applied the "escaped" penalty for this enemy
    this.hasEscapedPenaltyApplied = false;

    this.#shipSprite = scene.add.sprite(0, 0, 'scout', 0);
    this.#shipEngineSprite = scene.add.sprite(0, 0, 'scout_engine').setFlipY(true);
    this.#shipEngineSprite.play('scout_engine');
    this.add([this.#shipEngineSprite, this.#shipSprite]);

    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.once(
      Phaser.GameObjects.Events.DESTROY,
      () => {
        this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
      },
      this
    );
  }

  /** @type {ColliderComponent} */
  get colliderComponent() {
    return this.#colliderComponent;
  }

  /** @type {HealthComponent} */
  get healthComponent() {
    return this.#healthComponent;
  }

  /** @type {string} */
  get shipAssetKey() {
    return 'scout';
  }

  /** @type {string} */
  get shipDestroyedAnimationKey() {
    return 'scout_destroy';
  }

  /**
   * @param {EventBusComponent} eventBusComponent
   */
  init(eventBusComponent) {
    this.#eventBusComponent = eventBusComponent;
    this.#inputComponent = new BotScoutInputComponent(this);
    this.#horizontalMovementComponent = new HorizontalMovementComponent(
      this,
      this.#inputComponent,
      CONFIG.ENEMY_SCOUT_MOVEMENT_HORIZONTAL_VELOCITY
    );
    this.#verticalMovementComponent = new VerticalMovementComponent(
      this,
      this.#inputComponent,
      CONFIG.ENEMY_SCOUT_MOVEMENT_VERTICAL_VELOCITY
    );
    this.#healthComponent = new HealthComponent(CONFIG.ENEMY_SCOUT_HEALTH);
    this.#colliderComponent = new ColliderComponent(this.#healthComponent, this.#eventBusComponent);
    this.#eventBusComponent.emit(CUSTOM_EVENTS.ENEMY_INIT, this);
    this.#isInitialized = true;
  }

  /**
   * @returns {void}
   */
  reset() {
    this.setActive(true);
    this.setVisible(true);
    this.#healthComponent.reset();
    this.#inputComponent.startX = this.x;
    this.#verticalMovementComponent.reset();
    this.#horizontalMovementComponent.reset();

    // allow penalty again when this enemy is reused
    this.hasEscapedPenaltyApplied = false;
  }

  /**
   * @param {DOMHighResTimeStamp} ts
   * @param {number} dt
   * @returns {void}
   */
  update(ts, dt) {
    if (!this.#isInitialized) {
      return;
    }

    if (!this.active) {
      return;
    }

    if (this.#healthComponent.isDead) {
      this.setActive(false);
      this.setVisible(false);
      this.#eventBusComponent.emit(CUSTOM_EVENTS.ENEMY_DESTROYED, this);
      return;
    }

    this.#inputComponent.update();
    this.#horizontalMovementComponent.update();
    this.#verticalMovementComponent.update();

    // === escape detection: enemy has gone off the bottom of the screen ===
    const sceneHeight = this.scene.scale.height;

    if (!this.hasEscapedPenaltyApplied && this.y > sceneHeight + 40) {
      this.hasEscapedPenaltyApplied = true;

      /** @type {any} */
      const scene = this.scene;

      if (scene && typeof scene.registerEnemyEscape === 'function') {
        scene.registerEnemyEscape();
      }

      // deactivate this enemy (no score, just "escaped")
      this.setActive(false);
      this.setVisible(false);
    }
  }
}
