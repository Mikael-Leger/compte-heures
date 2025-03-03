require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const channelName = process.env.CHANNEL_ID;
let expectedNumber = 0;
let lastUserId = null;

client.once("ready", () => {
    console.log(`Bot connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
    if (message.channel.name !== channelName || message.author.bot) return;

    const userNumber = parseInt(message.content, 10);

    if (isNaN(userNumber)) {
        await message.channel.send("Fréro c'est pas un nombre ça, on recommence à 0.");

    } else if (!isNaN(userNumber) && userNumber === expectedNumber) {
        if (lastUserId !== null && lastUserId === message.author.id) {
            await message.channel.send(`Tu peux pas jouer deux fois de suite ${message.author}, on recommence à 0.`);
            expectedNumber = 0;

        } else {
            expectedNumber++;
            lastUserId = message.author.id;
        }

    } else {
        if (expectedNumber === 0) {
            await message.channel.send(`Un compte-heures ça commence par 0 tu sais ?`);

        } else {
            await message.channel.send(`${expectedNumber - 1} + 1 ça fait pas ${userNumber} ${message.author}, on recommence à 0.`);

        }
        expectedNumber = 0;

    }
});

client.login(process.env.DISCORD_TOKEN);
