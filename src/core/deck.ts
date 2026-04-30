import { Card, Rank, Suit } from '../types/index.js';

export function generateDeck(): Card[] {
  const deck: Card[] = [];
  const suits = [Suit.Spade, Suit.Heart, Suit.Club, Suit.Diamond];
  const ranks = [
    Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
    Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
    Rank.King, Rank.Ace
  ];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }

  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) {
      return b.rank - a.rank; // Higher rank first
    }
    return a.suit.localeCompare(b.suit);
  });
}
