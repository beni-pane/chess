import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getGeminiMove = async (fen: string, history: string[], legalMoves: string[]): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Chess. FEN: ${fen}. History: ${history.slice(-10).join(', ')}. Legal: ${legalMoves.join(', ')}. Return only the best move from the list.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // Desactiva el razonamiento para velocidad máxima
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            move: {
              type: Type.STRING,
              description: "Move from the list."
            }
          },
          required: ["move"]
        }
      },
    });

    const result = JSON.parse(response.text || '{}');
    const move = result.move;
    
    if (legalMoves.includes(move)) {
      return move;
    }
    return legalMoves[0];
  } catch (error) {
    console.error("Gemini AI Move Error:", error);
    return legalMoves[0];
  }
};

export const getPositionAnalysis = async (fen: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analiza brevemente (1 frase) la posición FEN: ${fen}`,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text || "Sin análisis.";
  } catch (error) {
    return "Error.";
  }
};