import { GoogleGenerativeAI } from "@google/generative-ai";
export class GeminiAiAgent {
    genAI;
    model;
    cooldownUntil = 0;
    constructor(apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
        this.model = this.genAI.getGenerativeModel({
            model: modelName,
        });
        console.log(`Using Gemini model: ${modelName}`);
    }
    async decideAction(playerId, state) {
        const me = state.players.find(p => p.id === playerId);
        const opponents = state.players.filter(p => p.id !== playerId);
        const prompt = `
      You are a professional Texas Hold'em Poker player.
      Current Game State:
      - Phase: ${state.phase}
      - Your Chips: ${me.chips}
      - Your Hole Cards: ${me.cards.map(c => `${c.rank}${c.suit}`).join(', ')}
      - Community Cards: ${state.communityCards.map(c => `${c.rank}${c.suit}`).join(', ') || 'None'}
      - Pot: ${state.pot}
      - Current Max Bet: ${state.currentMaxBet}
      - Your Current Bet: ${me.currentBet}
      - Opponents: ${opponents.map(o => `${o.name} (Chips: ${o.chips}, Folded: ${o.isFolded})`).join(', ')}

      Available Actions:
      - "fold": Give up the hand.
      - "check": Pass the action if the current bet is 0 or matches yours.
      - "call": Match the current max bet.
      - "raise": Increase the bet. If raising, provide an "amount" (total bet for this round).

      Rules:
      1. Your response must be ONLY a valid JSON object.
      2. If you raise, the amount must be at least ${state.currentMaxBet + state.bigBlind}.

      Return format:
      { "type": "fold" | "check" | "call" | "raise", "amount"?: number }
    `;
        try {
            if (this.cooldownUntil && Date.now() < this.cooldownUntil) {
                return `Gemini is in cooldown for ${Math.ceil((this.cooldownUntil - Date.now()) / 1000)}s due to previous 429 error.`;
            }
            const result = await this.model.generateContent(prompt);
            let text = result.response.text().trim();
            if (text.startsWith('```json'))
                text = text.substring(7);
            if (text.startsWith('```'))
                text = text.substring(3);
            if (text.endsWith('```'))
                text = text.substring(0, text.length - 3);
            const response = JSON.parse(text.trim());
            return response;
        }
        catch (error) {
            if (error.status === 429) {
                this.cooldownUntil = Date.now() + 60000;
                return "Gemini Quota Exceeded (429). Cooling down for 60s...";
            }
            return `Gemini Error: ${error.message || error}`;
        }
    }
}
