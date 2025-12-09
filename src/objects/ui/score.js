import { CUSTOM_EVENTS, EventBusComponent } from '../../components/events/event-bus-component.js';
import * as CONFIG from '../../config.js';

const ENEMY_SCORES = {
  ScoutEnemy: CONFIG.ENEMY_SCOUT_SCORE,
  FighterEnemy: CONFIG.ENEMY_FIGHTER_SCORE,
};

/**
 * Simple UI component for presenting the players score in the UI of our game.
 */
export class Score extends Phaser.GameObjects.Text {
  /** @type {number} */
  #score;
  /** @type {EventBusComponent} */
  #eventBusComponent;

  /**
   * @param {Phaser.Scene} scene
   * @param {EventBusComponent} eventBusComponent
   */
  constructor(scene, eventBusComponent) {
    super(scene, scene.scale.width / 2, 20, '0', {
      fontSize: '24px',
      color: '#ff2f66',
    });

    this.scene.add.existing(this);
    this.#eventBusComponent = eventBusComponent;
    this.#score = 0;
    this.setOrigin(0.5);

    // 👇 hide the old center text
    this.setVisible(false);

    // initialize HUD score (top-left)
    this.#updateHudScore();

    this.#eventBusComponent.on(CUSTOM_EVENTS.ENEMY_DESTROYED, (enemy) => {
      this.#score += ENEMY_SCORES[enemy.constructor.name] || 0;

      // existing center text
      this.setText(this.#score.toString(10));

      // update HUD
      this.#updateHudScore();
    });
  }

  /**
   * Formats score to always show 6 digits (TS-safe)
   */
  #formatScore(value) {
    let str = value.toString(10);
    while (str.length < 6) {
      str = '0' + str;
    }
    return str;
  }

  /**
   * Syncs the HUD score text (top-left) with the internal score.
   */
  #updateHudScore() {
    const scene = /** @type {Phaser.Scene & {
      scoreValueText?: Phaser.GameObjects.Text
    }} */ (this.scene);

    if (scene.scoreValueText) {
      scene.scoreValueText.setText(this.#formatScore(this.#score));
    }
  }
}
