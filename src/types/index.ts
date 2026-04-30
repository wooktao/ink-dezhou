export enum Suit {
  Spade = '♠',
  Heart = '♥',
  Club = '♣',
  Diamond = '♦',
}

export enum Rank {
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
}

export interface Card {
  suit: Suit;
  rank: Rank;
}

export enum GamePhase {
  Waiting = 'Waiting',
  PreFlop = 'PreFlop',
  Flop = 'Flop',
  Turn = 'Turn',
  River = 'River',
  Showdown = 'Showdown',
  GameOver = 'GameOver',
}

export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'waiting' | 'all-in';

export interface Player {
  id: string;
  name: string;
  cards: Card[];
  chips: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  lastAction?: PlayerAction;
  thought?: string;
  isAi: boolean;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentTurnId: string | null;
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  currentMaxBet: number;
  winnerIds: string[] | null;
  logs: string[];
}
