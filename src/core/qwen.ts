import { GameState, PlayerAction } from "../types/index.js";

export class QwenAiAgent {
  private apiKey: string;
  private apiUrl: string = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
  private model: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = process.env.QWEN_MODEL || "qwen-plus";
    console.log(`Using Qwen model: ${this.model}`);
  }

  async decideAction(playerId: string, state: GameState): Promise<{ type: PlayerAction, amount?: number, reasoning: string } | string | null> {
    const me = state.players.find(p => p.id === playerId)!;
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
      3. Do not include any explanation or markdown formatting in your response.
      4. Include a "reasoning" field (in Chinese, max 20 characters) explaining your strategy.

      Return format:
      { "type": "fold" | "check" | "call" | "raise", "amount"?: number, "reasoning": string }
    `;

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: "You are a professional poker player AI." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return `Qwen Error: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`;
      }

      const result: any = await response.json();
      let content = result.choices[0].message.content.trim();
      
      // Basic sanitization just in case
      if (content.startsWith('```json')) content = content.substring(7);
      if (content.startsWith('```')) content = content.substring(3);
      if (content.endsWith('```')) content = content.substring(0, content.length - 3);
      
      try {
        const decision = JSON.parse(content.trim());
        return decision;
      } catch (parseError) {
        return `Qwen Parse Error: Invalid JSON response - ${content}`;
      }
    } catch (error: any) {
      return `Qwen Network Error: ${error.message || error}`;
    }
  }
}
