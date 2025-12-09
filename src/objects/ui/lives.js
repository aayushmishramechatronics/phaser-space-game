import { CUSTOM_EVENTS, EventBusComponent } from '../../components/events/event-bus-component.js';
import * as CONFIG from '../../config.js';

/**
 * Simple UI component for presenting the players lives in the UI of our game.
 */
export class Lives extends Phaser.GameObjects.Container {
  /** @type {number} */
  #lives;
  /** @type {EventBusComponent} */
  #eventBusComponent;

  /**
   * @param {Phaser.Scene} scene
   * @param {EventBusComponent} eventBusComponent
   */
  constructor(scene, eventBusComponent) {
    super(scene, 5, scene.scale.height - 30, []);
    this.#eventBusComponent = eventBusComponent;
    this.#lives = CONFIG.PLAYER_LIVES;
    this.scene.add.existing(this);

    // create life icons (bottom-left ships, existing UI)
    for (let i = 0; i < this.#lives; i += 1) {
      const ship = scene.add
        .image(i * 20, 0, 'ship')
        .setScale(0.6)
        .setOrigin(0);
      this.add(ship);
    }

    // initialize HUD lives (top-right) if the HUD exists
    this.#updateHudLives();

    this.#eventBusComponent.on(CUSTOM_EVENTS.PLAYER_DESTROYED, () => {
      this.#lives -= 1;

      // remove one ship icon from the bottom-left container
      this.getAt(this.#lives).destroy();

      // camera shake effect
      this.scene.cameras.main.shake(500, 0.01);

      // update HUD (text + hearts)
      this.#updateHudLives();

      if (this.#lives > 0) {
        scene.time.delayedCall(1500, () => {
          this.#eventBusComponent.emit(CUSTOM_EVENTS.PLAYER_SPAWN);
        });
        return;
      }

      // No more drawing here – just tell the scene the game is over
      this.#eventBusComponent.emit(CUSTOM_EVENTS.GAME_OVER);
    });

    this.#eventBusComponent.emit(CUSTOM_EVENTS.PLAYER_SPAWN);
  }

  /**
   * Syncs the HUD elements (top-right) with current lives.
   * Uses only text, no extra assets.
   */
  #updateHudLives() {
    // these are created in GameScene.createHUD()
    const scene = /** @type {Phaser.Scene & {
      livesValueText?: Phaser.GameObjects.Text,
      livesIconText?: Phaser.GameObjects.Text
    }} */ (this.scene);

    if (scene.livesValueText) {
      scene.livesValueText.setText(`x ${this.#lives}`);
    }

    if (scene.livesIconText) {
      // clamp hearts to max 5 so it doesn't stretch too much
      const hearts = '❤'.repeat(Math.max(0, Math.min(this.#lives, 5)));
      scene.livesIconText.setText(hearts);
    }
  }
}
