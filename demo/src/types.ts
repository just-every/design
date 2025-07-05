/**
 * Type definitions for the Design Demo
 */

import { DESIGN_ASSET_TYPES } from '../../src/constants.js';

export interface LLMRequest {
  id: string;
  agentId?: string;
  provider: string;
  model: string;
  timestamp: string;
  messages: Array<{
    role: string;
    content: string | Array<any>;
  }>;
  temperature?: number;
  maxTokens?: number;
  response?: {
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    duration?: number;
  };
  error?: string;
  duration?: number; // Add duration at the top level for compatibility
}

export interface ImageMetadata {
  unique_id?: string;
  source?: string;
  query?: string;
  title?: string;
  description?: string;
  url?: string;
  thumbnail_url?: string;
  engine?: string;
  score?: number;
  selection_reason?: string;
  round?: number;
  prompt?: string;
}

export interface ImageInfo {
  name: string;
  path: string;
  size: number;
  created: string;
  metadata: ImageMetadata;
}

export interface DesignImages {
  inspiration: ImageInfo[];
  drafts: ImageInfo[];
  medium: ImageInfo[];
  final: ImageInfo[];
}

export interface DesignState {
  id: string;
  prompt: string;
  assetType?: DESIGN_ASSET_TYPES;
  withInspiration: boolean;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'error' | 'stopped';
  error?: string;
  messages: any[];
  phases: DesignPhase[];
  outputDir?: string;
  metadata?: {
    design_id: string;
    design_type: string;
    user_prompt: string;
    created_at: string;
  };
  researchReport?: string;
  images?: DesignImages;
}

export interface DesignPhase {
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  startTime?: Date;
  endTime?: Date;
  details?: any;
}

export interface ToolUse {
  tool: string;
  input: any;
  timestamp: Date;
}

export interface ToolResult {
  tool: string;
  result: any;
  timestamp: Date;
}

export interface StreamText {
  text: string;
  timestamp: Date;
}

export type DesignExample = {
  id: string;
  title: string;
  prompt: string;
  assetType: DESIGN_ASSET_TYPES;
  withInspiration?: boolean;
  description?: string;
};