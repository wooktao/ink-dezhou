import { Server, Socket } from 'socket.io';
import { GameState, GamePhase, Player, Card, PlayerAction } from '../types/index.js';
import { generateDeck, shuffleDeck, sortCards } from '../core/deck.js';
import { evaluateHand, compareHands } from '../core/rules.js';
import { getAiAction } from '../core/ai.js';
import { QwenAiAgent } from '../core/qwen.js';
import { nanoid } from 'nanoid';
import * as dotenv from 'dotenv';

dotenv.config();

export class GameServer {
  private io: Server;
  private state: GameState;
  private sockets: Map<string, Socket> = new Map();
  private qwen: QwenAiAgent | null = null;
  private deck: Card[] = [];

  constructor(io: Server) {
    this.io = io;
    this.state = this.initialState();
    if (process.env.QWEN_API_KEY) {
      this.qwen = new QwenAiAgent(process.env.QWEN_API_KEY);
      console.log('Qwen AI enabled');
    }
    this.setupIO();
  }

  private initialState(): GameState {
    return {
      phase: GamePhase.Waiting,
      players: [],
      communityCards: [],
      pot: 0,
      currentTurnId: null,
      dealerIndex: 0,
      smallBlind: 10,
      bigBlind: 20,
      currentMaxBet: 0,
      winnerIds: null,
      logs: ['Waiting for players...'],
    };
  }

  private addLog(msg: string) {
    this.state.logs.push(msg);
    if (this.state.logs.length > 10) {
      this.state.logs.shift();
    }
  }

  private setupIO() {
    this.io.on('connection', (socket: Socket) => {
      console.log('Player connected:', socket.id);
      
      socket.on('join', (name: string) => {
        if (this.state.players.length >= 6) {
          socket.emit('error', 'Game is full');
          return;
        }

        const player: Player = {
          id: socket.id,
          name,
          cards: [],
          chips: 1000,
          currentBet: 0,
          isFolded: false,
          isAllIn: false,
          isAi: false,
        };

        this.state.players.push(player);
        this.sockets.set(socket.id, socket);
        this.addLog(`${name} joined the game.`);
        this.broadcastState();

        if (this.state.players.length >= 3 && this.state.phase === GamePhase.Waiting) {
          this.startNewHand();
        }
      });

      socket.on('action', (action: { type: PlayerAction, amount?: number }) => {
        this.handlePlayerAction(socket.id, action);
      });

      socket.on('restart', () => {
        if (this.state.phase === GamePhase.GameOver) {
          this.resetGame();
        }
      });

      socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        this.sockets.delete(socket.id);
        // In a real game, we'd handle player leaving better (e.g. fold them)
      });
    });
  }

  private startNewHand() {
    this.addLog('--- New Hand Starting ---');
    this.deck = shuffleDeck(generateDeck());
    this.state.phase = GamePhase.PreFlop;
    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.currentMaxBet = this.state.bigBlind;
    this.state.winnerIds = null;

    // Reset players
    this.state.players.forEach(p => {
      p.cards = [this.deck.pop()!, this.deck.pop()!];
      p.currentBet = 0;
      p.isFolded = false;
      p.isAllIn = false;
      p.lastAction = undefined;
      p.thought = undefined;
    });

    // Blinds
    const sbIndex = (this.state.dealerIndex + 1) % this.state.players.length;
    const bbIndex = (this.state.dealerIndex + 2) % this.state.players.length;
    
    this.postBet(this.state.players[sbIndex], this.state.smallBlind);
    this.postBet(this.state.players[bbIndex], this.state.bigBlind);

    this.state.currentTurnId = this.state.players[(bbIndex + 1) % this.state.players.length].id;
    this.broadcastState();
  }

  private postBet(player: Player, amount: number) {
    const actualAmount = Math.min(player.chips, amount);
    player.chips -= actualAmount;
    player.currentBet += actualAmount;
    this.state.pot += actualAmount;
    if (player.chips === 0) player.isAllIn = true;
    if (player.currentBet > this.state.currentMaxBet) {
      this.state.currentMaxBet = player.currentBet;
    }
  }

  private handlePlayerAction(playerId: string, action: { type: PlayerAction, amount?: number, reasoning?: string }) {
    if (this.state.currentTurnId !== playerId) return;

    const player = this.state.players.find(p => p.id === playerId)!;
    const logMsg = action.reasoning ? `[AI] ${player.name}: ${action.type}${action.amount ? ' ' + action.amount : ''} (${action.reasoning})` : `${player.name}: ${action.type}${action.amount ? ' ' + action.amount : ''}`;
    this.addLog(logMsg);
    
    switch (action.type) {
      case 'fold':
        player.isFolded = true;
        player.lastAction = 'fold';
        break;
      case 'check':
        if (player.currentBet < this.state.currentMaxBet) return; // Cannot check if there's a bet to call
        player.lastAction = 'check';
        break;
      case 'call':
        const callAmount = this.state.currentMaxBet - player.currentBet;
        this.postBet(player, callAmount);
        player.lastAction = 'call';
        break;
      case 'raise':
        const raiseTo = action.amount || (this.state.currentMaxBet + this.state.bigBlind);
        const raiseAmount = raiseTo - player.currentBet;
        if (raiseAmount <= 0 || raiseTo <= this.state.currentMaxBet) return;
        this.postBet(player, raiseAmount);
        player.lastAction = 'raise';
        break;
    }

    this.nextTurn();
  }

  private nextTurn() {
    const activePlayers = this.state.players.filter(p => !p.isFolded && !p.isAllIn);
    
    // Check if hand ended (only one player left)
    const playersInHand = this.state.players.filter(p => !p.isFolded);
    if (playersInHand.length === 1) {
      this.endHand([playersInHand[0].id]);
      return;
    }

    // Check if betting round is over
    const allCalled = playersInHand.every(p => p.isAllIn || p.currentBet === this.state.currentMaxBet);
    const everyoneActed = playersInHand.every(p => p.lastAction !== undefined);

    if (allCalled && (everyoneActed || this.state.phase === GamePhase.PreFlop)) {
       // Transition to next phase
       this.nextPhase();
    } else {
      // Find next player
      const currentIndex = this.state.players.findIndex(p => p.id === this.state.currentTurnId);
      let nextIndex = (currentIndex + 1) % this.state.players.length;
      while (this.state.players[nextIndex].isFolded || this.state.players[nextIndex].isAllIn) {
        nextIndex = (nextIndex + 1) % this.state.players.length;
      }
      this.state.currentTurnId = this.state.players[nextIndex].id;
      this.broadcastState();
    }
  }

  private nextPhase() {
    // Reset player actions for next round
    this.state.players.forEach(p => {
      if (!p.isFolded) {
        p.lastAction = undefined;
        p.thought = undefined;
      }
    });

    switch (this.state.phase) {
      case GamePhase.PreFlop:
        this.state.phase = GamePhase.Flop;
        this.addLog('Phase: FLOP');
        this.state.communityCards.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
        break;
      case GamePhase.Flop:
        this.state.phase = GamePhase.Turn;
        this.addLog('Phase: TURN');
        this.state.communityCards.push(this.deck.pop()!);
        break;
      case GamePhase.Turn:
        this.state.phase = GamePhase.River;
        this.addLog('Phase: RIVER');
        this.state.communityCards.push(this.deck.pop()!);
        break;
      case GamePhase.River:
        this.state.phase = GamePhase.Showdown;
        this.addLog('Phase: SHOWDOWN');
        this.determineWinners();
        return;
    }

    this.state.currentTurnId = this.state.players[(this.state.dealerIndex + 1) % this.state.players.length].id;
    // Ensure the first player to act isn't folded/all-in
    if (this.state.players.find(p => p.id === this.state.currentTurnId)!.isFolded || this.state.players.find(p => p.id === this.state.currentTurnId)!.isAllIn) {
        // Simple logic to find next active player
        const active = this.state.players.filter(p => !p.isFolded && !p.isAllIn);
        if (active.length > 0) this.state.currentTurnId = active[0].id;
    }

    this.broadcastState();
  }

  private determineWinners() {
    const playersInHand = this.state.players.filter(p => !p.isFolded);
    const evaluations = playersInHand.map(p => ({
      playerId: p.id,
      eval: evaluateHand([...p.cards, ...this.state.communityCards])
    }));

    evaluations.sort((a, b) => compareHands(b.eval, a.eval));
    
    const winners = [evaluations[0].playerId];
    for (let i = 1; i < evaluations.length; i++) {
      if (compareHands(evaluations[i].eval, evaluations[0].eval) === 0) {
        winners.push(evaluations[i].playerId);
      } else {
        break;
      }
    }

    this.endHand(winners);
  }

  private endHand(winnerIds: string[]) {
    this.state.winnerIds = winnerIds;
    const share = Math.floor(this.state.pot / winnerIds.length);
    winnerIds.forEach(id => {
      const p = this.state.players.find(player => player.id === id)!;
      p.chips += share;
    });
    this.state.pot = 0;
    this.state.phase = GamePhase.GameOver;
    this.state.dealerIndex = (this.state.dealerIndex + 1) % this.state.players.length;
    this.broadcastState();

    // Auto restart after 5 seconds
    setTimeout(() => {
      if (this.state.players.length >= 3) this.startNewHand();
      else this.state.phase = GamePhase.Waiting;
    }, 5000);
  }

  private resetGame() {
    this.state = this.initialState();
    this.broadcastState();
  }

  private broadcastState() {
    this.io.emit('state', this.state);
    this.checkAiTurn();
  }

  private async checkAiTurn() {
    if (this.state.phase === GamePhase.GameOver || this.state.phase === GamePhase.Waiting) return;
    
    const currentPlayer = this.state.players.find(p => p.id === this.state.currentTurnId);
    if (currentPlayer && currentPlayer.isAi) {
      const delay = this.qwen ? 3000 : 1500;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      if (this.qwen) {
        const decision = await this.qwen.decideAction(currentPlayer.id, this.state);
        
        if (typeof decision === 'string') {
          console.error(`AI Turn Failed: ${decision}`);
          return;
        }

        if (decision) {
          this.handlePlayerAction(currentPlayer.id, decision);
          return;
        }
        
        console.error('AI Turn Failed: Qwen returned null or invalid decision format.');
        return;
      }

      // Local AI (only used if Qwen is NOT enabled)
      const action = getAiAction(currentPlayer.id, this.state);
      this.handlePlayerAction(currentPlayer.id, action);
    }
  }

  public addAiPlayer(name: string) {
    if (this.state.players.length >= 6) return;
    const player: Player = {
      id: 'ai-' + nanoid(),
      name,
      cards: [],
      chips: 1000,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
      isAi: true,
    };
    this.state.players.push(player);
  }
}
