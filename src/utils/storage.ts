/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Upgrades, PlayerStats } from '../types';

const STORAGE_KEY_UPGRADES = 'asteroid_miner_upgrades';
const STORAGE_KEY_STATS = 'asteroid_miner_stats';

const DEFAULT_UPGRADES: Upgrades = {
  laserLevel: 1,
  magnetLevel: 1,
  hullLevel: 1,
  shieldLevel: 0, // No shield by default
  engineLevel: 1,
  abilityLightningLevel: 0,
  abilityPulseLevel: 0,
  abilitySuperMagnetLevel: 0,
  scoreMultiplierLevel: 1,
  abilitySockLevel: 0,
  blackHoleActivator: 0,
  miningDronesLevel: 0,
  omegaDestructorLevel: 0,
  quantumMirrorLevel: 0,
  toxicTrailLevel: 0,
  salvageMagnetLevel: 0,
  autoRepairSpeedLevel: 0,
  playerShipClass: 'standard',
  
  // Carrier defaults
  carrierClass: 'none',
  carrierHullLevel: 0,
  carrierShieldLevel: 0,
  carrierEngineLevel: 0,
  carrierWeaponSlotLevel: 0,
  carrierWeaponDamageLevel: 1,
  carrierHyperfuelTankLevel: 1,
  carrierHyperdriveRangeLevel: 1,
  carrierRepairBayLevel: 0,
  carrierCargoHoldLevel: 0,
  carrierRepairDronesLevel: 0,
  carrierPointDefenseLevel: 0,
};

const DEFAULT_STATS: PlayerStats = {
  crystals: 0,
  diamonds: 0,
  obsidian: 0,
  deuterium: 0, // New fuel resource
  highScore: 0,
  totalAsteroidsMined: 0,
  prestigeCount: 0,
};

export function loadUpgrades(): Upgrades {
  try {
    const data = localStorage.getItem(STORAGE_KEY_UPGRADES);
    if (data) {
      const parsed = JSON.parse(data);
      return { ...DEFAULT_UPGRADES, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load upgrades from localStorage:', e);
  }
  return DEFAULT_UPGRADES;
}

export function saveUpgrades(upgrades: Upgrades) {
  try {
    localStorage.setItem(STORAGE_KEY_UPGRADES, JSON.stringify(upgrades));
  } catch (e) {
    console.error('Failed to save upgrades to localStorage:', e);
  }
}

export function loadStats(): PlayerStats {
  try {
    const data = localStorage.getItem(STORAGE_KEY_STATS);
    if (data) {
      const parsed = JSON.parse(data);
      return { ...DEFAULT_STATS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load stats from localStorage:', e);
  }
  return DEFAULT_STATS;
}

export function saveStats(stats: PlayerStats) {
  try {
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save stats to localStorage:', e);
  }
}

export function resetGameSave() {
  try {
    localStorage.removeItem(STORAGE_KEY_UPGRADES);
    localStorage.removeItem(STORAGE_KEY_STATS);
  } catch (e) {
    console.error('Failed to reset save state:', e);
  }
}
