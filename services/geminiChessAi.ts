import { GoogleGenAI, Type } from "@google/genai";

const apiKey = (import.meta as any).env?.VITE_API_KEY || '';

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const getGeminiMove = async (fen: string, history: string[], legalMoves: string[]): Promise<string> => {
  if (!ai) {
    return legalMoves[0]; // Return first legal move if no API key
  }
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
  if (!ai) {
    return "API key no configurada. Configura VITE_API_KEY para análisis.";
  }
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