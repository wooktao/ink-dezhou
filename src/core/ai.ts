import { GameState, PlayerAction } from '../types/index.js';

export function getAiAction(playerId: string, state: GameState): { type: PlayerAction, amount?: number } {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { type: 'fold' };

  const callAmount = state.currentMaxBet - player.currentBet;

  if (callAmount === 0) {
    return { type: 'check' };
  } else {
    // Simple AI: Always calls for now
    // In a real game, it might fold if callAmount > some threshold
    return { type: 'call' };
  }
}
