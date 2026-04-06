import type { AIAnalysisResult, ParameterPrediction, RULEstimate, HealthScore } from "../types/predictions";

const AI_URL = import.meta.env.VITE_AI_PROXY_URL as string | undefined ?? "http://localhost:9002";

export async function requestAIAnalysis(
  predictions: ParameterPrediction[],
  rulEstimates: RULEstimate[],
  healthScore: HealthScore,
): Promise<AIAnalysisResult> {
  const paramSummary = predictions.map((p) => {
    const crossing = p.thresholdCrossing?.willCross
      ? `ALERT: will ${p.thresholdCrossing.direction === "above" ? "exceed" : "drop below"} ${p.thresholdCrossing.threshold}${p.unit} in ~${Math.round(p.thresholdCrossing.minutesUntil ?? 0)} min`
      : "within normal range";
    return `${p.label}: ${p.currentValue.toFixed(1)}${p.unit} (trend: ${p.trendDirection}, rate: ${p.rateOfChange.toFixed(2)}${p.rateOfChangeUnit}) [${crossing}]`;
  }).join("\n");

  const rulSummary = rulEstimates.map((r) => {
    const time = r.estimatedMinutesRemaining !== null ? `${Math.round(r.estimatedMinutesRemaining)} min` : "N/A";
    return `${r.label}: RUL=${time}, degradation=${(r.currentDegradation * 100).toFixed(0)}%, trend=${r.trend}`;
  }).join("\n");

  const prompt = `Analyze this industrial PLC system and provide a JSON response.

Current Sensor Readings & Predictions:
${paramSummary}

Remaining Useful Life Estimates:
${rulSummary}

System Health Score: ${healthScore.overall}/100

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "healthScore": <0-100>,
  "riskLevel": "<low|medium|high|critical>",
  "summary": "<2-3 sentence assessment>",
  "recommendations": ["<action 1>", "<action 2>", ...],
  "patterns": ["<observed pattern 1>", "<observed pattern 2>", ...]
}`;

  try {
    const resp = await fetch(`${AI_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        plcContext: `Health: ${healthScore.overall}/100. ${predictions.length} parameters monitored.`,
      }),
    });

    if (!resp.ok) throw new Error(`AI proxy error: ${resp.status}`);

    const data = await resp.json();
    const reply = data.reply as string;

    // Try to parse JSON from response
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        healthScore: parsed.healthScore ?? healthScore.overall,
        riskLevel: parsed.riskLevel ?? "medium",
        summary: parsed.summary ?? reply,
        recommendations: parsed.recommendations ?? [],
        patterns: parsed.patterns ?? [],
        timestamp: Date.now(),
      };
    }

    // Fallback: use raw text
    return {
      healthScore: healthScore.overall,
      riskLevel: healthScore.overall > 70 ? "low" : healthScore.overall > 40 ? "medium" : "high",
      summary: reply,
      recommendations: [],
      patterns: [],
      timestamp: Date.now(),
    };
  } catch (err) {
    return {
      healthScore: healthScore.overall,
      riskLevel: "medium",
      summary: `AI analysis unavailable: ${(err as Error).message}. Based on client-side analysis, system health is ${healthScore.overall}/100.`,
      recommendations: ["Ensure AI proxy is running on port 9002", "Run: npm run ai-proxy"],
      patterns: [],
      timestamp: Date.now(),
    };
  }
}
