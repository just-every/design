#!/usr/bin/env node
/**
 * Design Demo server with visualization of the design generation process
 * 
 * This server demonstrates the Design framework with detailed visualization of:
 * - Reference image search and selection
 * - Draft generation rounds and selection criteria
 * - Final image generation
 * - All LLM conversations and prompts
 * - Real-time state updates
 */

import dotenv from 'dotenv';
import { join } from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { runDesignAgentStreaming } from '../dist/index.js';
import { setEnsembleLogger } from '@just-every/ensemble';
import { promises as fs } from 'fs';
import path from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

// Debug: Log which API keys were loaded
console.log('🎨 Design Demo Environment:');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('   ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set');
console.log('   GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '✅ Set' : '❌ Not set');
console.log('   XAI_API_KEY:', process.env.XAI_API_KEY ? '✅ Set' : '❌ Not set');

// Custom logger to track all LLM requests
class DesignDemoLogger {
  constructor() {
    this.activeWebSocket = null;
  }
  
  setActiveWebSocket(ws) {
    this.activeWebSocket = ws;
  }
  
  log_llm_request(agentId, providerName, model, requestData, timestamp) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const time = timestamp || new Date();
    
    // Send to active WebSocket if available
    if (this.activeWebSocket) {
      this.activeWebSocket.send(JSON.stringify({
        type: 'llm_request',
        id: requestId,
        agentId,
        provider: providerName,
        model,
        timestamp: time.toISOString(),
        messages: requestData.messages || [],
        temperature: requestData.temperature,
        maxTokens: requestData.max_tokens
      }));
    }
    
    return requestId;
  }

  log_llm_response(requestId, responseData, timestamp) {
    if (!requestId || !this.activeWebSocket) return;
    
    const time = timestamp || new Date();
    
    this.activeWebSocket.send(JSON.stringify({
      type: 'llm_response',
      requestId,
      content: responseData.content?.[0]?.text || '',
      usage: responseData.usage ? {
        promptTokens: responseData.usage.input_tokens || 0,
        completionTokens: responseData.usage.output_tokens || 0,
        totalTokens: (responseData.usage.input_tokens || 0) + (responseData.usage.output_tokens || 0)
      } : null,
      duration: time.getTime() - Date.now()
    }));
  }

  log_llm_error(requestId, errorData, timestamp) {
    if (!requestId || !this.activeWebSocket) return;
    
    this.activeWebSocket.send(JSON.stringify({
      type: 'llm_error',
      requestId,
      error: errorData,
      timestamp: timestamp?.toISOString() || new Date().toISOString()
    }));
  }
}

// Create and set the logger
const logger = new DesignDemoLogger();
setEnsembleLogger(logger);

// Track active designs
const activeDesigns = new Map();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('📱 Client connected');
  
  // Set this as the active WebSocket for logging
  logger.setActiveWebSocket(ws);
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'run_design':
          console.log('🎨 Starting design generation:', data.prompt);
          
          // Clear previous state
          activeDesigns.delete(ws);
          
          // Track design state
          const designState = {
            id: `design_${Date.now()}`,
            prompt: data.prompt,
            assetType: data.assetType,
            withInspiration: data.withInspiration !== false,
            startTime: new Date(),
            status: 'running',
            messages: [],
            phases: []
          };
          
          activeDesigns.set(ws, designState);
          
          // Send initial state
          ws.send(JSON.stringify({
            type: 'design_state',
            state: designState
          }));
          
          try {
            // Run the design agent with streaming
            for await (const event of runDesignAgentStreaming(
              data.prompt, 
              data.assetType,
              data.withInspiration
            )) {
              if (event.type === 'stream-event') {
                // Handle streaming events
                if (event.data.type === 'text') {
                  ws.send(JSON.stringify({
                    type: 'stream_text',
                    text: event.data.text
                  }));
                } else if (event.data.type === 'tool-use') {
                  // Track tool usage for visualization
                  ws.send(JSON.stringify({
                    type: 'tool_use',
                    tool: event.data.name,
                    input: event.data.input
                  }));
                } else if (event.data.type === 'tool-result') {
                  // Send tool results
                  ws.send(JSON.stringify({
                    type: 'tool_result',
                    tool: event.data.name,
                    result: event.data.result
                  }));
                }
              } else if (event.type === 'message') {
                // Store messages for conversation view
                designState.messages.push(event.data);
              }
            }
            
            // Design completed
            designState.status = 'completed';
            designState.endTime = new Date();
            
            // Read the output directory for final results
            const outputDir = process.env.DESIGN_OUTPUT_DIR;
            if (outputDir) {
              designState.outputDir = outputDir;
              
              // Read metadata
              try {
                const metadataPath = path.join(outputDir, 'metadata', 'design_info.json');
                const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
                designState.metadata = metadata;
              } catch (e) {
                console.error('Error reading metadata:', e);
              }
              
              // Read research report
              try {
                const reportPath = path.join(outputDir, 'reports', 'research_report.md');
                const report = await fs.readFile(reportPath, 'utf-8');
                designState.researchReport = report;
              } catch (e) {
                console.error('Error reading research report:', e);
              }
              
              // List all images
              try {
                const inspirationDir = path.join(outputDir, 'inspiration');
                const draftsDir = path.join(outputDir, 'drafts');
                const mediumDir = path.join(outputDir, 'medium');
                const finalDir = path.join(outputDir, 'final');
                
                designState.images = {
                  inspiration: await listImages(inspirationDir),
                  drafts: await listImages(draftsDir),
                  medium: await listImages(mediumDir),
                  final: await listImages(finalDir)
                };
              } catch (e) {
                console.error('Error listing images:', e);
              }
            }
            
            ws.send(JSON.stringify({
              type: 'design_complete',
              state: designState
            }));
            
          } catch (error) {
            console.error('❌ Design generation error:', error);
            designState.status = 'error';
            designState.error = error.message;
            
            ws.send(JSON.stringify({
              type: 'design_error',
              error: error.message,
              state: designState
            }));
          }
          break;
          
        case 'stop_design':
          console.log('⏹️ Stopping design generation');
          const state = activeDesigns.get(ws);
          if (state) {
            state.status = 'stopped';
            activeDesigns.delete(ws);
          }
          ws.send(JSON.stringify({ type: 'design_stopped' }));
          break;
          
        case 'get_image':
          // Serve image files from output directory
          try {
            const imagePath = path.join(process.cwd(), '.output', data.path);
            const imageData = await fs.readFile(imagePath);
            const base64 = imageData.toString('base64');
            const mimeType = data.path.endsWith('.png') ? 'image/png' : 'image/jpeg';
            
            ws.send(JSON.stringify({
              type: 'image_data',
              path: data.path,
              data: `data:${mimeType};base64,${base64}`
            }));
          } catch (error) {
            console.error('Error reading image:', error);
            ws.send(JSON.stringify({
              type: 'image_error',
              path: data.path,
              error: error.message
            }));
          }
          break;
      }
    } catch (error) {
      console.error('❌ WebSocket error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: error.message 
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('👋 Client disconnected');
    activeDesigns.delete(ws);
    
    // Clear the active WebSocket
    if (logger.activeWebSocket === ws) {
      logger.activeWebSocket = null;
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// Helper function to list images in a directory
async function listImages(dir) {
  try {
    const files = await fs.readdir(dir);
    const images = files.filter(f => 
      f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp')
    );
    
    const imageDetails = await Promise.all(images.map(async (file) => {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);
      const relativePath = path.relative(path.join(process.cwd(), '.output'), filePath);
      
      // Try to read associated metadata
      let metadata = {};
      const metadataPath = filePath.replace(/\.(png|jpg|jpeg|webp)$/, '_metadata.json');
      try {
        metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      } catch (e) {
        // No metadata file
      }
      
      return {
        name: file,
        path: relativePath,
        size: stats.size,
        created: stats.ctime,
        metadata
      };
    }));
    
    return imageDetails;
  } catch (error) {
    console.error(`Error listing images in ${dir}:`, error);
    return [];
  }
}

// API endpoint to get design history
app.get('/api/designs', async (req, res) => {
  try {
    const outputDir = path.join(process.cwd(), '.output');
    const dirs = await fs.readdir(outputDir);
    
    const designs = await Promise.all(dirs.map(async (dir) => {
      const designDir = path.join(outputDir, dir);
      const stats = await fs.stat(designDir);
      
      if (!stats.isDirectory()) return null;
      
      // Try to read metadata
      let metadata = {};
      try {
        const metadataPath = path.join(designDir, 'metadata', 'design_info.json');
        metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      } catch (e) {
        // No metadata
      }
      
      return {
        id: dir,
        ...metadata,
        created: stats.ctime
      };
    }));
    
    res.json(designs.filter(d => d !== null));
  } catch (error) {
    console.error('Error listing designs:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3456;
server.listen(PORT, () => {
  console.log(`
🎨 Design Demo Server Running!
   
   Local:   http://localhost:${PORT}
   
   Try these examples:
   - Logo design: "Create a modern tech startup logo"
   - Icon design: "Design a shopping cart icon"
   - UI design: "Create a login screen mockup"
   
   Press Ctrl+C to stop
  `);
});