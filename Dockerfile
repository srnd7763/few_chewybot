FROM node:latest

# Create the bot's directory
RUN mkdir -p /root/C.H.E.W.Y./bot
WORKDIR /root/C.H.E.W.Y./bot

COPY package.json /root/C.H.E.W.Y./bot
RUN npm install

COPY . /root/C.H.E.W.Y./bot

# Start the bot.
CMD ["node", "index.js"]