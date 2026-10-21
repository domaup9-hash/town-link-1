const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Bot is active and running!');
});

app.listen(port, () => {
  console.log(`Web server running on port ${port}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag} successfully!`);
});

client.on('messageCreate', message => {
  if (message.content === '!ping') {
    message.reply('Pong! 🚀');
  }
});

process.env.TOKEN
