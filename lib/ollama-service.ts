export class OllamaService {
  private instances: Array<{
    baseUrl: string
    model: string
    id: string
    name: string
  }>

  constructor() {
    this.instances = [
      {
        id: "llm-agent-1",
        name: "Local LLM Agent Alpha",
        baseUrl: process.env.OLLAMA_BASE_URL_1 || "http://192.168.1.100:11434",
        model: process.env.OLLAMA_MODEL_1 || "llama3.1:8b",
      },
      {
        id: "llm-agent-2",
        name: "Local LLM Agent Beta",
        baseUrl: process.env.OLLAMA_BASE_URL_2 || "http://192.168.1.101:11434",
        model: process.env.OLLAMA_MODEL_2 || "mistral:7b",
      },
    ]
  }

  async getLocalAgentResponse(prompt: string, config: any, agentId?: string) {
    // Determine which Ollama instance to use based on agent
    const instance = this.selectOllamaInstance(agentId)

    try {
      console.log(`Making Ollama request to ${instance.name} (${instance.baseUrl}) with model ${instance.model}`)

      const response = await fetch(`${instance.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: instance.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.0,
            top_p: 1.0,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Ollama API Error for ${instance.name}:`, errorText)
        throw new Error(
          `Ollama API request failed for ${instance.name}: ${response.status} ${response.statusText} - ${errorText}`,
        )
      }

      const responseText = await response.text()
      let data

      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error(`Failed to parse Ollama response from ${instance.name}:`, parseError)
        throw new Error(`Invalid JSON response from ${instance.name}: ${responseText.substring(0, 100)}...`)
      }

      if (!data.response) {
        console.error(`Unexpected Ollama response structure from ${instance.name}:`, data)
        throw new Error(`Invalid Ollama response structure from ${instance.name}`)
      }

      const content = data.response
      console.log(`Ollama Response from ${instance.name}:`, content.substring(0, 200) + "...")

      // Parse response for different agent types
      const hasExecuteCommand = content.includes("EXECUTE")
      const agrees = content.includes("I Agree") || content.includes("I agree")

      let plan = {}
      const planMatch = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)

      if (planMatch && planMatch.length > 0) {
        for (const match of planMatch) {
          try {
            const parsedPlan = JSON.parse(match)
            if (typeof parsedPlan === "object" && parsedPlan !== null) {
              plan = parsedPlan
              break
            }
          } catch (e) {
            console.warn(`Failed to parse plan from Ollama response (${instance.name}):`, e)
            continue
          }
        }
      }

      return {
        message: content,
        hasExecuteCommand,
        agrees,
        plan,
        feedback: agrees ? "" : content,
        tokenUsage: this.estimateTokens(prompt + content),
        instanceId: instance.id,
        instanceName: instance.name,
        model: instance.model,
      }
    } catch (error) {
      console.error(`Ollama API error for ${instance.name}:`, error)

      // Return fallback response
      return {
        message: `Error from ${instance.name}: ${error.message}`,
        hasExecuteCommand: false,
        agrees: true, // Default to agree to avoid blocking
        plan: {},
        feedback: "",
        tokenUsage: this.estimateTokens(prompt),
        instanceId: instance.id,
        instanceName: instance.name,
        model: instance.model,
        error: true,
      }
    }
  }

  private selectOllamaInstance(agentId?: string) {
    if (!agentId) {
      // Default to first instance if no agent specified
      return this.instances[0]
    }

    // Simple round-robin or hash-based selection
    // You can implement more sophisticated logic here
    const agentHash = this.hashString(agentId)
    const instanceIndex = agentHash % this.instances.length
    return this.instances[instanceIndex]
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  async checkOllamaConnections(): Promise<
    Array<{
      id: string
      name: string
      connected: boolean
      model: string
      baseUrl: string
      error?: string
      responseTime?: number
    }>
  > {
    const connectionResults = []

    for (const instance of this.instances) {
      const startTime = Date.now()
      try {
        console.log(`Checking connection to ${instance.name} at ${instance.baseUrl}`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        const response = await fetch(`${instance.baseUrl}/api/tags`, {
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        const responseTime = Date.now() - startTime

        if (response.ok) {
          console.log(`✅ Successfully connected to ${instance.name} (${responseTime}ms)`)
          connectionResults.push({
            id: instance.id,
            name: instance.name,
            connected: true,
            model: instance.model,
            baseUrl: instance.baseUrl,
            responseTime,
          })
        } else {
          const errorText = await response.text()
          console.error(`❌ Connection failed to ${instance.name}: ${response.status} ${response.statusText}`)
          connectionResults.push({
            id: instance.id,
            name: instance.name,
            connected: false,
            model: instance.model,
            baseUrl: instance.baseUrl,
            error: `HTTP ${response.status}: ${response.statusText}`,
            responseTime,
          })
        }
      } catch (error) {
        const responseTime = Date.now() - startTime
        console.error(`❌ Connection check failed for ${instance.name}:`, error)

        let errorMessage = error.message
        if (error.name === "AbortError") {
          errorMessage = "Connection timeout (10s)"
        } else if (error.message.includes("fetch")) {
          errorMessage = "Network error - check if Ollama is running and accessible"
        }

        connectionResults.push({
          id: instance.id,
          name: instance.name,
          connected: false,
          model: instance.model,
          baseUrl: instance.baseUrl,
          error: errorMessage,
          responseTime,
        })
      }
    }

    return connectionResults
  }

  async listAvailableModels(
    instanceId?: string,
  ): Promise<Array<{ instanceId: string; instanceName: string; models: string[] }>> {
    const results = []
    const instancesToCheck = instanceId ? this.instances.filter((i) => i.id === instanceId) : this.instances

    for (const instance of instancesToCheck) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(`${instance.baseUrl}/api/tags`, {
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          results.push({
            instanceId: instance.id,
            instanceName: instance.name,
            models: [],
          })
          continue
        }

        const data = await response.json()
        const models = data.models?.map((model: any) => model.name) || []
        results.push({
          instanceId: instance.id,
          instanceName: instance.name,
          models,
        })
      } catch (error) {
        console.error(`Failed to list Ollama models for ${instance.name}:`, error)
        results.push({
          instanceId: instance.id,
          instanceName: instance.name,
          models: [],
        })
      }
    }

    return results
  }

  getInstanceInfo() {
    return this.instances.map((instance) => ({
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
      model: instance.model,
    }))
  }

  private estimateTokens(text: string): number {
    // Rough estimation for local models
    return Math.ceil(text.length / 4)
  }
}
