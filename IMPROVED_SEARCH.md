# Improved Design Search System

## Problem
The reference images were of poor quality, leading to terrible final designs. The agent was allowed to specify limits (often too low like 3), resulting in insufficient options for quality selection.

## Solution: `smart_design_improved`

### Key Changes:

1. **Forced 9 Images Per Engine**
   - No more agent control over limits
   - Always fetches 9 images from EACH search engine
   - More options = better quality selection

2. **Per-Engine Grid Analysis**
   - Creates a separate grid for each search engine's results
   - Runs vision analysis in PARALLEL for each engine
   - Selects best 3-4 from each engine independently

3. **Multi-Round Selection**
   - Round 1: Each engine's best 3-4 (parallel)
   - Round 2: If >9 total, final selection to get best 9 overall
   - Focus on QUALITY over quantity

### Process Flow:

```
User Request → Agent provides queries (no limits)
     ↓
[Dribbble: 9] [Behance: 9] [Pinterest: 9] [Awwwards: 9]
     ↓           ↓            ↓              ↓
  Grid #1     Grid #2      Grid #3       Grid #4
     ↓           ↓            ↓              ↓
  Best 3-4    Best 3-4     Best 3-4      Best 3-4
     ↓           ↓            ↓              ↓
     └───────────┴────────────┴──────────────┘
                        ↓
              Combined: ~12-16 images
                        ↓
                 Final Grid Selection
                        ↓
                  Best 9 Overall
```

### Benefits:

1. **Higher Quality**: 36+ images analyzed → only best 9 selected
2. **Engine Balance**: Each engine gets fair representation
3. **Parallel Processing**: Faster selection with parallel grid analysis
4. **No Bad Limits**: Agent can't accidentally limit to 2-3 images
5. **Better Prompts**: Focus on quality descriptors in judge criteria

### Example Usage:

```json
// Agent now provides (limits ignored if specified):
[
  { "engine": "dribbble", "query": "modern tech logo minimal" },
  { "engine": "behance", "query": "ai startup branding" },
  { "engine": "pinterest", "query": "workflow automation logo" }
]

// System automatically:
// - Gets 9 from each (27 total)
// - Selects best 3-4 from each engine
// - Final selection of best 9 overall
```

### Quality Criteria:
- "Exceptional quality, clear visual communication"
- "Avoid low-quality, generic, or poorly executed designs"
- "Quality is more important than variety"

## Result
Much higher quality reference images → Better final designs!