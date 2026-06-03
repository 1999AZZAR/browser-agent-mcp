#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { TOOLS, handleToolCall } = require('./tools');

const server = new Server(
    { name: 'general-browser-agent', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        return await handleToolCall(name, args);
    } catch (e) {
        return {
            isError: true,
            content: [{ type: 'text', text: `Error: ${e.message}` }]
        };
    }
});

async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP] General Browser Agent running on stdio');
}

run().catch(console.error);
