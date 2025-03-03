require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
} = require("discord.js");
const fs = require("fs");
const express = require("express");
const app = express();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.BOT_CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
    new SlashCommandBuilder()
        .setName("highscore")
        .setDescription("Affiche le meilleur score du serveur"),
    new SlashCommandBuilder()
        .setName("fails")
        .setDescription("Affiche les nuls"),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        console.log("⏳ Enregistrement des commandes globales...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
            body: commands,
        });
        console.log("✅ Commandes globales enregistrées !");
    } catch (error) {
        console.error("❌ Erreur lors de l'enregistrement :", error);
    }
})();

app.get("/", (req, res) => {
    res.send("Bot is alive!");
});

app.listen(3000, () => {
    console.log("Server is running!");
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const channelName = process.env.CHANNEL_ID;
let expectedNumber = 0;
let highScore = 0;
let failedUsers = [];
let lastUserId = null;

client.once("ready", () => {
    console.log(`Bot connecté en tant que ${client.user.tag}`);
});

const lastMessages = new Map();

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === "highscore") {
        const dataJson = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        await interaction.reply(
            `Le meilleur score du serveur est ${dataJson.highScore}.`,
        );
    } else if (interaction.commandName === "fails") {
        await showFails(interaction);
    }
});

const showFails = async (interaction) => {
    const dataJson = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    if (dataJson.failedUsers.length === 0) {
        await interaction.reply('Pas de nuls pour le moment.');
        return;
    }

    const highestUser = dataJson.failedUsers.reduce((max, failedUser) => (failedUser.count > max.count ? failedUser : max), dataJson.failedUsers[0]);
    let text = `La liste des nuls (Félicitations à <@${highestUser.user.id}>) :\n\n`;
    dataJson.failedUsers.sort((a, b) => a.count - b.count).forEach((failedUser) => {
        text += `${failedUser.user.tag}: ${failedUser.count} fois\n`;
    });
    await interaction.reply(text);
};

const onUserSuccess = (message) => {
    expectedNumber++;
    if (highScore < expectedNumber) {
        highScore = expectedNumber;
    }
    lastUserId = message.author;

    updateDataJson();
}

const onUserFail = async (user, message, messageText) => {
    const userFound = failedUsers.find(
        (failedUser) => failedUser.user.id === user.id,
    );
    if (userFound) {
        userFound.count++;
    } else {
        failedUsers.push({ user, count: 1 });
    }
    await message.channel.send(messageText);
    expectedNumber = 0;

    updateDataJson();
};

const updateDataJson = () => {
    const data = {
        expectedNumber,
        highScore,
        failedUsers
    }
    fs.writeFileSync('data.json', JSON.stringify(data, null, 4), 'utf8');
}

const retrieveDataJson = () => {
    const dataJson = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    expectedNumber = dataJson.expectedNumber ?? 0;
    highScore = dataJson.highScore ?? 0;
    failedUsers = dataJson.failedUsers ?? [];
}

client.on("messageUpdate", async (oldMessage, newMessage) => {
    if (newMessage.channel.name !== channelName) return;
    if (!oldMessage.content || !newMessage.content) return;

    if (lastMessages.get(newMessage.channel.id) === newMessage.id) {
        await onUserFail(
            newMessage.author,
            newMessage,
            `Tu pensais m'avoir en modifiant ton message petit chenapan <@${newMessage.author.id}>, on recommence à 0. (Shame on you)`,
        );
    }
});

client.on("messageCreate", async (message) => {
    if (message.channel.name !== channelName || message.author.bot) return;
    lastMessages.set(message.channel.id, message.id);
    const dataJson = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    const numberFromJson = dataJson.expectedNumber;

    if (numberFromJson === 0 && message.content.toLowerCase() === "zero") {
        onUserSuccess(message);
        return;
    }
    if (!Number.isInteger(Number(message.content))) {
        await onUserFail(
            message.author,
            message,
            `Essaies pas de tricher ${message.author} mon p'tit voyou et utilise un nombre entier, on recommence à 0.`,
        );

        return;
    }
    if (message.content.includes(".")) {
        await onUserFail(
            message.author,
            message,
            `Tu voulais faire le mâlin avec tes virgules ${message.author} et boom, on recommence à 0.`,
        );
        return;
    }

    const userNumber = parseInt(message.content, 10);

    if (!isNaN(userNumber) && userNumber === numberFromJson) {
        if (
            lastUserId !== null &&
            lastUserId === message.author &&
            numberFromJson !== 0
        ) {
            await onUserFail(
                message.author,
                message,
                `Tu peux pas jouer deux fois de suite ${message.author}, on recommence à 0.`,
            );
        } else {
            onUserSuccess(message);
        }
        return;
    }

    if (isNaN(userNumber)) {
        await onUserFail(
            message.author,
            message,
            `Fréro ${message.author} c'est pas un nombre ça, on recommence à 0.`,
        );
    } else if (numberFromJson === 0) {
        await onUserFail(
            message.author,
            message,
            `Un compte-heures ça commence par 0 ${message.author} tu sais ?`,
        );
    } else {
        await onUserFail(
            message.author,
            message,
            `Apprend à compter avant d'écrire n'importe quoi ${message.author}, on recommence à 0.`,
        );
    }
});

client.login(TOKEN);

retrieveDataJson();
