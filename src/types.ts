export type WaterInteractionMode = 'ripple' | 'stone' | 'feed' | 'wind';

export type AmbientLighting = 'day' | 'sunset' | 'night';

export type RainIntensity = 'none' | 'light' | 'medium';
export type QualityProfile = 'economy' | 'balanced' | 'immersive';
export type QualityMode = QualityProfile | 'auto';
export type PondEnvironment = 'japanese_garden' | 'mountain_spring' | 'tropical_lagoon' | 'moonlit_marsh';

export interface WaterSimConfig {
  damping: number; // 0.980 - 0.998
  refractionStrength: number;
  sunlightIntensity: number;
  causticsIntensity: number;
  rainIntensity: RainIntensity;
  showFish: boolean;
  showLeaves: boolean;
  ambient: AmbientLighting;
  soundEnabled: boolean;
  mode: WaterInteractionMode;
  windActive: boolean;
  quality: QualityMode;
  environment: PondEnvironment;
}

export interface KoiFishData {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  maxSpeed: number;
  angle: number;
  targetAngle: number;
  size: number;
  variety: 'kohaku' | 'yamabuki' | 'sanke' | 'shiro_bekko';
  bodyPoints: { x: number; y: number }[];
  spineLength: number;
  wigglePhase: number;
  wiggleSpeed: number;
  isFrightened: boolean;
  frightenedTimer: number;
}

export interface FloatingLeaf {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  angle: number;
  rotationSpeed: number;
  type: 'lily_pad' | 'pink_lotus' | 'white_lotus' | 'cherry_petal' | 'autumn_leaf';
  driftSpeedX: number;
  driftSpeedY: number;
  swayOffset: number;
}

export interface FoodPellet {
  id: number;
  x: number;
  y: number;
  birthTime: number;
  life: number; // 0 to 1
  consumed: boolean;
}

export interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
}

/** A single visible raindrop streak on the 2D overlay canvas */
export interface RainDrop {
  x: number;
  y: number;
  vy: number; // fall speed (px/frame)
  length: number;
  alpha: number;
  life: number;
  maxLife: number;
}
