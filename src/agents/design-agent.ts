/**
 * Design Agent - Orchestrates the entire design generation process using MECH
 */

import { runMECH, runMECHStreaming } from '../interfaces/mech.js';
import { createToolFunction, type ResponseInput, Agent, type AgentDefinition, type ProviderStreamEvent } from '@just-every/ensemble';
import {
    DESIGN_ASSET_TYPES,
    DESIGN_SEARCH_ENGINES,
    DESIGN_ASSET_REFERENCE,
} from '../constants.js';
import { v4 as uuidv4 } from 'uuid';
import { 
    DesignAgentToolsImpl, 
    type DesignAgentState 
} from './design-agent-tools-impl.js';
import {
    generateStatusPrompt,
    generateTypePrompt,
    generateResearchPrompt,
    generateInspirationPrompt,
    generateDraftPrompt,
    generateMediumPrompt,
    generateHighQualityPrompt,
    generateAgentInstructions,
} from './design-agent-prompts.js';

/**
 * Design progress tracker interface
 */
interface DesignProgress {
    phase: string;
    totalPhases: number;
    currentPhase: number;
    tasks: {
        id: string;
        description: string;
        status: 'pending' | 'in_progress' | 'completed';
    }[];
    startTime: Date;
}

/**
 * Create the design agent configuration
 */
export function createDesignAgent(
    userPrompt: string,
    assetType?: DESIGN_ASSET_TYPES,
    withInspiration: boolean = true,
): Agent {
    // Initialize state with temporary values
    const state: DesignAgentState = {
        designId: 'pending', // Will be set by set_design tool
        designType: assetType,
        outputDir: '', // Will be set by set_design tool
        userPrompt,
    };
    
    // Create tools implementation
    const toolsImpl = new DesignAgentToolsImpl(state);

    // Add status to messages
    const addOperatorStatus = async(messages: ResponseInput): Promise<ResponseInput> => {
        // Add the system status to the messages
        messages.push({
            type: 'message',
            role: 'developer',
            content: await generateStatusPrompt(state),
        });

        if(!state.designType || !state.outputDir) {
            messages.push({
                type: 'message',
                role: 'developer',
                content: generateTypePrompt(),
            });
        }
        else if(!state.researchReport) {
            messages.push({
                type: 'message',
                role: 'developer',
                content: generateResearchPrompt(state.designType),
            });
        }
        else if(withInspiration && !state.designInspiration) {
            messages.push({
                type: 'message',
                role: 'developer',
                content: generateInspirationPrompt(),
            });
        }
        else if(!state.draftDesigns) {
            messages.push({
                type: 'message',
                role: 'developer',
                content: generateDraftPrompt(),
            });
        }
        else if(state.draftDesigns && !state.mediumDesigns) {
            messages.push({
                type: 'message',
                role: 'developer',
                content: generateMediumPrompt(),
            });
        }
        else if(state.mediumDesigns && !state.finalDesign) {
            messages.push({
                type: 'message',
                role: 'developer',
                content: generateHighQualityPrompt(),
            });
        }

        return messages;
    };

    // Create the Agent instance with all required properties
    const agentConfig: AgentDefinition = {
        name: 'DesignAgent',
        agent_id: `design_${uuidv4().substring(0, 6)}`, // Temporary ID for agent instance
        modelClass: 'vision_mini',
        tools: [
            createToolFunction(
                (design_type: DESIGN_ASSET_TYPES, design_id: string) => toolsImpl.setDesign(design_type, design_id),
                'Initialize the design project with type and unique ID',
                {
                    design_type: {
                        type: 'string',
                        description: `Based on the request which type are we most likely designing?`,
                        enum: Object.keys(DESIGN_ASSET_REFERENCE),
                    },
                    design_id: {
                        type: 'string',
                        description: 'A short, descriptive ID for this design project (e.g. "techflow_logo", "saas_homepage"). Will be used as the output directory name.',
                    },
                },
                undefined, // returns
                'set_design'
            ),
            createToolFunction(
                (guide: string, ideal: string, warnings: string, inspiration: string, criteria: string) => 
                    toolsImpl.writeResearchReport(guide, ideal, warnings, inspiration, criteria),
                'Sets the direction for the design based',
                {
                    guide: {
                        type: 'string',
                        description: 'General guidelines on what to focus on',
                    },
                    ideal: {
                        type: 'string',
                        description: 'What\'s ideal characteristics for this design?',
                    },
                    warnings: {
                        type: 'string',
                        description: 'Anything we should avoid?',
                    },
                    inspiration: {
                        type: 'string',
                        description: 'What type of inspiration/reference images should we look for?',
                    },
                    criteria: {
                        type: 'string',
                        description: 'How do we compare the designs we create? Why would one win over the other?',
                    },
                },
                undefined, // returns
                'write_research_report'
            ),
            createToolFunction(
                (context: string, searchConfigs: unknown, judge_criteria: string, count?: number) => 
                    toolsImpl.designSearch(context, searchConfigs, judge_criteria, count),
                'Search multiple design platforms in parallel and select the best results using vision-based ranking',
                {
                    context: {
                        type: 'string',
                        description: 'What context about the request needs to be provided to the search engines and judges? They do not have access to any other conversation history or context, so you need to provide all relevant information. This will be included with the search query and the judge criteria so the LLMs using them know what they are doing.',
                    },
                    searchConfigs: {
                        type: 'array',
                        description: 'Array of search configurations',
                        items: {
                            type: 'object',
                            properties: {
                                engine: {
                                    type: 'string',
                                    description: 'Design search engine',
                                    enum: DESIGN_SEARCH_ENGINES,
                                },
                                query: {
                                    type: 'string',
                                    description: 'Search query',
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Max results',
                                    optional: true,
                                },
                            },
                            required: ['engine', 'query'],
                        },
                    },
                    judge_criteria: {
                        type: 'string',
                        description: 'What criteria should the searches use to pick the best reference images - i.e. what are they looking for? 1 - 2 sentences.',
                    },
                    count: {
                        type: 'number',
                        description: 'How many final results should be returned from this set of searches? Default: 3',
                        optional: true,
                    }
                },
                undefined, // returns
                'design_search'
            ),
            createToolFunction(
                (context: string, promptConfigs: Array<{ prompt: string; inspirationGridIds?: number[]; count?: number; }>) => 
                    toolsImpl.generateDrafts(context, promptConfigs),
                'Generate multiple draft design variations with specific inspiration for each prompt',
                {
                    context: {
                        type: 'string',
                        description: 'What context about the design needs to be provided to the designers? They do not have access to any other conversation history or context, so you need to provide all relevant information.',
                    },
                    promptConfigs: {
                        type: 'array',
                        description: 'Array of prompt configurations, each with its own creative direction and optional inspiration images',
                        items: {
                            type: 'object',
                            properties: {
                                prompt: {
                                    type: 'string',
                                    description: 'The creative prompt for this variation',
                                },
                                inspirationGridIds: {
                                    type: 'array',
                                    description: 'Optional: specific inspiration image unique IDs to use for this prompt (use the numbers shown in the top-left corner of images, e.g., #5, #7)',
                                    items: { type: 'number' },
                                    optional: true,
                                },
                                count: {
                                    type: 'number',
                                    description: 'Optional: number of images to generate for this prompt (default: 3)',
                                    optional: true,
                                },
                            },
                            required: ['prompt'],
                        },
                    },
                },
                undefined, // returns
                'generate_drafts'
            ),
            createToolFunction(
                (mediumConfigs?: Array<{ draftGridId: number; prompt?: string; variations?: number; }>) => 
                    toolsImpl.generateMediumQuality(mediumConfigs),
                'Generate medium quality versions with specific prompts and variation counts per draft',
                {
                    mediumConfigs: {
                        type: 'array',
                        description: 'Optional: specific configurations for each draft. If not provided, uses selected drafts with default prompts.',
                        items: {
                            type: 'object',
                            properties: {
                                draftGridId: {
                                    type: 'number',
                                    description: 'Draft unique ID to use as source (use the number shown in the top-left corner)',
                                },
                                prompt: {
                                    type: 'string',
                                    description: 'Optional: specific improvement prompt for this draft',
                                    optional: true,
                                },
                                variations: {
                                    type: 'number',
                                    description: 'Optional: number of variations to generate (default: 3)',
                                    optional: true,
                                },
                            },
                            required: ['draftGridId'],
                        },
                        optional: true,
                    },
                },
                undefined, // returns
                'generate_medium_quality'
            ),
            createToolFunction(
                (additionalInstructions?: string, mediumGridId?: number) => 
                    toolsImpl.generateHighQuality(additionalInstructions, mediumGridId),
                'Generate final high quality version with specific instructions and source selection',
                {
                    additionalInstructions: {
                        type: 'string',
                        description: 'Specific instructions for the final version - describe what improvements, refinements, or adjustments should be made to create the perfect final design',
                        optional: true,
                    },
                    mediumGridId: {
                        type: 'number',
                        description: 'Optional: specific medium design unique ID to use as source (use the number shown in the top-left corner). If not provided, uses the automatically selected best medium design.',
                        optional: true,
                    },
                },
                undefined, // returns
                'generate_high_quality'
            ),
            createToolFunction(
                (designType: 'inspiration' | 'drafts' | 'medium' | 'final' | 'all') => 
                    toolsImpl.deleteDesigns(designType),
                'Delete designs by type to start fresh',
                {
                    designType: {
                        type: 'string',
                        description: 'Type of designs to delete',
                        enum: ['inspiration', 'drafts', 'medium', 'final', 'all'],
                    },
                },
                undefined, // returns
                'delete_designs'
            ),
            createToolFunction(
                (designType: 'draft' | 'medium', gridNumbers: number[], newPrompts?: string[]) => 
                    toolsImpl.remakeDesign(designType, gridNumbers, newPrompts),
                'Remake specific designs by their grid numbers',
                {
                    designType: {
                        type: 'string',
                        description: 'Type of designs to remake',
                        enum: ['draft', 'medium'],
                    },
                    gridNumbers: {
                        type: 'array',
                        description: 'Unique IDs of designs to remake (use the numbers shown in the top-left corner)',
                        items: { type: 'number' },
                    },
                    newPrompts: {
                        type: 'array',
                        description: 'Optional new prompts for each remake',
                        items: { type: 'string' },
                        optional: true,
                    },
                },
                undefined, // returns
                'remake_design'
            ),
        ],
        instructions: generateAgentInstructions(assetType, withInspiration),
        onRequest: async (agent: AgentDefinition, messages: ResponseInput): Promise<[AgentDefinition, ResponseInput]> => {
            messages = await addOperatorStatus(messages);
            return [agent, messages];
        },
    };

    // Create an Agent instance to ensure compatibility with ensemble
    const agent = new Agent(agentConfig);
    
    // Return the agent instance
    return agent;
}

/**
 * Run the complete design generation process using MECH
 */
export async function runDesignAgent(
    assetType: DESIGN_ASSET_TYPES,
    userPrompt: string,
    withInspiration: boolean = true,
    brandAssets: string[] = [] // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<string> {
    const startTime = new Date();

    // Initialize design progress tracker
    // Design progress tracking (future enhancement)
    const designProgress: DesignProgress = { // eslint-disable-line @typescript-eslint/no-unused-vars
        phase: 'Initialization',
        totalPhases: withInspiration ? 5 : 4,
        currentPhase: 0,
        tasks: withInspiration ? [
            { id: '1', description: 'Research and find inspiration images', status: 'pending' },
            { id: '2', description: 'Generate draft variations (auto-selects best 3)', status: 'pending' },
            { id: '4', description: 'Generate medium quality versions (auto-selects best)', status: 'pending' },
            { id: '5', description: 'Generate high quality final image', status: 'pending' },
            { id: '6', description: 'Finalize and return result', status: 'pending' }
        ] : [
            { id: '1', description: 'Generate draft variations (9-12 images)', status: 'pending' },
            { id: '2', description: 'Select best 3 draft concepts', status: 'pending' },
            { id: '3', description: 'Generate medium quality versions (auto-selects best)', status: 'pending' },
            { id: '4', description: 'Generate high quality final image', status: 'pending' },
            { id: '5', description: 'Finalize and return result', status: 'pending' }
        ],
        startTime
    };

    // Create agent with progress tracking
    const agent = createDesignAgent(userPrompt, assetType, withInspiration);

    // Create the task description
    const task = `Generate a ${assetType} design based on: "${userPrompt}"`;

    // Run the agent using MECH
    const result = await runMECH(agent, task);

    // The result contains status, history, and other metadata
    if (result.status === 'complete' && result.history.length > 0) {
        // Get the last assistant message from history
        const lastMessage = result.history[result.history.length - 1];

        // Check if it's a message type with content
        if (lastMessage && 'type' in lastMessage && lastMessage.type === 'message' &&
            'role' in lastMessage && lastMessage.role === 'assistant' &&
            'content' in lastMessage && typeof lastMessage.content === 'string') {
            // Try to extract a file path from the final message
            const pathMatch = lastMessage.content.match(/\/[^\s]+\.png/);
            if (pathMatch) {
                return pathMatch[0];
            }
        }
    }

    throw new Error('Design agent did not produce a final image path');
}

/**
 * Run the complete design generation process using MECH with streaming
 * @returns AsyncGenerator that yields ProviderStreamEvent objects
 */
export async function* runDesignAgentStreaming(
    assetType: DESIGN_ASSET_TYPES,
    userPrompt: string,
    withInspiration: boolean = true,
    brandAssets: string[] = [] // eslint-disable-line @typescript-eslint/no-unused-vars
): AsyncGenerator<ProviderStreamEvent, string, unknown> {
    const startTime = new Date();

    // Initialize design progress tracker
    const designProgress: DesignProgress = { // eslint-disable-line @typescript-eslint/no-unused-vars
        phase: 'Initialization',
        totalPhases: withInspiration ? 5 : 4,
        currentPhase: 0,
        tasks: withInspiration ? [
            { id: '1', description: 'Research and find inspiration images', status: 'pending' },
            { id: '2', description: 'Generate draft variations (auto-selects best 3)', status: 'pending' },
            { id: '4', description: 'Generate medium quality versions (auto-selects best)', status: 'pending' },
            { id: '5', description: 'Generate high quality final image', status: 'pending' },
            { id: '6', description: 'Finalize and return result', status: 'pending' }
        ] : [
            { id: '1', description: 'Generate draft variations (9-12 images)', status: 'pending' },
            { id: '2', description: 'Select best 3 draft concepts', status: 'pending' },
            { id: '3', description: 'Generate medium quality versions (auto-selects best)', status: 'pending' },
            { id: '4', description: 'Generate high quality final image', status: 'pending' },
            { id: '5', description: 'Finalize and return result', status: 'pending' }
        ],
        startTime
    };

    // Create agent with progress tracking
    const agent = createDesignAgent(userPrompt, assetType, withInspiration);

    // Create the task description
    const task = `Generate a ${assetType} design based on: "${userPrompt}"`;

    // Run the agent using MECH streaming API
    const streamingGenerator = runMECHStreaming(agent, task);
    
    let finalImagePath: string | undefined;
    let lastContent = '';

    // Process the stream of events
    for await (const event of streamingGenerator) {
        // Yield each event to the caller
        yield event;

        // Track content for extracting the final path
        if (event.type === 'message_delta' && 'content' in event && event.content) {
            lastContent += event.content;
        } else if (event.type === 'message_complete' && 'content' in event && event.content) {
            lastContent = event.content;
        }

        // Check for task completion
        if (event.type === 'tool_done' && 'tool_call' in event) {
            const toolCall = event.tool_call as { function?: { name?: string; arguments?: { result?: string } } };
            if (toolCall?.function?.name === 'task_complete') {
                // Mark task as complete
                // Try to extract image path from the result
                const result = toolCall.function?.arguments?.result;
                if (result && typeof result === 'string') {
                    const pathMatch = result.match(/\/[^\s]+\.png/);
                    if (pathMatch) {
                        finalImagePath = pathMatch[0];
                    }
                }
            }
        }

        // Handle errors
        if (event.type === 'error') {
            const errorEvent = event as { error?: string };
            throw new Error(`Design agent error: ${errorEvent.error || 'Unknown error'}`);
        }
    }

    // If we didn't find a path in the tool call, try the last content
    if (!finalImagePath && lastContent) {
        const pathMatch = lastContent.match(/\/[^\s]+\.png/);
        if (pathMatch) {
            finalImagePath = pathMatch[0];
        }
    }

    if (finalImagePath) {
        return finalImagePath;
    }

    throw new Error('Design agent did not produce a final image path');
}