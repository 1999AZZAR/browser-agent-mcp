# Browser Agent MCP Server Dockerfile
FROM mcr.microsoft.com/playwright:v1.44.1-jammy

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source code
COPY . .

# Build the application (runs the echo script we added)
RUN npm run build

# Command to run the application
CMD ["node", "src/server.js"]
