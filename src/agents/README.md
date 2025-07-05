# Design Agent Architecture

The Design Agent has been refactored into a clean, modular architecture for better maintainability.

## File Structure

### `design-agent.ts` (Main File - 483 lines)
The main agent orchestration file that:
- Creates and configures the design agent
- Defines tool bindings using `createToolFunction`
- Manages the agent lifecycle with MECH integration
- Handles streaming and non-streaming execution modes

### `design-agent-tools-impl.ts` (Tool Implementations - 280 lines)
Contains the actual implementation of all design tools:
- `DesignAgentState` interface - Tracks all state throughout the design process
- `DesignAgentToolsImpl` class - Implements all 10 design tools:
  1. `setDesignType()` - Sets the asset type being designed
  2. `writeResearchReport()` - Documents design research and criteria
  3. `designSearch()` - Searches for inspiration images
  4. `generateDrafts()` - Creates initial draft variations
  5. `createDraftGrid()` - Arranges drafts in a numbered grid
  6. `selectBestDrafts()` - AI-powered draft selection
  7. `generateMediumQuality()` - Creates improved versions
  8. `createMediumGrid()` - Arranges medium designs in grid
  9. `selectBestMedium()` - Selects the best medium design
  10. `generateHighQuality()` - Creates final professional version

### `design-agent-prompts.ts` (Prompt Generation - 180 lines)
Generates all contextual prompts and instructions:
- Status prompts showing current progress
- Phase-specific prompts guiding the agent
- Agent instructions for the overall workflow
- Type-specific guidance based on design asset type

## Design Workflow

The agent follows a structured 7-phase workflow:

1. **Setup & Research** - Determine design type and write research report
2. **Inspiration** (optional) - Search for reference images
3. **Draft Generation** - Create 9-12 low-quality variations
4. **Draft Selection** - Choose best 3 concepts
5. **Medium Quality** - Generate 9 improved versions (3 per draft)
6. **Medium Selection** - Choose the single best design
7. **High Quality** - Create final pixel-perfect version

## Usage Example

```typescript
import { createDesignAgent } from './design-agent.js';
import { runAgent } from '../run-agent.js';

// Create agent for logo design
const agent = createDesignAgent(
  'Create a modern tech startup logo',
  'primary_logo',
  true // with inspiration
);

// Run the agent
await runAgent('Design a logo for TechFlow');
```

## Key Benefits of This Architecture

1. **Separation of Concerns** - Tools, prompts, and orchestration are cleanly separated
2. **Testability** - Each tool can be tested independently
3. **Maintainability** - Easy to add new tools or modify existing ones
4. **State Management** - Clear state tracking throughout the design process
5. **Reusability** - Tools and prompts can be reused in other contexts