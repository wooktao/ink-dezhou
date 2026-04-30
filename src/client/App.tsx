import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { io, Socket } from 'socket.io-client';
import { GameState, GamePhase, Player, Card, PlayerAction } from '../types/index.js';

const SUIT_COLORS: Record<string, string> = {
  '♠': 'white',
  '♥': 'red',
  '♣': 'green',
  '♦': 'blue',
};

const CardView = ({ card, selected, dim }: { card: Card; selected?: boolean; dim?: boolean }) => {
  const color = SUIT_COLORS[card.suit] || 'white';
  const rankStr = rankMap[card.rank] || card.rank.toString();
  
  return (
    <Box 
      borderStyle="round" 
      borderColor={selected ? 'yellow' : (dim ? 'gray' : 'white')} 
      paddingX={1} 
      marginRight={1}
      flexDirection="column"
      width={7}
      height={3}
    >
      <Box justifyContent="space-between">
        <Text color={color as any} bold>{rankStr}</Text>
        <Text color={color as any}>{card.suit}</Text>
      </Box>
    </Box>
  );
};

const CardBack = ({ dim }: { dim?: boolean }) => (
  <Box 
    borderStyle="round" 
    borderColor={dim ? 'gray' : 'blue'} 
    width={4}
    height={3}
    alignItems="center"
    justifyContent="center"
    marginRight={1}
  >
    <Text color={dim ? 'gray' : 'blue'}>░</Text>
  </Box>
);

const PlayerBadge = ({ player, isCurrent, showCards, isDealer }: { 
  player: Player; 
  isCurrent: boolean; 
  showCards: boolean;
  isDealer: boolean;
}) => {
  let statusColor = 'white';
  if (player.isFolded) statusColor = 'gray';
  else if (isCurrent) statusColor = 'yellow';

  return (
    <Box flexDirection="column" alignItems="center" marginX={1} minWidth={14}>
      <Box 
        borderStyle={isCurrent ? 'double' : 'round'} 
        borderColor={statusColor as any} 
        paddingX={1} 
        flexDirection="column"
        width="100%"
      >
        <Box justifyContent="space-between">
          <Text bold color={statusColor as any} wrap="truncate-end">
            {isDealer ? '👑 ' : ''}{player.name}
          </Text>
        </Box>
        <Text color="yellow">💰{player.chips}</Text>
        <Text color="cyan">B:{player.currentBet}</Text>
      </Box>
      
      <Box height={3} alignItems="center" justifyContent="center">
        {!player.isFolded ? (
          <Box>
            {showCards ? (
              player.cards.map((c, i) => (
                <Box 
                  key={i} 
                  borderStyle="single" 
                  borderColor={SUIT_COLORS[c.suit] as any} 
                  paddingX={1} 
                  marginRight={1}
                >
                  <Text color={SUIT_COLORS[c.suit] as any}>{rankMap[c.rank] || c.rank}{c.suit}</Text>
                </Box>
              ))
            ) : (
              <>
                <CardBack />
                <CardBack />
              </>
            )}
          </Box>
        ) : (
          <Text color="red" dimColor>FOLD</Text>
        )}
      </Box>
      <Text color={player.lastAction === 'fold' ? 'red' : 'green'} dimColor>
        {player.lastAction?.toUpperCase() || ''}
      </Text>
    </Box>
  );
};

const rankMap: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export const App = ({ host, port, playerName }: { host: string; port: number; playerName: string }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [isRaising, setIsRaising] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState('');
  const { exit } = useApp();

  useEffect(() => {
    const s = io(`http://${host}:${port}`);
    setSocket(s);
    s.on('connect', () => { s.emit('join', playerName); });
    s.on('state', (newState: GameState) => { 
      setState(newState);
      // Reset raising state if it's no longer our turn
      if (newState.currentTurnId !== s.id) {
        setIsRaising(false);
        setRaiseAmount('');
      }
    });
    return () => { s.close(); };
  }, [host, port, playerName]);

  useInput((input, key) => {
    if (key.escape) {
      if (isRaising) {
        setIsRaising(false);
        setRaiseAmount('');
      } else {
        exit();
      }
    }
    if (state?.phase === GamePhase.GameOver && (input === 'r' || key.return)) {
      socket?.emit('restart');
    }
  });

  if (!state) return <Box padding={1}><Text>Connecting...</Text></Box>;

  const me = state.players.find(p => p.id === socket?.id);
  const otherPlayers = state.players.filter(p => p.id !== socket?.id);

  const getActionItems = () => {
    if (!me) return [];
    const items = [];
    const callAmount = state.currentMaxBet - me.currentBet;
    if (callAmount === 0) items.push({ label: 'Check', value: 'check' });
    else items.push({ label: `Call(${callAmount})`, value: 'call' });
    items.push({ label: 'Raise', value: 'raise' }, { label: 'Fold', value: 'fold' });
    return items;
  };

  return (
    <Box flexDirection="column" width={110} height={35} padding={0} borderStyle="double" borderColor="white">
      {/* Top Bar */}
      <Box justifyContent="space-between" paddingX={1} borderStyle="single" borderColor="blue" height={3}>
        <Text bold color="cyan">🃏 POKER TERMINAL</Text>
        <Box>
          <Text color="magenta" bold>{state.phase.toUpperCase()}</Text>
          <Text color="yellow" bold> 💰POT: {state.pot}</Text>
        </Box>
      </Box>

      {/* Main Content: Table + Logs */}
      <Box flexGrow={1} flexDirection="row">
        {/* Left: Table Area */}
        <Box flexDirection="column" width="70%" borderStyle="round" borderColor="green" padding={0}>
          {/* Opponents */}
          <Box justifyContent="center" height={10}>
            {otherPlayers.map(p => (
              <PlayerBadge 
                key={p.id} 
                player={p} 
                isCurrent={state.currentTurnId === p.id} 
                showCards={state.phase === GamePhase.GameOver}
                isDealer={state.players[state.dealerIndex]?.id === p.id}
              />
            ))}
          </Box>

          {/* Table Center */}
          <Box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
            <Box borderStyle="single" borderColor="green" paddingX={1} height={5} alignItems="center">
              {state.communityCards.length > 0 ? (
                state.communityCards.map((c, i) => <CardView key={i} card={c} />)
              ) : (
                <Text dimColor>COMMUNITY CARDS</Text>
              )}
            </Box>
          </Box>

          {/* Action Box */}
          <Box height={5} justifyContent="center" alignItems="center" borderStyle="classic" borderColor="yellow">
            {state.phase === GamePhase.GameOver && state.winnerIds ? (
              <Box flexDirection="column" alignItems="center">
                <Text bold color="yellow">🎉 WINNER: {state.winnerIds.map(id => state.players.find(p => p.id === id)?.name).join(', ')}</Text>
                <Text color="green" bold>按 [ENTER] 或 [R] 开始下一局</Text>
              </Box>
            ) : (
              state.currentTurnId === socket?.id && !me?.isFolded ? (
                isRaising ? (
                  <Box flexDirection="column" alignItems="center">
                    <Text bold color="yellow">请输入加注总额 (最小: {state.currentMaxBet + state.bigBlind}, 你的筹码: {me?.chips}):</Text>
                    <Box borderStyle="round" borderColor="cyan" paddingX={1}>
                      <TextInput 
                        value={raiseAmount} 
                        onChange={setRaiseAmount} 
                        onSubmit={(val) => {
                          const amount = parseInt(val);
                          const minRaise = state.currentMaxBet + state.bigBlind;
                          if (!isNaN(amount) && amount >= minRaise && amount <= (me?.chips || 0) + (me?.currentBet || 0)) {
                            socket?.emit('action', { type: 'raise', amount });
                            setIsRaising(false);
                            setRaiseAmount('');
                          }
                        }}
                      />
                    </Box>
                    <Text dimColor>按 ESC 取消</Text>
                  </Box>
                ) : (
                  <Box>
                    <Text bold color="yellow">YOUR TURN: </Text>
                    <SelectInput items={getActionItems()} onSelect={(item) => {
                      if (item.value === 'raise') {
                        setIsRaising(true);
                        setRaiseAmount((state.currentMaxBet + state.bigBlind).toString());
                      } else {
                        socket?.emit('action', { type: item.value });
                      }
                    }} />
                  </Box>
                )
              ) : <Text dimColor>Waiting for action...</Text>
            )}
          </Box>
        </Box>

        {/* Right: Log Panel */}
        <Box width="30%" borderStyle="round" borderColor="gray" flexDirection="column" paddingX={1}>
          <Text bold color="white" underline>GAME LOGS</Text>
          {state.logs.map((log, i) => (
            <Text key={i} dimColor wrap="wrap">› {log}</Text>
          ))}
        </Box>
      </Box>

      {/* Bottom: My Hand - Fixed position at the bottom */}
      <Box 
        height={6}
        borderStyle="bold" 
        borderColor={state.currentTurnId === me?.id ? 'yellow' : 'cyan'} 
        paddingX={2}
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box flexDirection="column">
          <Text bold color={state.currentTurnId === me?.id ? 'yellow' : 'white'}>
            {state.players[state.dealerIndex]?.id === me?.id ? '👑 ' : ''}
            {me?.name || 'Unknown'} {me?.isFolded ? '(FOLDED)' : ''}
          </Text>
          <Text>筹码: 💰{me?.chips || 0}</Text>
          <Text>当前下注: 💸{me?.currentBet || 0}</Text>
        </Box>
        
        <Box>
          {me?.cards.map((c, i) => (
            <CardView key={i} card={c} />
          ))}
        </Box>

        <Box width={30} borderStyle="single" borderColor="magenta" paddingX={1} height={4}>
          <Text color="magenta" italic>
            {me?.id === state.currentTurnId ? 'Thinking...' : 'Waiting...'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
