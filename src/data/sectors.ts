export type SectorType = 'silicon' | 'magma' | 'ice' | 'gold' | 'void' | 'pirate' | 'crystal';

export interface Sector {
  id: string;
  name: string;
  type: SectorType;
  difficulty: number; // 1 to 5
  asteroidDensity: number; // 10 to 30
  sectorBonuses: string[];
  hazards: string[];
  bossId?: string;
  discovered: boolean;
  position: { x: number; y: number };
}

// Generate the 5x5 sector grid (25 sectors total)
export const SECTOR_NAMES: Record<SectorType, string[]> = {
  silicon: ['Křemíkový pás', 'Silicon Belt', 'Trosky Solis', 'Pasivita-4', 'Regolitové pole'],
  magma: ['Ohňové peklo', 'Pyros', 'Magma Core', 'Vulkanické hlubiny', 'Sektor Hephaestus'],
  ice: ['Mrazivá pustina', 'Glacies', 'Ledová stěna', 'Kryo-Sektor Delta', 'Boreální prstenec'],
  gold: ['Zlatá horečka', 'Eldorado', 'Aureum', 'Midasův pás', 'Sektor Karát'],
  void: ['Temný void', 'Pustoprázdno', 'Abyss', 'Nulový sektor', 'Sektor stínů'],
  pirate: ['Pirátské hnízdo', 'Sektor Korzár', 'Zátoka lebek', 'Černá vlajka', 'Kartelové území'],
  crystal: ['Krystalický dóm', 'Krystalový les', 'Prism', 'Křemenný pás', 'Sektor Amethyst'],
};

export const generateSectors = (): Sector[] => {
  const sectors: Sector[] = [];
  const size = 5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const id = `sector_${x}_${y}`;
      
      // Calculate distance from center (2, 2)
      const dx = x - 2;
      const dy = y - 2;
      const dist = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance determines tier/difficulty

      // Center is the start: Silicon Belt, difficulty 1
      let type: SectorType = 'silicon';
      let difficulty = dist + 1; // Center is 1, tier 1 is 2, tier 2 is 3
      
      if (x === 2 && y === 2) {
        type = 'silicon';
        difficulty = 1;
      } else if (dist === 1) {
        // Tier 1 types: silicon, ice, magma, crystal
        const types1: SectorType[] = ['silicon', 'ice', 'magma', 'crystal'];
        type = types1[(x + y) % types1.length];
      } else {
        // Tier 2 types: gold, void, pirate, magma, ice, crystal
        const types2: SectorType[] = ['gold', 'void', 'pirate', 'magma', 'ice', 'crystal'];
        type = types2[(x * 3 + y * 7) % types2.length];
      }

      // Density is based on difficulty
      const asteroidDensity = 10 + difficulty * 4 + Math.floor(Math.random() * 5);

      // Bonuses
      const bonuses: string[] = [];
      if (type === 'gold') bonuses.push('1.5x skóre', 'Více zlata');
      if (type === 'crystal') bonuses.push('Rychlejší těžba', 'Krystaly navíc');
      if (type === 'silicon') bonuses.push('Mírné prostředí');
      if (difficulty >= 4) bonuses.push('Dvojnásobné diamanty');
      if (difficulty === 5) bonuses.push('Vzácný drop +50%');

      // Hazards
      const hazards: string[] = [];
      if (type === 'magma') hazards.push('Solar Storm (Teplotní vlny)');
      if (type === 'ice') hazards.push('Blizzard Storm (Námraza)');
      if (type === 'pirate') hazards.push('Pirate Patrols (Přepadení)');
      if (type === 'void') hazards.push('Zvýšené kolize');
      if (difficulty >= 3 && Math.random() < 0.4) hazards.push('EM Storm (Výpadek radaru/magnetu)');

      // Boss assignment
      let bossId: string | undefined;
      // Let's place the main boss at [4, 4], and mini-bosses at [0, 4] and [4, 0]
      if (x === 4 && y === 4) {
        bossId = 'boss_omega';
      } else if (x === 0 && y === 4) {
        bossId = 'boss_cryo';
      } else if (x === 4 && y === 0) {
        bossId = 'boss_pyro';
      }

      // Name selection
      const namePool = SECTOR_NAMES[type];
      const nameIdx = (x + y * size) % namePool.length;
      let name = namePool[nameIdx];
      if (x === 2 && y === 2) {
        name = 'Silicon Belt (Základní Sektor)';
      } else if (bossId === 'boss_omega') {
        name = 'Sektor OMEGA (Finální Challenge)';
      } else if (bossId === 'boss_cryo') {
        name = 'Kryogenní Hrobka (Mini-boss)';
      } else if (bossId === 'boss_pyro') {
        name = 'Pyrotechnické Peklo (Mini-boss)';
      }

      sectors.push({
        id,
        name,
        type,
        difficulty,
        asteroidDensity,
        sectorBonuses: bonuses,
        hazards,
        bossId,
        discovered: x === 2 && y === 2, // starting sector is discovered
        position: { x, y }
      });
    }
  }

  return sectors;
};
