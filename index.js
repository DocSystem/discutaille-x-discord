const { Client, IntentsBitField, GatewayIntentBits, Events } = require('discord.js');
const { WebSocket, RawData } = require('ws');

if (process.env.TOKEN === undefined) {
    console.error('No token provided');
    process.exit(1);
}

const intents = new IntentsBitField();
intents.add(GatewayIntentBits.GuildMessages);
intents.add(GatewayIntentBits.MessageContent);
intents.add(GatewayIntentBits.Guilds);

const client = new Client({ intents: intents });

const websocket = new WebSocket('wss://discutaille.center/shout');
let currentPseudo = null;
let sentMessages = [];

websocket.on('open', () => {
    console.log('Connected to Discutaille websocket');
});

function decodeWsJson(data) {
    data = data.toString();
    data = data.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '\\"')
        .replace(/&#039;/g, "'")
        .replace(/\\x00/g, '')
        .trim();
    return JSON.parse(data);
}

function sendSocketData(data) {
    websocket.send(JSON.stringify(data));
}

function sendShout(message, pseudo) {
    if (pseudo !== currentPseudo) {
        sendSocketData({
            type: 'pseudo',
            pseudo: pseudo
        });
        currentPseudo = pseudo;
    }
    sendSocketData({
        type: 'shout',
        pseudo: pseudo,
        message: message
    });
    sentMessages.push({pseudo: pseudo, message: message});
}

websocket.on('message', async (s) => {
    const data = decodeWsJson(s);
    if (data.type === "message") {
        if (sentMessages.find((m) => m.pseudo === data.pseudo && m.message === data.message)) {
            sentMessages = sentMessages.filter((m) => m.pseudo !== data.pseudo && m.message !== data.message);
            return;
        }
        const pseudo = data.pseudo;
        const channel = await client.channels.cache.get('1105501399074230377');
        const webhooks = await channel.fetchWebhooks();
        let wh = webhooks.find((w) => w.name === pseudo);
        // create webhook if not exists
        if (!wh) {
            const channel = await client.channels.cache.get('1105501399074230377');
            wh = await channel.createWebhook({
                name: pseudo,
                avatar: 'https://discutaille.center/assets/skul.png'
            });
        }
        if (data.message.length < 2000) {
            await wh.send({
                content: data.message
            });
        }
        else {
            const messages = data.message.match(/.{1,2000}/g);
            for (const message of messages) {
                await wh.send({
                    content: message
                });
            }
        }
    }
})

client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;
    sendShout(message.content, message.author.username);
});

client.once(Events.ClientReady, () => {
    console.log(`Logged in to Discord as ${client.user.tag}!`)
})

client.login(process.env.TOKEN);
