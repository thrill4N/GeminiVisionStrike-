/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from "@google/genai";
import { StrategicHint, AiResponse, DebugInfo } from "../types";
import { GameMode } from "./ScoreService";

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;

if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
} else {
    console.error("Gemini API Key is missing. Please set GEMINI_API_KEY in your environment.");
}

const MODEL_NAME = "gemini-3-flash-preview";

/**
 * THE STRATEGY ENGINE
 * 
 * This service acts as the bridge between the real-time game state and the Gemini VLM.
 * It handles:
 * 1. Image preprocessing (Base64 cleaning)
 * 2. Strategic Context stitching (Board metadata + valid targets)
 * 3. Difficulty-aware prompting
 * 4. Resilient JSON parsing of model output
 */

export interface TargetCandidate {
  id: string;
  color: string;
  size: number;
  row: number;
  col: number;
  pointsPerBubble: number;
  description: string;
}

export const getStrategicHint = async (
  imageBase64: string,
  validTargets: TargetCandidate[], // Now contains candidates for ALL colors
  dangerRow: number,
  difficulty: GameMode = 'moderate'
): Promise<AiResponse> => {
  const startTime = performance.now();
  
  // Default debug info container
  const debug: DebugInfo = {
    latency: 0,
    screenshotBase64: imageBase64, // Keep the raw input for display
    promptContext: "",
    rawResponse: "",
    timestamp: new Date().toLocaleTimeString()
  };

  if (!ai) {
    return {
        hint: { message: "API Key missing." },
        debug: { ...debug, error: "API Key Missing" }
    };
  }

  /**
   * LOCAL HEURISTIC FALLBACK
   * Used if the AI Service is unreachable or returns invalid data.
   * Ensures the user journey remains uninterrupted during network latency.
   */
  const getBestLocalTarget = (msg: string = "No clear shots—play defensively."): StrategicHint => {
    if (validTargets.length > 0) {
        // Sort by Total Potential Score (Size * Value) then Height
        const best = validTargets.sort((a,b) => {
            const scoreA = a.size * a.pointsPerBubble;
            const scoreB = b.size * b.pointsPerBubble;
            return (scoreB - scoreA) || (a.row - b.row);
        })[0];
        
        return {
            message: `Fallback: Select ${best.color.toUpperCase()} at Row ${best.row}`,
            rationale: "Selected based on highest potential cluster score available locally.",
            targetRow: best.row,
            targetCol: best.col,
            recommendedColor: best.color as any
        };
    }
    return { message: msg, rationale: "No valid clusters found to target." };
  };

  const hasDirectTargets = validTargets.length > 0;

  /**
   * SERIALIZED GAME STATE
   * We provide the model with a list of "Validated Clear Shots". 
   * This grounds the AI's visual reasoning in concrete game-logic data, 
   * significantly reducing hallucinated coordinates.
   */
  const targetListStr = hasDirectTargets 
    ? validTargets.map(t => 
        `- OPTION: Select ${t.color.toUpperCase()} (${t.pointsPerBubble} pts/bubble) -> Target [Row ${t.row}, Col ${t.col}]. Cluster Size: ${t.size}. Total Value: ${t.size * t.pointsPerBubble}.`
      ).join("\n")
    : "NO MATCHES AVAILABLE. Suggest a color to set up a future combo.";
  
  debug.promptContext = targetListStr;

  let difficultyInstructions = "";
  if (difficulty === 'easy') {
      // Direct, coaching-style personality for beginners
      difficultyInstructions = `
      - THE PLAYER IS A NOVICE. BE EXTREMELY PRECISE.
      - Give exact coordinates that lead to the biggest immediate pop.
      - Your message should be encouraging and simple.
      `;
  } else if (difficulty === 'hard') {
      // Obfuscated/Complex strategy for experts
      difficultyInstructions = `
      - THE PLAYER IS AN EXPERT.
      - Prioritize deep strategy: setups for future turns, exposing high-value clusters, or complex chain reactions.
      - If NO high-value play is available, you may suggest a defensive setup shot.
      - Simulate cognitive overload: 20% of the time, provide a "high-risk" strategic gambit.
      `;
  }

  /**
   * MULTIMODAL INFERENCE PROMPT
   * Interleaving visual input with structured gameplay metadata.
   */
  const prompt = `
    You are a strategic gaming AI analyzing a Bubble Shooter game where the player can CHOOSE their projectile color.
    I have provided a screenshot of the current board and a list of valid targets for all available colors.

    ### DIFFICULTY CONTEXT
    Mode: ${difficulty.toUpperCase()}
    ${difficultyInstructions}

    ### GAME STATE
    - Danger Level: ${dangerRow >= 6 ? "CRITICAL (Bubbles near bottom!)" : "Stable"}
    
    ### SCORING RULES
    - Red: 100 pts
    - Blue: 150 pts
    - Green: 200 pts
    - Yellow: 250 pts
    - Purple: 300 pts
    - Orange: 500 pts (High Value Target!)

    ### AVAILABLE MOVES (Validated Clear Shots)
    ${targetListStr}

    ### YOUR TASK
    Analyze the visual board state. 
    1. Choose the BEST color for the player to equip.
    2. Tell them where to shoot that specific color.
    
    Prioritize:
    1. **High Score**: Hitting high-value colors (Orange/Purple) matches.
    2. **Avalanche**: Hitting high up on the board to drop non-matching bubbles below.
    3. **Survival**: If Danger is CRITICAL, ignore score and clear the lowest bubbles.

    ### OUTPUT FORMAT
    Return RAW JSON only. Do not use Markdown. Do not use code blocks.
    JSON structure:
    {
      "message": "Short operational directive",
      "rationale": "One sentence explaining the strategy.",
      "recommendedColor": "red|blue|green|yellow|purple|orange",
      "targetRow": integer,
      "targetCol": integer
    }
  `;

  try {
    // Strip the data:image/png;base64, prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    /**
     * GENERATIVE AI DISPATCH
     * Utilizing gemini-1.5-flash for its industry-leading vision-reasoning latency.
     */
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
            { text: prompt },
            { 
              inlineData: {
                mimeType: "image/png",
                data: cleanBase64
              } 
            }
        ]
      },
      config: {
        maxOutputTokens: 2048, // Increased to ensure full JSON response
        temperature: 0.4,
        responseMimeType: "application/json" 
        // NOTE: responseSchema removed to avoid empty/blocked responses
      }
    });

    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    
    let text = response.text || "{}";
    debug.rawResponse = text;
    
    /**
     * RESILIENT SCHEMATIC PARSING
     * AI models may wrap output in markdown blocks or conversational preamble.
     * We manually sanitize the string to isolate the JSON object.
     */
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        text = text.substring(firstBrace, lastBrace + 1);
    } 

    try {
        const json = JSON.parse(text); 
        debug.parsedResponse = json;
        
        const r = Number(json.targetRow);
        const c = Number(json.targetCol);
        
        if (!isNaN(r) && !isNaN(c) && json.recommendedColor) {
            return {
                hint: {
                    message: json.message || "Good shot available!",
                    rationale: json.rationale,
                    targetRow: r,
                    targetCol: c,
                    recommendedColor: json.recommendedColor.toLowerCase()
                },
                debug
            };
        }
        return {
            hint: getBestLocalTarget("AI returned invalid coordinates"),
            debug: { ...debug, error: "Invalid Coordinates in JSON" }
        };

    } catch (e: any) {
        console.warn("Failed to parse Gemini JSON:", text);
        return {
            hint: getBestLocalTarget("AI response parse error"),
            debug: { ...debug, error: `JSON Parse Error: ${e.message}` }
        };
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    return {
        hint: getBestLocalTarget("AI Service Unreachable"),
        debug: { ...debug, error: error.message || "Unknown API Error" }
    };
  }
};