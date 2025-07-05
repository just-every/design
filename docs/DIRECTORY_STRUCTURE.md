# Design Agent Directory Structure

The design tools use a single `DESIGN_OUTPUT_DIR` environment variable to determine where to save all assets. 

- When running standalone tools: `DESIGN_OUTPUT_DIR` defaults to `.output/`
- When running the design agent: `DESIGN_OUTPUT_DIR` is set to `.output/{design_id}/` after initialization

Each design project creates a self-contained directory under `.output/{design_id}/` with the following structure:

```
.output/
└── {design_id}/                    # e.g., techflow_logo
    ├── metadata/                   # Design metadata and configuration
    │   ├── design_info.json       # Initial design configuration
    │   └── final_design.json      # Final design summary with process details
    │
    ├── reports/                    # Generated reports
    │   └── research_report.md     # Design research and guidelines
    │
    ├── screenshots/                # Screenshots from design websites
    │
    ├── drafts/                     # Low-quality draft designs
    │   ├── draft_1_*.png          # Draft variations (9-12 images)
    │   └── ...
    │
    ├── grids/                      # Selection grids
    │   ├── draft_grid_*.png       # Grid of all draft designs
    │   └── medium_grid_*.png      # Grid of all medium quality designs
    │
    ├── selections/                 # Selection records
    │   ├── draft_selections.json  # Which drafts were selected
    │   └── medium_selection.json  # Which medium design was selected
    │
    ├── medium/                     # Medium quality designs
    │   ├── medium_d1_v1_*.png    # Medium variations (9 total)
    │   └── ...
    │
    ├── final/                      # Final high-quality design
    │   └── final_*.png            # The final deliverable
    │
    └── llm-logs/                   # LLM interaction logs
        └── session-{timestamp}/    # Session-specific logs
            ├── summary.jsonl       # Quick overview of all LLM calls
            ├── session-info.json   # Session metadata
            ├── *-request-*.json    # Detailed request logs
            ├── *-response-*.json   # Detailed response logs
            └── session-end.json    # Session summary
```

## Directory Details

### metadata/
Contains JSON files tracking the design project:
- `design_info.json`: Created when design is initialized with type and ID
- `final_design.json`: Created after high-quality generation with complete process summary

### reports/
Contains markdown reports:
- `research_report.md`: Guidelines, ideal characteristics, warnings, and criteria for the design

### inspiration/
Used during the inspiration search phase:
- `screenshots/`: Individual website screenshots
- `grid/`: Grid images for visual selection

### drafts/
Low-quality draft images exploring different creative directions

### grids/
Numbered grid images used for AI-powered selection:
- Draft grid: Shows all draft designs for selection
- Medium grid: Shows all medium quality designs for final selection

### selections/
JSON files recording which designs were selected at each phase

### medium/
Medium quality variations of the best draft concepts

### final/
The final high-quality deliverable

### llm-logs/
Complete logging of all LLM interactions during the design session

## Benefits

1. **Self-contained**: Each design project is completely isolated
2. **Traceable**: Full history of the design process is preserved
3. **Organized**: Clear separation between different phases
4. **Debuggable**: LLM logs help troubleshoot issues
5. **Reproducible**: Metadata and selections allow understanding the process