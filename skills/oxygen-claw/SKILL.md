---
name: oxygen-claw
description: |
  Connect to OxygenClaw MCP Server as an external agent. Register as main-agent (task delegator) or sub-agent (task executor). Main-agents can assign tasks to sub-agents via WaitTask/Deliver pattern. OxygenClaw acts as a coordination hub for multi-agent collaboration, providing LLM access, model switching, and task management. Use this skill when you need to connect an external Agent to OxygenClaw's MCP server, register an agent identity, delegate tasks, or deliver task results.
version: 1.0.0
author: OxygenClaw
license: MIT
tags:
  - mcp
  - agent
  - multi-agent
  - task-delegation
  - coordination
metadata:
  openclaw:
    requires:
      bins:
        - node
    emoji: "🦾"
    homepage: https://github.com/oxygen-claw/oxygen-claw
---

# OxygenClaw MCP Server Connection Skill

Connect external Agents to OxygenClaw's MCP Server for multi-agent coordination, task delegation, and collaborative intelligence.

## Overview

OxygenClaw operates as an MCP (Model Context Protocol) server that allows external agents to connect, register identities, and collaborate through a structured task delegation system.

### Agent Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| `main-agent` | Task delegator with unique ID | Register sub-agents, assign tasks, receive deliverables |
| `sub-agent` | Task executor bound to a main-agent | Wait for tasks, execute work, deliver results |

### Available MCP Tools

1. **`register_agent`** — Register as main-agent or sub-agent
2. **`wait_task`** — Sub-agent blocks until a task is assigned (long-poll)
3. **`assign_task`** — Main-agent delegates a task to a sub-agent
4. **`deliver_result`** — Sub-agent delivers completed task results
5. **`get_stats`** — Query server statistics and agent status
6. **`heartbeat`** — Keep agent connection alive

## Connection Methods

### Stdio (Local)

```bash
oxygen-claw mcp
```

Connect via standard input/output. Best for local agent integration.

### Streamable HTTP

```
POST /mcp
```

Connect via HTTP with streaming support. Best for remote agents.

### SSE (Server-Sent Events)

```
GET /mcp/sse
```

Connect via Server-Sent Events. Best for browser-based agents.

## Registration Flow

### Step 1: Register as Main-Agent

```
Tool: register_agent
Parameters:
  role: "main-agent"
  name: "MyAgent-001"
  capabilities: ["code-generation", "data-analysis", "research"]
  transport: "stdio" | "sse" | "streamable-http"
```

Response includes a unique `agentId` (format: `main-agent@xxxxxxxx-xxxx-xxxx`).

### Step 2: Register Sub-Agents (by Main-Agent)

Sub-agents must specify which main-agent they belong to:

```
Tool: register_agent
Parameters:
  role: "sub-agent"
  mainAgentId: "<main-agent-id from step 1>"
  name: "Worker-001"
  capabilities: ["web-search", "file-processing"]
```

### Step 3: Sub-Agent Waits for Task

Sub-agents call `wait_task` and block until a task is assigned:

```
Tool: wait_task
Parameters:
  subAgentId: "<sub-agent-id>"
```

This is a long-polling request. The server holds the connection open until a task becomes available or a timeout occurs.

### Step 4: Main-Agent Assigns Task

```
Tool: assign_task
Parameters:
  mainAgentId: "<main-agent-id>"
  subAgentId: "<optional: specific sub-agent, or auto-select>"
  title: "Research quantum computing trends"
  description: "Search for recent papers and summarize key findings"
  priority: "high" | "medium" | "low"
```

### Step 5: Sub-Agent Delivers Result

After completing the task, the sub-agent delivers results:

```
Tool: deliver_result
Parameters:
  subAgentId: "<sub-agent-id>"
  taskId: "<task-id>"
  result: "Summary of findings..."
  deliverables:
    - path: "/output/research-report.md"
      description: "Detailed research report"
      format: "markdown"
```

## Capability Modes

OxygenClaw supports five capability modes that control thinking depth and search behavior:

| Mode | Thinking | Web Searches | Use Case |
|------|----------|-------------|----------|
| **Fast** | L1 (minimal) | 1 | Quick answers, simple lookups |
| **Think** | L2 (moderate) | 5 | Balanced reasoning with web context |
| **Expert** | L3 (CoT) | 10 | Deep analysis with chain-of-thought |
| **Research** | L5 (max) | Unlimited | Cross-validated research with markdown output |
| **MoA** | Dynamic | Unlimited | Multi-agent collaboration with voting |

## Best Practices

### For Main-Agents

- Assign tasks with clear, specific descriptions
- Use priority levels appropriately (reserve "high" for urgent tasks)
- Monitor sub-agent availability before assigning
- Specify `subAgentId` only when targeting a specific agent; omit for auto-selection

### For Sub-Agents

- Call `heartbeat` every 30 seconds to maintain connection
- Include deliverable paths in `deliver_result` for traceability
- Report failures via `fail_task` instead of silently dropping tasks
- Declare accurate capabilities during registration

### Task Lifecycle

```
pending → assigned → in_progress → completed
                    ↓
                  failed
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid sub-agent` | Agent not registered or wrong role | Re-register with correct role |
| `Main agent queue not found` | Main-agent disconnected | Re-register main-agent |
| `Task not found` | Invalid task ID or task already completed | Check task status via `get_stats` |

## Integration Example

```python
from mcp import Client

# Connect to OxygenClaw MCP Server
client = Client("oxygen-claw mcp")

# Register as main-agent
result = client.call("register_agent", {
    "role": "main-agent",
    "name": "Orchestrator",
    "capabilities": ["planning", "coordination"]
})
main_agent_id = result["id"]

# Register a sub-agent
sub_result = client.call("register_agent", {
    "role": "sub-agent",
    "mainAgentId": main_agent_id,
    "name": "Researcher",
    "capabilities": ["web-search", "summarization"]
})
sub_agent_id = sub_result["id"]

# Assign a task
task = client.call("assign_task", {
    "mainAgentId": main_agent_id,
    "subAgentId": sub_agent_id,
    "title": "Research AI trends",
    "description": "Find top 5 AI trends in 2026",
    "priority": "medium"
})

# Sub-agent waits and executes
task = client.call("wait_task", {"subAgentId": sub_agent_id})
# ... execute task ...

# Deliver result
client.call("deliver_result", {
    "subAgentId": sub_agent_id,
    "taskId": task["id"],
    "result": "Top 5 AI trends: ...",
    "deliverables": [{
        "path": "/output/trends.md",
        "description": "AI trends report",
        "format": "markdown"
    }]
})
```

## Agent Framework Integration

OxygenClaw's MCP server supports integration with various agent frameworks:

- **Mixture-of-Agents (MoA)**: Use in MoA mode for collaborative intelligence
- **Graph-of-Agents (GoA)**: Graph-based agent communication with message passing
- **Swarm Intelligence**: Decentralized agent coordination
- **Pipeline Pattern**: Sequential task processing across agents
- **Adversarial Review**: Generator-critic agent pairs for quality assurance

## Version

v1.0.0 — Initial release with main-agent/sub-agent architecture and MCP server support.
