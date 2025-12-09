import { EnemySpawnerComponent } from '../components/spawners/enemy-spawner-component.js';
import Phaser from '../lib/phaser.js';
import { FighterEnemy } from '../objects/enemies/fighter-enemy.js';
import { ScoutEnemy } from '../objects/enemies/scout-enemy.js';
import { Player } from '../objects/player.js';
import * as CONFIG from '../config.js';
import { CUSTOM_EVENTS, EventBusComponent } from '../components/events/event-bus-component.js';
import { EnemyDestroyedComponent } from '../components/spawners/enemy-destroyed-component.js';
import { Score } from '../objects/ui/score.js';
import { Lives } from '../objects/ui/lives.js';
import { AudioManager } from '../objects/audio-manager.js';

const GAME_DURATION_SECONDS = 120; // 2 minutes

/**
 * Core Phaser 3 Scene that has the actual game play of my Space Shooter Game.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });

    // timer-related
    this.remainingTime = GAME_DURATION_SECONDS;
    this.timerEvent = null;

    // HUD references
    this.scoreValueText = null;
    this.livesValueText = null;
    this.livesIconText = null;
    this.timerValueText = null;
    this.timerBarFill = null;
    this.timerBarMaxWidth = 0;

    // game over state
    this.gameOver = false;
  }

  /**
   * Utility to format seconds as M:SS (e.g. 1:05)
   * @param {number} seconds
   * @returns {string}
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secondsPart = seconds % 60;
    return (
      minutes.toString(10) + ':' + (secondsPart.toString().length < 2 ? '0' + secondsPart : secondsPart.toString(10))
    );
  }

  /**
   * Creates the HUD bar at the top of the screen.
   */
  createHUD() {
    const { width } = this.scale;
    const hudHeight = 60;

    // Background bar
    const hudBg = this.add.rectangle(0, 0, width, hudHeight, 0x000000, 0.6);
    hudBg.setOrigin(0, 0);

    // Common styles
    const labelStyle = {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#AAAAAA',
    };

    const valueStyle = {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#FFFFFF',
    };

    // ===== SCORE (left) =====
    this.add.text(20, 8, 'SCORE', labelStyle);
    this.scoreValueText = this.add.text(20, 28, '000000', valueStyle);

    // ===== TIMER (center) =====
    const centerX = width / 2;

    this.add.text(centerX, 8, 'TIME', labelStyle).setOrigin(0.5, 0);

    this.timerValueText = this.add.text(centerX, 28, this.formatTime(this.remainingTime), valueStyle).setOrigin(0.5, 0);

    // Timer progress bar (simple rectangle)
    const barWidth = 180;
    const barHeight = 8;
    const barY = 52;
    const barX = centerX - barWidth / 2;

    this.timerBarMaxWidth = barWidth;

    this.add.rectangle(barX, barY, barWidth, barHeight, 0x444444, 0.8).setOrigin(0, 0.5);

    this.timerBarFill = this.add.rectangle(barX, barY, barWidth, barHeight, 0xffd700, 1).setOrigin(0, 0.5);

    // ===== LIVES (right) =====
    const initialLives = CONFIG.PLAYER_LIVES;

    this.add.text(width - 20, 8, 'LIVES', labelStyle).setOrigin(1, 0);

    // number and hearts on same row
    const heartsX = width - 20; // far right
    const heartsY = 32; // row for hearts & number
    const numberX = heartsX - 60; // number a bit to the left

    this.livesValueText = this.add
      .text(numberX, heartsY, 'x ' + initialLives.toString(10), valueStyle)
      .setOrigin(1, 0.5);

    this.livesIconText = this.add
      .text(heartsX, heartsY, '❤'.repeat(Math.max(0, Math.min(initialLives, 5))), {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#FF5555',
      })
      .setOrigin(1, 0.5);
  }

  /**
   * Called every second by the Phaser timer to update countdown.
   */
  onTimerTick() {
    if (this.gameOver) {
      return;
    }

    this.remainingTime--;

    if (this.timerValueText) {
      this.timerValueText.setText(this.formatTime(this.remainingTime));
    }

    this.updateTimerBar();

    if (this.remainingTime <= 0) {
      if (this.timerEvent) {
        this.timerEvent.remove(false);
      }
      this.handleTimeUp();
    }
  }

  /**
   * Shrinks the yellow timer bar based on remaining time.
   */
  updateTimerBar() {
    if (!this.timerBarFill || !this.timerBarMaxWidth) {
      return;
    }

    const ratio = Phaser.Math.Clamp(this.remainingTime / GAME_DURATION_SECONDS, 0, 1);

    this.timerBarFill.width = this.timerBarMaxWidth * ratio;
  }

  /**
   * Called when an enemy escapes past the player.
   * Applies a time penalty and flashes the timer bar.
   */
  registerEnemyEscape() {
    if (this.gameOver) return;

    var PENALTY = 10; // seconds
    this.remainingTime = Math.max(0, this.remainingTime - PENALTY);

    // Update timer display immediately
    if (this.timerValueText) {
      this.timerValueText.setText(this.formatTime(this.remainingTime));
    }
    this.updateTimerBar();

    // Small visual feedback: flash the timer bar
    if (this.timerBarFill) {
      this.tweens.add({
        targets: this.timerBarFill,
        alpha: 0.2,
        duration: 80,
        yoyo: true,
        repeat: 2,
      });
    }

    if (this.remainingTime <= 0) {
      if (this.timerEvent) {
        this.timerEvent.remove(false);
      }
      this.handleTimeUp();
    }
  }

  /**
   * What happens when the countdown reaches zero.
   */
  handleTimeUp() {
    this.handleGameOver('TIME_UP');
  }

  /**
   * Shows Game Over / Time Up overlay and lets the player restart.
   * @param {'TIME_UP' | 'OUT_OF_LIVES'} reason
   */
  handleGameOver(reason) {
    if (this.gameOver) {
      return;
    }
    this.gameOver = true;

    // stop timer
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }

    // Pause physics
    if (this.physics && this.physics.world) {
      this.physics.world.pause();
    }

    const { width, height } = this.scale;

    // Dark overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(1000);

    var titleText = reason === 'TIME_UP' ? 'TIME UP!' : 'GAME OVER';

    this.add
      .text(width / 2, height / 2 - 40, titleText, {
        fontSize: '32px',
        fontFamily: 'Arial',
        color: '#FFD700',
      })
      .setOrigin(0.5)
      .setDepth(1001);

    var finalScore = this.scoreValueText ? this.scoreValueText.text : '000000';
    this.add
      .text(width / 2, height / 2, 'Final Score: ' + finalScore, {
        fontSize: '20px',
        fontFamily: 'Arial',
        color: '#FFFFFF',
      })
      .setOrigin(0.5)
      .setDepth(1001);

    this.add
      .text(width / 2, height / 2 + 40, 'Press R or Click to Restart', {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#CCCCCC',
      })
      .setOrigin(0.5)
      .setDepth(1001);

    // One-time restart handlers
    this.input.keyboard.once('keydown-R', () => {
      this.scene.restart();
    });

    this.input.once('pointerdown', () => {
      this.scene.restart();
    });
  }

  /**
   * Creates all of the required game objects for our scene and sets up the required
   * collision checks using the built in Phaser 3 Arcade Physics.
   * @returns {void}
   */
  create() {
    // reset scene state
    this.gameOver = false;
    this.remainingTime = GAME_DURATION_SECONDS;

    // backgrounds
    this.add.sprite(0, 0, 'bg1', 0).setOrigin(0, 1).setAlpha(0.7).play('bg1').setAngle(90).setScale(1, 1.25);
    this.add.sprite(0, 0, 'bg2', 0).setOrigin(0, 1).setAlpha(0.7).play('bg2').setAngle(90).setScale(1, 1.25);
    this.add.sprite(0, 0, 'bg3', 0).setOrigin(0, 1).setAlpha(0.7).play('bg3').setAngle(90).setScale(1, 1.25);

    // common components
    const eventBusComponent = new EventBusComponent();

    // spawn player
    const player = new Player(this, eventBusComponent);

    // spawn enemies
    const scoutSpawner = new EnemySpawnerComponent(
      this,
      ScoutEnemy,
      {
        interval: CONFIG.ENEMY_SCOUT_GROUP_SPAWN_INTERVAL,
        spawnAt: CONFIG.ENEMY_SCOUT_GROUP_SPAWN_START,
      },
      eventBusComponent
    );
    const fighterSpawner = new EnemySpawnerComponent(
      this,
      FighterEnemy,
      {
        interval: CONFIG.ENEMY_FIGHTER_GROUP_SPAWN_INTERVAL,
        spawnAt: CONFIG.ENEMY_FIGHTER_GROUP_SPAWN_START,
      },
      eventBusComponent
    );
    new EnemyDestroyedComponent(this, eventBusComponent);

    // collisions for player and enemy groups
    this.physics.add.overlap(
      player,
      scoutSpawner.phaserGroup,
      (/** @type {Player}*/ playerGameObject, /** @type {ScoutEnemy}*/ enemyGameObject) => {
        if (!enemyGameObject.active || !playerGameObject.active) {
          return;
        }
        playerGameObject.colliderComponent.collideWithEnemyShip();
        enemyGameObject.colliderComponent.collideWithEnemyShip();
      }
    );
    this.physics.add.overlap(
      player,
      fighterSpawner.phaserGroup,
      (/** @type {Player}*/ playerGameObject, /** @type {FighterEnemy}*/ enemyGameObject) => {
        if (!enemyGameObject.active || !playerGameObject.active) {
          return;
        }
        playerGameObject.colliderComponent.collideWithEnemyShip();
        enemyGameObject.colliderComponent.collideWithEnemyShip();
      }
    );
    eventBusComponent.on(CUSTOM_EVENTS.ENEMY_INIT, (gameObject) => {
      // if name is an enemy from pool, add collision check for weapon group if needed
      if (gameObject.constructor.name !== 'FighterEnemy') {
        return;
      }

      this.physics.add.overlap(
        player,
        gameObject.weaponGameObjectGroup,
        (
          /** @type {Player}*/ playerGameObject,
          /** @type {Phaser.Types.Physics.Arcade.SpriteWithDynamicBody}*/ projectileGameObject
        ) => {
          if (!playerGameObject.active) {
            return;
          }

          gameObject.weaponComponent.destroyBullet(projectileGameObject);
          playerGameObject.colliderComponent.collideWithEnemyProjectile();
        }
      );
    });

    // collisions for player weapons and enemy groups
    this.physics.add.overlap(
      player.weaponGameObjectGroup,
      scoutSpawner.phaserGroup,
      (
        /** @type {ScoutEnemy}*/ enemyGameObject,
        /** @type {Phaser.Types.Physics.Arcade.SpriteWithDynamicBody}*/ projectileGameObject
      ) => {
        if (!enemyGameObject.active) {
          return;
        }
        player.weaponComponent.destroyBullet(projectileGameObject);
        enemyGameObject.colliderComponent.collideWithEnemyProjectile();
      }
    );
    this.physics.add.overlap(
      player.weaponGameObjectGroup,
      fighterSpawner.phaserGroup,
      (
        /** @type {FighterEnemy}*/ enemyGameObject,
        /** @type {Phaser.Types.Physics.Arcade.SpriteWithDynamicBody}*/ projectileGameObject
      ) => {
        if (!enemyGameObject.active) {
          return;
        }
        player.weaponComponent.destroyBullet(projectileGameObject);
        enemyGameObject.colliderComponent.collideWithEnemyProjectile();
      }
    );

    // improved HUD layer (new)
    this.createHUD();

    // ui (existing)
    new Score(this, eventBusComponent);
    new Lives(this, eventBusComponent);

    // listen for out-of-lives game over
    eventBusComponent.on(CUSTOM_EVENTS.GAME_OVER, () => {
      this.handleGameOver('OUT_OF_LIVES');
    });

    // start countdown timer
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.onTimerTick,
      callbackScope: this,
      loop: true,
    });

    // audio
    new AudioManager(this, eventBusComponent);
  }
}
