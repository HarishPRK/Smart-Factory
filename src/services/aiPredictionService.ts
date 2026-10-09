import type { AIAnalysisResult, ParameterPrediction, RULEstimate, HealthScore } from "../types/predictions";

const AI_URL = import.meta.env.VITE_AI_PROXY_URL as string | undefined ?? "/api/factory-ai";

export async function requestAIAnalysis(
  predictions: ParameterPrediction[],
  rulEstimates: RULEstimate[],
  healthScore: HealthScore,
): Promise<AIAnalysisResult> {
  const paramSummary = predictions.map((p) => {
    const crossing = p.thresholdCrossing?.willCross
      ? `ALERT: will ${p.thresholdCrossing.direction === "above" ? "exceed" : "drop below"} ${p.thresholdCrossing.threshold}${p.unit} in ~${Math.round(p.thresholdCrossing.minutesUntil ?? 0)} min`
      : "no future crossing projected by this fit";
    return `${p.label}: ${p.currentValue.toFixed(1)}${p.unit} (trend: ${p.trendDirection}, rate: ${p.rateOfChange.toFixed(2)}${p.rateOfChangeUnit}, R-squared fit: ${p.confidence.toFixed(2)}, ${p.sampleCount ?? "unknown"} received samples) [${crossing}]`;
  }).join("\n");

  const rulSummary = rulEstimates.map((r) => {
    const time = r.estimatedMinutesRemaining !== null ? `${Math.round(r.estimatedMinutesRemaining)} min` : "N/A";
    return `${r.label}: projected time to configured threshold=${time}, trend=${r.trend}. This is a linear extrapolation, not validated equipment remaining useful life.`;
  }).join("\n");

  const prompt = `Analyze this industrial PLC system and provide a JSON response.

Current Sensor Readings & Predictions:
${paramSummary}

Linear Threshold Projections:
${rulSummary}

Heuristic condition index: ${healthScore.overall}/100. This is not measured OEE or a calibrated failure probability. Statistical forecasts use only the short received PLC session window, not a trained maintenance model. Describe limitations and do not turn projected threshold crossings into certain equipment failures.

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
      signal: AbortSignal.timeout(60_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        plcContext: `Health: ${healthScore.overall}/100. ${predictions.length} parameters monitored.`,
      }),
    });

    if (!resp.ok) throw new Error(`AI proxy error: ${resp.status}`);

    const data = await resp.json();
    const reply = data.reply as string;
    if (typeof reply !== "string" || !reply.trim()) throw new Error("The AI service returned no assessment");

    // Try to parse JSON from response
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        healthScore: Number.isFinite(parsed.healthScore) ? Math.max(0, Math.min(100, parsed.healthScore)) : healthScore.overall,
        riskLevel: ["low", "medium", "high", "critical"].includes(parsed.riskLevel) ? parsed.riskLevel : null,
        summary: typeof parsed.summary === "string" ? parsed.summary : reply,
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.filter((value: unknown) => typeof value === "string") : [],
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns.filter((value: unknown) => typeof value === "string") : [],
        timestamp: Date.now(),
      };
    }

    // Fallback: use raw text
    return {
      healthScore: healthScore.overall,
      riskLevel: null,
      summary: reply,
      recommendations: [],
      patterns: [],
      timestamp: Date.now(),
    };
  } catch (err) {
    return {
      unavailable: true,
      healthScore: healthScore.overall,
      riskLevel: null,
      summary: `AI analysis unavailable: ${(err as Error).message}.`,
      recommendations: ["Verify that the governed Bedrock service is available"],
      patterns: [],
      timestamp: Date.now(),
    };
  }
}
