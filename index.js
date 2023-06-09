const { Client, IntentsBitField, GatewayIntentBits, Events } = require('discord.js');
const { WebSocket } = require('ws');
const https = require("https");
const ppgen = require("./ppgen");

if (process.env.TOKEN === undefined) {
    console.error('No token provided');
    process.exit(1);
}

const intents = new IntentsBitField();
intents.add(GatewayIntentBits.GuildMessages);
intents.add(GatewayIntentBits.MessageContent);
intents.add(GatewayIntentBits.Guilds);

const client = new Client({ intents: intents });

let websocket = new WebSocket('wss://discutaille.center/shout');
let currentPseudo = null;
let sentMessages = [];

websocket.on('open', () => {
    console.log('Connected to Discutaille websocket');
});

function wsCloseHandler() {
    console.log('Disconnected from Discutaille websocket');
    setTimeout(() => {
        // try to reconnect
        try {
            websocket = new WebSocket('wss://discutaille.center/shout');
            websocket.on('open', () => {
                console.log('Connected to Discutaille websocket');
            });
            websocket.on('close', wsCloseHandler);
            websocket.on('message', wsMessageHandler);
        } catch (e) {
            console.error(e);
            console.log('Retrying in 5 seconds...');
            wsCloseHandler();
        }
    }, 5000);
}

async function wsMessageHandler(s)  {
    const data = decodeWsJson(s);
    if (data.type === "message") {
        if (sentMessages.find((m) => m.pseudo === data.pseudo && m.message === data.message)) {
            sentMessages = sentMessages.filter((m) => m.pseudo !== data.pseudo && m.message !== data.message);
            return;
        }
        const pseudo = data.pseudo;
        const channel = await client.channels.cache.get('1105501399074230377');
        const webhooks = await channel.fetchWebhooks();
        let wh = webhooks.find((w) => w.name === "Discutaille");
        // create webhook if not exists
        if (!wh) {
            const channel = await client.channels.cache.get('1105501399074230377');
            wh = await channel.createWebhook({
                name: "Discutaille",
                avatar: 'https://discutaille.center/assets/skul.png'
            });
        }
        if (data.message.trim().length > 0) {
            if (data.message.length < 2000) {
                await wh.send({
                    content: data.message.trim(),
                    username: pseudo,
                    avatarURL: process.env.SERVERNAME + "/avatar?pseudo=" + encodeURIComponent(pseudo)
                });
            }
            else {
                const messages = data.message.trim().match(/.{1,2000}/g);
                for (const message of messages) {
                    if (message.length > 0) {
                        await wh.send({
                            content: message,
                            username: pseudo,
                            avatarURL: process.env.SERVERNAME + "/avatar?pseudo=" + encodeURIComponent(pseudo)
                        });
                    }
                }
            }
        }
    }
    else if (data.type === "splashupdate") {
        client.user.setActivity(data.splash);
    }
}

websocket.on('close', wsCloseHandler);

websocket.on('message', wsMessageHandler);

async function getSplashText() {
    return new Promise((resolve, reject) => {
        https.get("https://discutaille.center/api/splash", (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                resolve(data);
            });
        }).on("error", (err) => {
            reject(err);
        });
    });
}

function decodeWsJson(data) {
    data = data.toString();
    data = data.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '\\"')
        .replace(/&#039;/g, "'");
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

client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;
    let msg = message.content;
    if (message.attachments.size > 0) {
        if (msg.length > 0) {
            msg += "\n";
        }
        msg += message.attachments.map((a) => a.url).join("\n");
    }
    // replace mentions
    msg = msg.replace(/<@!?(\d+)>/g, (match, id) => {
        const user = client.users.cache.get(id);
        if (user) {
            return "@" + user.username;
        }
        return match;
    });
    // replace emojis
    msg = msg.replace(/<a?:\w+:(\d+)>/g, match => {
        return ":" + match.split(":")[1] + ":";
    });
    sendShout(msg, message.author.username);
});

client.once(Events.ClientReady, () => {
    console.log(`Logged in to Discord as ${client.user.tag}!`);
    getSplashText().then((text) => {
        client.user.setActivity(text);
    });
})

client.login(process.env.TOKEN);
ppgen.app.listen(80, () => {
    console.log("PPGen listening on port 80");
})
