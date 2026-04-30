import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { io } from 'socket.io-client';
import { GamePhase } from '../types/index.js';
const SUIT_COLORS = {
    '♠': 'white',
    '♥': 'red',
    '♣': 'green',
    '♦': 'blue',
};
const CardView = ({ card, selected, dim }) => {
    const color = SUIT_COLORS[card.suit] || 'white';
    const rankStr = rankMap[card.rank] || card.rank.toString();
    return (React.createElement(Box, { borderStyle: "round", borderColor: selected ? 'yellow' : (dim ? 'gray' : 'white'), paddingX: 1, marginRight: 1, flexDirection: "column", width: 7, height: 3 },
        React.createElement(Box, { justifyContent: "space-between" },
            React.createElement(Text, { color: color, bold: true }, rankStr),
            React.createElement(Text, { color: color }, card.suit))));
};
const CardBack = ({ dim }) => (React.createElement(Box, { borderStyle: "round", borderColor: dim ? 'gray' : 'blue', width: 4, height: 3, alignItems: "center", justifyContent: "center", marginRight: 1 },
    React.createElement(Text, { color: dim ? 'gray' : 'blue' }, "\u2591")));
const PlayerBadge = ({ player, isCurrent, showCards }) => {
    let statusColor = 'white';
    if (player.isFolded)
        statusColor = 'gray';
    else if (isCurrent)
        statusColor = 'yellow';
    return (React.createElement(Box, { flexDirection: "column", alignItems: "center", marginX: 1, minWidth: 14 },
        React.createElement(Box, { borderStyle: isCurrent ? 'double' : 'round', borderColor: statusColor, paddingX: 1, flexDirection: "column", width: "100%" },
            React.createElement(Text, { bold: true, color: statusColor, wrap: "truncate-end" }, player.name),
            React.createElement(Text, { color: "yellow" },
                "\uD83D\uDCB0",
                player.chips),
            React.createElement(Text, { color: "cyan" },
                "B:",
                player.currentBet)),
        React.createElement(Box, { height: 3, alignItems: "center", justifyContent: "center" }, !player.isFolded ? (React.createElement(Box, null, showCards ? (player.cards.map((c, i) => (React.createElement(Box, { key: i, borderStyle: "single", borderColor: SUIT_COLORS[c.suit], paddingX: 1, marginRight: 1 },
            React.createElement(Text, { color: SUIT_COLORS[c.suit] },
                rankMap[c.rank] || c.rank,
                c.suit))))) : (React.createElement(React.Fragment, null,
            React.createElement(CardBack, null),
            React.createElement(CardBack, null))))) : (React.createElement(Text, { color: "red", dimColor: true }, "FOLD"))),
        React.createElement(Text, { color: player.lastAction === 'fold' ? 'red' : 'green', dimColor: true }, player.lastAction?.toUpperCase() || '')));
};
const rankMap = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const App = ({ host, port, playerName }) => {
    const [socket, setSocket] = useState(null);
    const [state, setState] = useState(null);
    const { exit } = useApp();
    useEffect(() => {
        const s = io(`http://${host}:${port}`);
        setSocket(s);
        s.on('connect', () => { s.emit('join', playerName); });
        s.on('state', (newState) => { setState(newState); });
        return () => { s.close(); };
    }, [host, port, playerName]);
    useInput((input, key) => {
        if (key.escape)
            exit();
        if (state?.phase === GamePhase.GameOver && (input === 'r' || key.return)) {
            socket?.emit('restart');
        }
    });
    if (!state)
        return React.createElement(Box, { padding: 1 },
            React.createElement(Text, null, "Connecting..."));
    const me = state.players.find(p => p.id === socket?.id);
    const otherPlayers = state.players.filter(p => p.id !== socket?.id);
    const getActionItems = () => {
        if (!me)
            return [];
        const items = [];
        const callAmount = state.currentMaxBet - me.currentBet;
        if (callAmount === 0)
            items.push({ label: 'Check', value: 'check' });
        else
            items.push({ label: `Call(${callAmount})`, value: 'call' });
        items.push({ label: 'Raise', value: 'raise' }, { label: 'Fold', value: 'fold' });
        return items;
    };
    return (React.createElement(Box, { flexDirection: "column", width: 110, height: 35, padding: 0, borderStyle: "double", borderColor: "white" },
        React.createElement(Box, { justifyContent: "space-between", paddingX: 1, borderStyle: "single", borderColor: "blue", height: 3 },
            React.createElement(Text, { bold: true, color: "cyan" }, "\uD83C\uDCCF POKER TERMINAL"),
            React.createElement(Box, null,
                React.createElement(Text, { color: "magenta", bold: true }, state.phase.toUpperCase()),
                React.createElement(Text, { color: "yellow", bold: true },
                    " \uD83D\uDCB0POT: ",
                    state.pot))),
        React.createElement(Box, { flexGrow: 1, flexDirection: "row" },
            React.createElement(Box, { flexDirection: "column", width: "70%", borderStyle: "round", borderColor: "green", padding: 0 },
                React.createElement(Box, { justifyContent: "center", height: 10 }, otherPlayers.map(p => (React.createElement(PlayerBadge, { key: p.id, player: p, isCurrent: state.currentTurnId === p.id, showCards: state.phase === GamePhase.GameOver })))),
                React.createElement(Box, { flexGrow: 1, flexDirection: "column", alignItems: "center", justifyContent: "center" },
                    React.createElement(Box, { borderStyle: "single", borderColor: "green", paddingX: 1, height: 5, alignItems: "center" }, state.communityCards.length > 0 ? (state.communityCards.map((c, i) => React.createElement(CardView, { key: i, card: c }))) : (React.createElement(Text, { dimColor: true }, "COMMUNITY CARDS")))),
                React.createElement(Box, { height: 5, justifyContent: "center", alignItems: "center", borderStyle: "classic", borderColor: "yellow" }, state.phase === GamePhase.GameOver && state.winnerIds ? (React.createElement(Text, { bold: true, color: "yellow" },
                    "\uD83C\uDF89 WINNER: ",
                    state.winnerIds.map(id => state.players.find(p => p.id === id)?.name).join(', '))) : (state.currentTurnId === socket?.id && !me?.isFolded ? (React.createElement(Box, null,
                    React.createElement(Text, { bold: true, color: "yellow" }, "YOUR TURN: "),
                    React.createElement(SelectInput, { items: getActionItems(), onSelect: (item) => {
                            const action = item.value === 'raise' ? { type: 'raise', amount: state.currentMaxBet + state.bigBlind } : { type: item.value };
                            socket?.emit('action', action);
                        } }))) : React.createElement(Text, { dimColor: true }, "Waiting for action...")))),
            React.createElement(Box, { width: "30%", borderStyle: "round", borderColor: "gray", flexDirection: "column", paddingX: 1 },
                React.createElement(Text, { bold: true, color: "white", underline: true }, "GAME LOGS"),
                state.logs.map((log, i) => (React.createElement(Text, { key: i, dimColor: true, wrap: "wrap" },
                    "\u203A ",
                    log))))),
        React.createElement(Box, { height: 6, borderStyle: "bold", borderColor: state.currentTurnId === me?.id ? 'yellow' : 'cyan', paddingX: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
            React.createElement(Box, { flexDirection: "column" },
                React.createElement(Text, { bold: true, color: state.currentTurnId === me?.id ? 'yellow' : 'white' },
                    me?.name || 'Unknown',
                    " ",
                    me?.isFolded ? '(FOLDED)' : ''),
                React.createElement(Text, null,
                    "\u7B79\u7801: \uD83D\uDCB0",
                    me?.chips || 0),
                React.createElement(Text, null,
                    "\u5F53\u524D\u4E0B\u6CE8: \uD83D\uDCB8",
                    me?.currentBet || 0)),
            React.createElement(Box, null, me?.cards.map((c, i) => (React.createElement(CardView, { key: i, card: c })))),
            React.createElement(Box, { width: 30, borderStyle: "single", borderColor: "magenta", paddingX: 1, height: 4 },
                React.createElement(Text, { color: "magenta", italic: true }, me?.id === state.currentTurnId ? 'Thinking...' : 'Waiting...')))));
};
