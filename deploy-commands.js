// Require the necessary discord.js classes
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json');

// Create commands
const commands = [
    new SlashCommandBuilder()
        .setName('chewybot_open_emporium')
        .setDescription('Opens the store and sets the selling price of an Ascension Raffle Ticket')
        .setDefaultPermission(false)
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Sets the number of winners')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Sets the duration of the lottery (h)')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('price')
                .setDescription('Sets the price of each ascension ticket (autofilled value 4)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('chewybot_close_emporium')
        .setDescription('Close the store and stops all sales of Ascension Raffle Ticket')
        .setDefaultPermission(false),

    new SlashCommandBuilder()
        .setName('chewybot_check_supply_and_rrp')
        .setDescription('Checks the total supply of wishes in circulation and shows Recommended Retail Price (RRP)')
        .setDefaultPermission(false)
        .addIntegerOption(option =>
            option.setName('bin_range')
                .setDescription('Sets the range for each bin')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('chewybot_purchase_ticket')
        .setDescription('Purchase a Ascesion Raffle Ticket with Ascension Wishes')
        .setDefaultPermission(false),

    new SlashCommandBuilder()
        .setName('chewybot_burn_all_tickets')
        .setDescription('Returns a list of all Ascension Raffle Ticket Holders and removes the associated roles')
        .setDefaultPermission(false),
]
    .map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);