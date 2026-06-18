import React, { useEffect, useRef, useState } from 'react';
import { 
  playCollectSound, 
  playLaserSound, 
  playExplosionSound, 
  playDamageSound,
  playUpgradeSound 
} from '../utils/audio';

interface AsteroidExplorerProps {
  isOpen: boolean;
  onClose: (minedCrystals: number, minedDiamonds: number, minedObsidians: number, scoreBonus: number) => void;
  asteroidType: 'magma' | 'frost' | 'crystal' | 'normal';
  asteroidRadius: number;
  asteroidColor: string;
  asteroidName: string;
}

interface MineralNode {
  id: string;
  angle: number; // in radians around the asteroid
  type: 'crystal' | 'diamond' | 'obsidian';
  amount: number;
  maxAmount: number;
}

interface GravityParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  lifetime: number;
  maxLifetime: number;
}

interface Hazard {
  id: string;
  type: 'vent' | 'meteor';
  angle?: number; // for vents
  x?: number; // for meteors
  y?: number;
  vx?: number;
  vy?: number;
  state: 'idle' | 'warning' | 'active';
  timer: number;
}

export default function AsteroidExplorer({
  isOpen,
  onClose,
  asteroidType,
  asteroidName
}: AsteroidExplorerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Game states
  const [oxygen, setOxygen] = useState<number>(100);
  const [cargo, setCargo] = useState<{ crystal: number; diamond: number; obsidian: number }>({
    crystal: 0,
    diamond: 0,
    obsidian: 0
  });
  const [minedNodesRemaining, setMinedNodesRemaining] = useState<number>(4);
  const [explorerInstructions, setExplorerInstructions] = useState<boolean>(true);

  // Core physics / simulation properties
  const requestRef = useRef<number | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  // Astronaut model
  const astronautAngle = useRef<number>(0); // radians around surface
  const astronautHeight = useRef<number>(130); // radius of asteroid surface is 130
  const astronautAngularVel = useRef<number>(0);
  const astronautRadialVel = useRef<number>(0);
  const currentActionTimer = useRef<number>(0);
  
  // Gamepad cache
  const gamepadIndexRef = useRef<number | null>(null);

  // Entities refs
  const asteroidBaseRadius = 130;
  const asteroidAngleRotation = useRef<number>(0);
  const mineralsRef = useRef<MineralNode[]>([]);
  const particlesRef = useRef<GravityParticle[]>([]);
  const hazardsRef = useRef<Hazard[]>([]);
  const lastMiningTimeRef = useRef<number>(0);
  const isMiningRef = useRef<boolean>(false);
  const shipAngle = useRef<number>(Math.PI * 1.5); // Fixed landing pad position (top)

  // Message notifications
  const [notifications, setNotifications] = useState<{ id: string; text: string; color: string }[]>([]);

  const triggerFloatNotification = (text: string, color: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, text, color }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 2500);
  };

  useEffect(() => {
    if (!isOpen) return;

    // Build mineral spots procedurally
    const initialMinerals: MineralNode[] = [];
    const types: ('crystal' | 'diamond' | 'obsidian')[] = ['crystal', 'diamond', 'obsidian', 'crystal'];
    if (asteroidType === 'magma') {
      types[0] = 'obsidian';
      types[3] = 'obsidian';
    } else if (asteroidType === 'frost') {
      types[1] = 'diamond';
      types[2] = 'diamond';
    } else if (asteroidType === 'crystal') {
      types[0] = 'crystal';
      types[1] = 'crystal';
      types[2] = 'crystal';
      types[3] = 'crystal';
    }

    // Place minerals around the circle, spacing them out
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI / 2) + 0.5 + Math.random() * 0.5;
      initialMinerals.push({
        id: `node_${i}`,
        angle,
        type: types[i % types.length],
        amount: 15,
        maxAmount: 15
      });
    }
    mineralsRef.current = initialMinerals;
    setMinedNodesRemaining(4);

    // Initial stars parralax background
    particlesRef.current = [];
    hazardsRef.current = [];
    
    // Set astronaut at landing pad
    astronautAngle.current = shipAngle.current;
    astronautHeight.current = asteroidBaseRadius;
    astronautAngularVel.current = 0;
    astronautRadialVel.current = 0;
    setOxygen(100);
    setCargo({ crystal: 0, diamond: 0, obsidian: 0 });

    // Key handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'KeyE') {
        processActionKey();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Dynamic scale listener
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const cnt = containerRef.current;
      if (canvas && cnt) {
        canvas.width = cnt.clientWidth;
        canvas.height = cnt.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Detect gamepad
    const detectGamepadOnDisembark = () => {
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          gamepadIndexRef.current = i;
          break;
        }
      }
    };
    detectGamepadOnDisembark();

    // Start simulation loop
    requestRef.current = requestAnimationFrame(tickExplorer);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', resizeCanvas);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isOpen]);

  const processActionKey = () => {
    // See if close to ship (Landing pad is at shipAngle)
    const angleDiff = Math.abs(astronautAngle.current - shipAngle.current);
    const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    if (Math.abs(normalizedDiff) < 0.15 && astronautHeight.current <= asteroidBaseRadius + 2) {
      // Return to orbit!
      handleLaunchComplete();
      return;
    }
  };

  const handleLaunchComplete = () => {
    // Collect all bonuses and close
    const finalScoreBonus = cargo.crystal * 100 + cargo.diamond * 250 + cargo.obsidian * 150 + 400;
    playUpgradeSound();
    onClose(cargo.crystal, cargo.diamond, cargo.obsidian, finalScoreBonus);
  };

  const spawnSpark = (x: number, y: number, color: string) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 1;
    particlesRef.current.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      size: Math.random() * 3 + 1,
      alpha: 1.0,
      lifetime: 0,
      maxLifetime: 20 + Math.floor(Math.random() * 20)
    });
  };

  const tickExplorer = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      requestRef.current = requestAnimationFrame(tickExplorer);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check Gamepads
    let gpLeft = false;
    let gpRight = false;
    let gpJump = false;
    let gpAction = false;

    if (gamepadIndexRef.current !== null) {
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      const gp = gamepads[gamepadIndexRef.current];
      if (gp) {
        // Left stick
        const axisX = gp.axes[0];
        if (axisX < -0.3) gpLeft = true;
        if (axisX > 0.3) gpRight = true;

        // Button A or trigger
        if (gp.buttons[0]?.pressed) gpJump = true;
        if (gp.buttons[1]?.pressed || gp.buttons[2]?.pressed || gp.buttons[7]?.pressed) gpAction = true;
      }
    }

    // 1. UPDATE ROTATING ASTEROID BACKGROUND
    asteroidAngleRotation.current += 0.0015;

    // 2. INPUT & VELOCITIES
    const moveSpeed = 0.007; // Radian movement
    if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA'] || gpLeft) {
      astronautAngularVel.current = -moveSpeed;
    } else if (keysRef.current['ArrowRight'] || keysRef.current['KeyD'] || gpRight) {
      astronautAngularVel.current = moveSpeed;
    } else {
      astronautAngularVel.current *= 0.85; // Slide friction
    }

    // Update angle
    astronautAngle.current += astronautAngularVel.current;

    // Gravity force and Jumping
    const baseG = 0.28; // Gravity pulling inwards
    const surfaceHeight = asteroidBaseRadius;

    if (astronautHeight.current <= surfaceHeight) {
      astronautHeight.current = surfaceHeight;
      astronautRadialVel.current = 0;

      // Jump request
      if (keysRef.current['Space'] || keysRef.current['ArrowUp'] || keysRef.current['KeyW'] || gpJump) {
        astronautRadialVel.current = 4.8; // jump impulse
        playLaserSound(2); // Jump boost Sound proxy
      }
    } else {
      // In mid-air: pull astronaut down
      astronautRadialVel.current -= baseG;
    }

    astronautHeight.current += astronautRadialVel.current;

    // Keep astronaut within world bounds
    if (astronautHeight.current < surfaceHeight) {
      astronautHeight.current = surfaceHeight;
    }

    // 3. MINING LOOP
    isMiningRef.current = false;
    const currentAstAngle = astronautAngle.current;
    let nodeInRange: MineralNode | null = null;

    mineralsRef.current.forEach(node => {
      if (node.amount > 0) {
        // calculate angle diff
        const diff = Math.atan2(Math.sin(node.angle - currentAstAngle), Math.cos(node.angle - currentAstAngle));
        if (Math.abs(diff) < 0.12 && astronautHeight.current <= surfaceHeight + 5) {
          nodeInRange = node;
        }
      }
    });

    if (nodeInRange && (keysRef.current['KeyE'] || gpAction)) {
      isMiningRef.current = true;
      const now = Date.now();
      if (now - lastMiningTimeRef.current > 180) {
        lastMiningTimeRef.current = now;
        nodeInRange.amount -= 1;
        
        // Add gem to cargo
        setCargo(prev => {
          const next = { ...prev };
          next[nodeInRange!.type] = next[nodeInRange!.type] + 1;
          return next;
        });

        // Trigger float notify
        const label = nodeInRange.type === 'crystal' ? '+1 Krystal' : nodeInRange.type === 'diamond' ? '+1 Diamant' : '+1 Obsidián';
        const color = nodeInRange.type === 'crystal' ? '#10b981' : nodeInRange.type === 'diamond' ? '#38bdf8' : '#f43f5e';
        triggerFloatNotification(label, color);
        playCollectSound(nodeInRange.type);

        if (nodeInRange.amount <= 0) {
          const rem = mineralsRef.current.filter(m => m.amount > 0).length;
          setMinedNodesRemaining(rem);
          triggerFloatNotification('💎 ŽÍLA PLNĚ VYTĚŽENA!', '#eab308');
          playUpgradeSound();
        }
      }
    }

    // 4. GENERATING SURFACE HAZARDS (GAS VENTS & SOLAR METEORS)
    if (Math.random() < 0.015 && hazardsRef.current.length < 3) {
      const hazardType = Math.random() < 0.5 ? 'vent' : 'meteor';
      if (hazardType === 'vent') {
        // Ground vent warning
        hazardsRef.current.push({
          id: Math.random().toString(),
          type: 'vent',
          angle: Math.random() * Math.PI * 2,
          state: 'idle',
          timer: 110 // frames before eruption
        });
      } else {
        // Meteor falling down
        const surfaceX = canvas.width / 2 + Math.cos(astronautAngle.current + (Math.random() * 1.5 - 0.75)) * 320;
        const surfaceY = canvas.height / 2 + Math.sin(astronautAngle.current + (Math.random() * 1.5 - 0.75)) * 320;
        const targetX = canvas.width / 2;
        const targetY = canvas.height / 2;
        
        const mAngle = Math.atan2(targetY - surfaceY, targetX - surfaceX);
        const mSpeed = Math.random() * 2 + 1.8;

        hazardsRef.current.push({
          id: Math.random().toString(),
          type: 'meteor',
          x: surfaceX,
          y: surfaceY,
          vx: Math.cos(mAngle) * mSpeed,
          vy: Math.sin(mAngle) * mSpeed,
          state: 'active',
          timer: 350
        });
      }
    }

    // Update & check hazards collisions
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const astX = cx + Math.cos(astronautAngle.current) * astronautHeight.current;
    const astY = cy + Math.sin(astronautAngle.current) * astronautHeight.current;

    hazardsRef.current.forEach(h => {
      h.timer--;
      if (h.type === 'vent') {
        if (h.timer > 0) {
          h.state = h.timer < 30 ? 'warning' : 'idle';
        } else {
          h.state = 'active';
          if (h.timer < -40) {
            h.timer = 0; // mark obsolete
          }
          // Check vent collision
          const vAngle = h.angle!;
          const diff = Math.atan2(Math.sin(vAngle - astronautAngle.current), Math.cos(vAngle - astronautAngle.current));
          if (Math.abs(diff) < 0.1 && astronautHeight.current < asteroidBaseRadius + 22) {
            applyDamage(6, '🌋 Výbušná geotermální magma trhlina!');
          }
          // Spawn visual sparks
          const vx = cx + Math.cos(vAngle) * asteroidBaseRadius;
          const vy = cy + Math.sin(vAngle) * asteroidBaseRadius;
          spawnSpark(vx, vy, '#f97316');
        }
      } else {
        // Meteor progress
        if (h.x !== undefined && h.y !== undefined) {
          h.x += h.vx!;
          h.y += h.vy!;

          // Check distance to center to prevent flying off
          const dToCenter = Math.hypot(h.x - cx, h.y - cy);
          if (dToCenter < asteroidBaseRadius + 2) {
            h.timer = 0; // explode on ground
            playExplosionSound('small');
            for (let i = 0; i < 8; i++) spawnSpark(h.x, h.y, '#f59e0b');
          }

          // Check collision with astronaut
          const dToPlayer = Math.hypot(h.x - astX, h.y - astY);
          if (dToPlayer < 24) {
            applyDamage(18, '☄️ Přímý zásah mikrometeoritem!');
            h.timer = 0; // dissipate
          }
        }
      }
    });

    hazardsRef.current = hazardsRef.current.filter(h => h.timer > 0);

    // 5. OXYGEN AND SHIP CHARGING
    // See if close to ship (Landing pad is at shipAngle)
    const angleDiff = Math.abs(astronautAngle.current - shipAngle.current);
    const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    const isAtShip = Math.abs(normalizedDiff) < 0.15 && astronautHeight.current <= asteroidBaseRadius + 5;

    if (isAtShip) {
      if (oxygen < 100) {
        setOxygen(prev => Math.min(100, prev + 1.2));
      }
    } else {
      setOxygen(prev => {
        const next = prev - 0.045; // oxygen consumption rate
        if (next <= 0) {
          handleSuitFailure();
          return 0;
        }
        return next;
      });
    }

    // Update trailing sparks
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.lifetime++;
      p.alpha = 1.0 - (p.lifetime / p.maxLifetime);
    });
    particlesRef.current = particlesRef.current.filter(p => p.lifetime < p.maxLifetime);

    // 6. DRAW ALL WORLD VIEWS
    ctx.clearRect(0,0, canvas.width, canvas.height);

    // Frame centering translation & rotation (The Little Prince mode: rotating camera!)
    ctx.save();
    ctx.translate(cx, cy);
    // Rotate world so astronaut is ALWAYS at the top (angle = -PI/2) for full immersion!
    ctx.rotate(-astronautAngle.current - Math.PI / 2);

    // Parralax starfield
    drawDynamicStarfieldBackground(ctx);

    // Draw Atmosphere glow / magnetic shell
    const grad = ctx.createRadialGradient(0,0, asteroidBaseRadius - 20, 0,0, asteroidBaseRadius + 40);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
    grad.addColorStop(0.7, asteroidType === 'magma' ? 'rgba(239, 68, 68, 0.08)' : asteroidType === 'frost' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(168, 85, 247, 0.08)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, asteroidBaseRadius + 45, 0, Math.PI * 2);
    ctx.fill();

    // Draw Asteroid body core
    ctx.save();
    ctx.rotate(asteroidAngleRotation.current);
    drawAsteroidVisualBody(ctx, asteroidBaseRadius, asteroidType);
    ctx.restore();

    // Draw Ground vents markers
    hazardsRef.current.forEach(h => {
      if (h.type === 'vent' && h.angle !== undefined) {
        ctx.save();
        ctx.rotate(h.angle);
        const vy = -asteroidBaseRadius;
        
        ctx.fillStyle = h.state === 'warning' ? 'rgba(239, 68, 68, 0.65)' : 'rgba(244, 63, 94, 0.25)';
        ctx.beginPath();
        ctx.arc(0, vy, h.state === 'warning' ? 12 : 8, 0, Math.PI * 2);
        ctx.fill();

        // draw small warnings arrow pointing to danger
        if (h.state === 'warning' && Math.floor(Date.now() / 150) % 2 === 0) {
          ctx.fillStyle = '#ffc000';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('⚠️', 0, vy - 15);
        }
        ctx.restore();
      }
    });

    // Draw Minerals Node spots
    mineralsRef.current.forEach(node => {
      if (node.amount > 0) {
        ctx.save();
        ctx.rotate(node.angle);
        const ny = -asteroidBaseRadius;

        // Draw node crystals visually
        const nodeColor = node.type === 'crystal' ? '#10b981' : node.type === 'diamond' ? '#38bdf8' : '#e11d48';
        ctx.shadowColor = nodeColor;
        ctx.shadowBlur = 10;
        
        ctx.fillStyle = nodeColor;
        // draw a cluster of diamonds
        ctx.beginPath();
        ctx.moveTo(0, ny - 10);
        ctx.lineTo(8, ny + 2);
        ctx.lineTo(-8, ny + 2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-6, ny - 6);
        ctx.lineTo(0, ny + 4);
        ctx.lineTo(-12, ny + 4);
        ctx.closePath();
        ctx.fill();

        // draw small tag label if standing near
        const diff = Math.atan2(Math.sin(node.angle - astronautAngle.current), Math.cos(node.angle - astronautAngle.current));
        if (Math.abs(diff) < 0.15) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 9px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(`VYKOPEJ [E] (${node.amount})`, 0, ny - 18);
        }
        ctx.restore();
      }
    });

    // Draw Parked Spaceship
    ctx.save();
    ctx.rotate(shipAngle.current);
    const sy = -asteroidBaseRadius;
    // landing platform visual path
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, asteroidBaseRadius, -0.15, 0.15);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, sy + 3, 14, 0, Math.PI * 2);
    ctx.fill();

    // the parked mini spaceship body
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(0, sy - 15);
    ctx.lineTo(10, sy + 4);
    ctx.lineTo(-10, sy + 4);
    ctx.closePath();
    ctx.fill();

    // ship engines and lights
    ctx.fillStyle = '#0891b2';
    ctx.fillRect(-6, sy + 4, 3, 4);
    ctx.fillRect(3, sy + 4, 3, 4);

    // docking dome tag label
    if (isAtShip) {
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'extrabold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ODLETĚT [E]', 0, sy - 24);
    }
    ctx.restore();

    // Draw Astronaut Particles
    particlesRef.current.forEach(p => {
      // transform coordinates as we rotate canvas relative to center
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(p.x - cx, p.y - cy, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;

    // Draw meteors hazards directly mapped relative to space
    hazardsRef.current.forEach(h => {
      if (h.type === 'meteor' && h.x !== undefined && h.y !== undefined) {
        ctx.save();
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(h.x - cx, h.y - cy, 6, 0, Math.PI * 2);
        ctx.fill();

        // draw fiery dynamic particle trails backing
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(h.x - cx - h.vx! * 3, h.y - cy - h.vy! * 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // 7. DRAW ASTRONAUT PLAYER (Rendered static at the top position because of container camera rotation!)
    ctx.restore(); // reset world-rotation to safely draw astronaut centered upright
    
    ctx.save();
    ctx.translate(cx, cy);

    // Coordinates of astronaut when perfectly upright: top surface of centered circle
    const ay = -astronautHeight.current;

    // Laser beam if mining
    if (isMiningRef.current && nodeInRange) {
      const nodeAng = (nodeInRange as MineralNode).angle;
      const angleDiff = Math.atan2(Math.sin(nodeAng - astronautAngle.current), Math.cos(nodeAng - astronautAngle.current));
      
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;
      
      // Target localized coordinates based on difference rotation
      const nodeX = Math.sin(angleDiff) * asteroidBaseRadius;
      const nodeY = -Math.cos(angleDiff) * asteroidBaseRadius;
      
      ctx.beginPath();
      ctx.moveTo(0, ay - 6);
      ctx.lineTo(nodeX, nodeY);
      ctx.stroke();
      
      // Spawn tiny laser ground sparks
      for (let i = 0; i < 2; i++) spawnSpark(cx + nodeX, cy + nodeY, '#22d3ee');
      ctx.restore();
    }

    // Little running legs animation if moving
    const isMoving = keysRef.current['ArrowLeft'] || keysRef.current['KeyA'] || keysRef.current['ArrowRight'] || keysRef.current['KeyD'] || gpLeft || gpRight;
    const legSwing = isMoving ? Math.sin(Date.now() / 80) * 5 : 0;

    // Draw little Astronaut Suit
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#ffffff';

    // Space suite body
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-6, ay - 14, 12, 12);

    // Legs
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-5, ay - 2, 4, 3 + legSwing); // Left Leg
    ctx.fillRect(1, ay - 2, 4, 3 - legSwing);  // Right Leg

    // Visor / Glass helmet
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(0, ay - 15, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Visor reflections
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(2, ay - 17, 2, 0, Math.PI * 2);
    ctx.fill();

    // jet pack flame if jumping
    if (astronautRadialVel.current > 0.5) {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-5, ay - 6, 2, 8 + Math.random() * 5);
      ctx.fillRect(3, ay - 6, 2, 8 + Math.random() * 5);
    }

    ctx.restore();

    requestRef.current = requestAnimationFrame(tickExplorer);
  };

  const applyDamage = (amount: number, source: string) => {
    playDamageSound();
    setOxygen(prev => {
      const next = Math.max(0, prev - amount);
      if (next <= 0) {
        handleSuitFailure();
        return 0;
      }
      return next;
    });
    triggerFloatNotification(`${amount}% Poškození obleku!`, '#ef4444');
  };

  const handleSuitFailure = () => {
    playExplosionSound('medium');
    // Lose half of materials and wake up in ship
    const penaltyCrystals = Math.floor(cargo.crystal * 0.4);
    const penaltyDiamonds = Math.floor(cargo.diamond * 0.4);
    const penaltyObsidians = Math.floor(cargo.obsidian * 0.4);

    alert(`⚠️ KRITICKÁ SEHRA PŘISTÁNÍ!\nTlakový oblek astronauta selhal. Přivolali jsme nouzový telerobotický restart.\n\nZtraceno 40% nasbíraných drahokamů.`);

    const savedCrystals = cargo.crystal - penaltyCrystals;
    const savedDiamonds = cargo.diamond - penaltyDiamonds;
    const savedObsidians = cargo.obsidian - penaltyObsidians;

    onClose(savedCrystals, savedDiamonds, savedObsidians, 100);
  };

  const drawDynamicStarfieldBackground = (ctx: CanvasRenderingContext2D) => {
    // Elegant radial parallax space stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const angle = (i * 24.3) + (asteroidAngleRotation.current * 0.1);
      const dist = 220 + (i * 4) % 180;
      const starX = Math.cos(angle) * dist;
      const starY = Math.sin(angle) * dist;
      ctx.globalAlpha = 0.15 + (i % 5) * 0.15;
      ctx.fillRect(starX, starY, 1.5, 1.5);
    }
    ctx.globalAlpha = 1.0;
  };

  const drawAsteroidVisualBody = (ctx: CanvasRenderingContext2D, radius: number, type: string) => {
    // Generate beautiful colored circles representing asteroid textures
    const astColor = type === 'magma' ? '#270c0c' : type === 'frost' ? '#082f49' : type === 'crystal' ? '#1e1b4b' : '#1e293b';
    const borderCol = type === 'magma' ? '#ef4444' : type === 'frost' ? '#38bdf8' : type === 'crystal' ? '#c084fc' : '#475569';

    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 5;
    ctx.fillStyle = astColor;

    // Draw main circle
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw gorgeous micro craters / patterns within asteroid
    ctx.fillStyle = type === 'magma' ? '#451a03' : type === 'frost' ? '#075985' : type === 'crystal' ? '#3b0764' : '#334155';
    for (let i = 0; i < 6; i++) {
      const craterAngle = (i * Math.PI / 3) + 0.2;
      const craterDist = radius * 0.5;
      const cx = Math.cos(craterAngle) * craterDist;
      const cy = Math.sin(craterAngle) * craterDist;
      const cRad = 15 + (i * 3) % 12;

      ctx.beginPath();
      ctx.arc(cx, cy, cRad, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 bg-[#020617]/95 flex flex-col md:flex-row relative">
      
      {/* 1. LEFT UTILITY DASHBOARD PANEL */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 bg-[#030712] p-4 flex flex-col justify-between select-none font-mono text-xs text-slate-300">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-sm font-extrabold text-slate-100 uppercase tracking-widest leading-none">PRŮZKUM POVRCHU</span>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400 font-sans">
            Mise: <b>{asteroidName}</b>. Vstoupil jsi na krystalický planetoid s kruhovou gravitací v malém magnetickém obleku s jetpackem!
          </p>

          {/* OXYGEN METERS BAR */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
              <span>🔋 ŽIVOTNÍ SYSTÉMY KOSMONAUTA</span>
              <span className={oxygen < 30 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}>{Math.round(oxygen)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-100 ${
                  oxygen < 30 ? 'bg-red-500 animate-pulse' : 'bg-cyan-500'
                }`}
                style={{ width: `${oxygen}%` }}
              />
            </div>
            {oxygen < 100 && (
              <span className="text-[9px] text-cyan-500 mt-1">💡 Vrať se k lodi (top pad) pro kompletní doplnění kyslíku.</span>
            )}
          </div>

          {/* GATHERED MINERALS COUNTER */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">📦 NASBÍRANÉ MINERÁLY V BATOHU</span>
            
            <div className="flex justify-between items-center bg-slate-900/40 p-1.5 rounded">
              <span className="text-emerald-400 font-bold">● Zelené Krystaly:</span>
              <span className="text-slate-100 font-bold text-sm font-mono">{cargo.crystal}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/40 p-1.5 rounded">
              <span className="text-sky-400 font-bold">● Ledové Diamanty:</span>
              <span className="text-slate-100 font-bold text-sm font-mono">{cargo.diamond}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/40 p-1.5 rounded">
              <span className="text-rose-500 font-bold">● Magmatický Obsidián:</span>
              <span className="text-slate-100 font-bold text-sm font-mono">{cargo.obsidian}</span>
            </div>
          </div>

          {/* MINING PROGRESS LISTINGS */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Zbývající žíly k vytěžení:</span>
            <span className="bg-amber-500/15 text-amber-300 font-bold px-2 py-0.5 rounded text-xs leading-none border border-amber-500/25">
              {minedNodesRemaining} / 4
            </span>
          </div>

        </div>

        {/* BOTTOM EXIT ACTIONS PANEL */}
        <div className="flex flex-col gap-2 mt-4 md:mt-0">
          <button 
            type="button"
            onClick={handleLaunchComplete}
            className="w-full bg-cyan-700 hover:bg-cyan-600 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl border border-cyan-500 shadow-lg shadow-cyan-950/40 transition-all font-sans uppercase tracking-wider"
          >
            🚀 Nastoupit a odletět
          </button>
          
          <button 
            type="button"
            onClick={() => setExplorerInstructions(!explorerInstructions)}
            className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 text-[10px] py-1.5 px-3 rounded-lg border border-slate-800 transition-all font-sans"
          >
            {explorerInstructions ? 'Skrýt instrukce' : 'Zobrazit instrukce'}
          </button>
        </div>
      </div>

      {/* 2. MAIN 2D CIRCULAR GRAVITY EXPLORER VIEW SCREEN */}
      <div 
        ref={containerRef}
        className="flex-1 bg-slate-950 relative"
      >
        <canvas 
          ref={canvasRef}
          className="absolute inset-0 block w-full h-full cursor-crosshair"
        />

        {/* FLOAT NOTIFICATION SYSTEM */}
        <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-2 select-none z-50">
          {notifications.map(n => (
            <div 
              key={n.id}
              className="px-3 py-1.5 rounded-lg border bg-slate-950/90 text-xs font-bold leading-none animate-bounce shadow-xl"
              style={{ color: n.color, borderColor: `${n.color}25` }}
            >
              {n.text}
            </div>
          ))}
        </div>

        {/* EXPLORER QUICK INSTRUCTIONS HOVER BANNER */}
        {explorerInstructions && (
          <div className="absolute right-4 bottom-4 max-w-[280px] bg-slate-950/90 border border-slate-800 p-3 rounded-xl shadow-xl font-mono text-[10px] text-slate-300 pointer-events-auto select-none">
            <span className="font-sans font-extrabold text-xs text-amber-400 uppercase tracking-wider block mb-1">🎮 JAK OVLÁDAT KOSMONAUTA</span>
            
            <ul className="flex flex-col gap-1 list-disc list-inside text-slate-400">
              <li><b>A / D / Šipky:</b> Chůze kolem dokola</li>
              <li><b>Mezerník / W:</b> Skok do nízké gravitace</li>
              <li><b>Podržení [E] / Klik:</b> Těžit drahokamy ze žil</li>
              <li><b>Návrat k lodi (nahoře):</b> Stiskni [E] pro návrat do akce</li>
              <li><b>Pozor:</b> Magma ventily 🌋 a padající meteory ☄️ ničí oblek!</li>
            </ul>
          </div>
        )}
      </div>

    </div>
  );
}
