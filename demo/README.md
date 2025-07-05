# Design Demo

Interactive visualization of the AI design generation process.

## Features

- **Reference Image Visualization**: See which images were found and why they were selected
- **Draft Rounds**: View all draft images from each generation round with selection reasons
- **Quality Progression**: Track the progression from drafts to medium to final quality
- **LLM Conversations**: See all AI conversations and prompts used in the process
- **Research Reports**: View the design research and criteria used for generation

## Running the Demo

```bash
# Quick start
npm start

# Or manually:
npm install
npm run build
node server.js
```

Then open http://localhost:3456 in your browser.

## UI Overview

### Tabs

1. **🖼️ Images**: Browse all generated and reference images organized by category
   - Inspiration: Reference images found during research
   - Drafts: Multiple rounds of draft generations
   - Medium Quality: Selected drafts rendered at higher quality
   - Final: The final high-quality design

2. **💬 Conversation**: View the complete AI agent conversation flow

3. **📋 Requests**: Detailed log of all LLM API requests with tokens and costs

4. **📄 Reports**: Design research report with guidelines, characteristics, and criteria

### Examples

Try these preset examples or enter your own prompt:

- Tech Startup Logo
- Shopping Cart Icon
- Login Screen UI
- Nature Background
- Social Media Post

### Features

- Real-time streaming updates during generation
- Image metadata with selection reasons and scores
- Token usage and cost tracking
- Detailed prompt history for each generated image