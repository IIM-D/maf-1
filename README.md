# Multi-Agent LLM Framework for Robot Collaboration

A comprehensive framework for coordinating multiple robots using Large Language Models (LLMs) with four different communication architectures.

## Architecture Overview

The system implements four distinct communication patterns:

- **DMAS**: Distributed Multi-Agent System with peer-to-peer dialogue
- **HMAS-1**: Hierarchical system with central planning and local dialogue
- **CMAS**: Centralized system with top-down coordination
- **HMAS-2**: Hierarchical system with central planning and feedback loops

## Key Features

### Agent Distinction
- **Central Coordinator Agents**: Use DeepSeek-V3-0324 for high-level planning
- **Local Robot Agents**: Use Ollama-deployed models on Raspberry Pi for local decision-making
- Clear separation between LLM agents (intelligence) and physical robots (execution)

### Terminology Updates
- Replaced "box" with "artifact" throughout the codebase
- Maintains consistency with multi-robot manipulation terminology

### Technology Stack
- **Frontend**: Next.js 14 with React and TypeScript
- **Backend**: Next.js API routes with custom LLM integration
- **Central LLM**: DeepSeek-V3-0324 via custom API endpoint
- **Local LLMs**: Ollama models on Raspberry Pi devices
- **UI**: Tailwind CSS with shadcn/ui components

## Getting Started

### Prerequisites
- Node.js 18+ 
- Python 3.8+ (for analysis scripts)
- Ollama installed on Raspberry Pi devices
- Access to DeepSeek-V3-0324 API

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd multi-agent-framework
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Configure environment variables:
\`\`\`bash
cp .env.local.example .env.local
# Edit .env.local with your API keys and endpoints
\`\`\`

4. Set up Ollama on Raspberry Pi:
\`\`\`bash
# On each Raspberry Pi
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.1:8b
ollama pull mistral:7b
\`\`\`

5. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

### Usage

1. **Configure Experiment**: Select framework, dialogue history method, grid size, and iterations
2. **Start Experiment**: Click "Start Experiment" to begin multi-agent coordination
3. **Monitor Progress
