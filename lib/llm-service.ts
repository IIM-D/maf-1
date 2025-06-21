export class LLMService {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || "sk-YyiBg6DSn1Fc2KBNU6ZYtw"
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || "http://47.117.124.84:4033/v1"
  }

  async getCentralCoordinatorResponse(statePrompt: string, config: any) {
    const prompt = this.buildCentralCoordinatorPrompt(statePrompt, config)

    try {
      console.log("Making API request to:", `${this.baseUrl}/chat/completions`)

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "DeepSeek-V3-0324",
          messages: [
            {
              role: "system",
              content:
                "You are a central coordinator for multi-robot artifact manipulation. Always respond with a valid JSON object containing agent actions.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.0,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        }),
      })

      console.log("API Response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API Error Response:", errorText)
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const responseText = await response.text()
      console.log("Raw API Response:", responseText.substring(0, 500) + "...")

      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error("Failed to parse API response as JSON:", parseError)
        console.error("Response text:", responseText)
        throw new Error(`Invalid JSON response from API: ${responseText.substring(0, 100)}...`)
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Unexpected API response structure:", data)
        throw new Error("Invalid API response structure")
      }

      const content = data.choices[0].message.content
      console.log("LLM Response content:", content)

      // Extract JSON plan from response with better error handling
      let plan = {}

      // Try to find JSON in the response
      const jsonMatches = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)

      if (jsonMatches && jsonMatches.length > 0) {
        // Try each potential JSON match
        for (const jsonMatch of jsonMatches) {
          try {
            const parsedPlan = JSON.parse(jsonMatch)
            // Validate that it looks like an agent action plan
            if (typeof parsedPlan === "object" && parsedPlan !== null) {
              plan = parsedPlan
              break
            }
          } catch (e) {
            console.warn("Failed to parse JSON match:", jsonMatch, e)
            continue
          }
        }
      }

      // If no valid JSON found, create empty plan
      if (Object.keys(plan).length === 0) {
        console.warn("No valid JSON plan found in response, using empty plan")
        plan = {}
      }

      return {
        plan,
        tokenUsage: this.estimateTokens(prompt + content),
        rawResponse: content,
      }
    } catch (error) {
      console.error("Central coordinator API error:", error)

      // Return a fallback response instead of throwing
      return {
        plan: {},
        tokenUsage: this.estimateTokens(prompt),
        rawResponse: `Error: ${error.message}`,
        error: true,
      }
    }
  }

  private buildCentralCoordinatorPrompt(statePrompt: string, config: any): string {
    const collisionAvoidance =
      "[Remember that each corner can only contain at most one artifact! Avoid collisions by not moving two artifacts into the same corner simultaneously.]"

    return `
You are a central planner directing agents in a grid-like field to move colored artifacts. Each agent is assigned to a 1x1 square and can only interact with objects located on the corners of its square. Agents can move an artifact to other three corners or a same-color target in its square. Each square can contain many targets.

The squares are identified by their center coordinates, e.g., square[0.5, 0.5]. Actions are like: move(artifact_red, target_red) or move(artifact_red, position[1.0, 0.0]). ${collisionAvoidance}

Your task is to instruct each agent to match all artifacts to their color-coded targets. After each move, agents provide updates for the next sequence of actions. Your job is to coordinate the agents optimally.

${statePrompt}

Specify your action plan in this format: {"Agent[0.5, 0.5]":"move(artifact_blue, position[0.0, 2.0])", "Agent[1.5, 0.5]":"move..."}. Include an agent only if it has a task next. Now, plan the next step:
    `.trim()
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }
}
