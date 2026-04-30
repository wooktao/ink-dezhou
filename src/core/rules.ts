import { Card, Rank } from '../types/index.js';

export enum HandRank {
  HighCard = 1,
  Pair = 2,
  TwoPair = 3,
  ThreeOfAKind = 4,
  Straight = 5,
  Flush = 6,
  FullHouse = 7,
  FourOfAKind = 8,
  StraightFlush = 9,
  RoyalFlush = 10,
}

export interface HandEvaluation {
  rank: HandRank;
  value: number; // A numeric value for comparison within the same rank
  cards: Card[]; // The 5 cards that make up the hand
}

export function evaluateHand(cards: Card[]): HandEvaluation {
  // Out of 7 cards, find the best 5-card combination
  const allCombos = getCombinations(cards, 5);
  let bestHand: HandEvaluation | null = null;

  for (const combo of allCombos) {
    const evaluation = evaluateFiveCards(combo);
    if (!bestHand || compareHands(evaluation, bestHand) > 0) {
      bestHand = evaluation;
    }
  }

  return bestHand!;
}

function getCombinations<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  function helper(start: number, combo: T[]) {
    if (combo.length === size) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      combo.push(array[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return result;
}

function evaluateFiveCards(cards: Card[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const isFlush = sorted.every(c => c.suit === sorted[0].suit);
  
  // Check for Straight
  let isStraight = true;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].rank !== sorted[i+1].rank + 1) {
      isStraight = false;
      break;
    }
  }
  // Special case: A-5 straight
  if (!isStraight && sorted[0].rank === Rank.Ace && sorted[1].rank === Rank.Five && sorted[2].rank === Rank.Four && sorted[3].rank === Rank.Three && sorted[4].rank === Rank.Two) {
    isStraight = true;
    // Move Ace to end for value calculation if needed, but for rank it's a straight
  }

  const counts: Record<number, number> = {};
  for (const c of cards) counts[c.rank] = (counts[c.rank] || 0) + 1;
  const uniqueRanks = Object.keys(counts).map(Number).sort((a, b) => {
    if (counts[a] !== counts[b]) return counts[b] - counts[a];
    return b - a;
  });

  if (isStraight && isFlush) {
    if (sorted[0].rank === Rank.Ace && sorted[1].rank === Rank.King) return { rank: HandRank.RoyalFlush, value: 0, cards: sorted };
    return { rank: HandRank.StraightFlush, value: sorted[0].rank, cards: sorted };
  }

  if (counts[uniqueRanks[0]] === 4) {
    return { rank: HandRank.FourOfAKind, value: uniqueRanks[0] * 100 + uniqueRanks[1], cards: sorted };
  }

  if (counts[uniqueRanks[0]] === 3 && counts[uniqueRanks[1]] === 2) {
    return { rank: HandRank.FullHouse, value: uniqueRanks[0] * 100 + uniqueRanks[1], cards: sorted };
  }

  if (isFlush) return { rank: HandRank.Flush, value: getKickerValue(sorted), cards: sorted };
  if (isStraight) return { rank: HandRank.Straight, value: sorted[0].rank === Rank.Ace && sorted[1].rank === Rank.Five ? Rank.Five : sorted[0].rank, cards: sorted };

  if (counts[uniqueRanks[0]] === 3) {
    return { rank: HandRank.ThreeOfAKind, value: uniqueRanks[0] * 10000 + uniqueRanks[1] * 100 + uniqueRanks[2], cards: sorted };
  }

  if (counts[uniqueRanks[0]] === 2 && counts[uniqueRanks[1]] === 2) {
    return { rank: HandRank.TwoPair, value: uniqueRanks[0] * 10000 + uniqueRanks[1] * 100 + uniqueRanks[2], cards: sorted };
  }

  if (counts[uniqueRanks[0]] === 2) {
    return { rank: HandRank.Pair, value: uniqueRanks[0] * 1000000 + uniqueRanks[1] * 10000 + uniqueRanks[2] * 100 + uniqueRanks[3], cards: sorted };
  }

  return { rank: HandRank.HighCard, value: getKickerValue(sorted), cards: sorted };
}

function getKickerValue(cards: Card[]): number {
  return cards.reduce((acc, c, i) => acc + c.rank * Math.pow(15, 4 - i), 0);
}

export function compareHands(h1: HandEvaluation, h2: HandEvaluation): number {
  if (h1.rank !== h2.rank) return h1.rank - h2.rank;
  return h1.value - h2.value;
}
