
import { runTask } from "@just-every/task";
import { createDesignAgent } from "./agents/design-agent.js";

export async function runAgent(prompt: string) {
    const agent = createDesignAgent(prompt);
    const stream = runTask(agent, prompt);
    for await (const event of stream) {
        switch(event.type) {
            case 'task_complete':
                console.log('**Complete**', event);
                break;
            case 'tool_start':
                console.log('Message:', event);
                break;
            case 'message_complete':
                console.log('Message:', event);
                break;

        }
    }
}
