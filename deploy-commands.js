// Require the necessary discord.js classes
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json');

// Create commands
const commands = [
    new SlashCommandBuilder()
        .setName('chewybot_open_emporium')
        .setDescription('Opens the store and sets the selling price of an Ascension Lottery Ticket')
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Sets the number of winners')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('minimum')
                .setDescription('Sets the minimum number of wishes needed to take part in lottery')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Sets the duration of the lottery (H)')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('price')
                .setDescription('Sets the price of each ascension ticket')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('chewybot_pause_sale')
        .setDescription('Temporarily close the store and stops all sales of Ascension Lottery Ticket'),

    new SlashCommandBuilder()
        .setName('chewybot_resume_sale')
        .setDescription('Reopen the store and resumes sales of Ascension Lottery Ticket'),

    new SlashCommandBuilder()
        .setName('chewybot_check_wish_supply')
        .setDescription('Checks the total supply of wishes in circulation and displays a histogram')
        .addIntegerOption(option =>
            option.setName('bin_range')
                .setDescription('Sets the range for each bin')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('chewybot_burn_all_tickets')
        .setDescription('Returns a list of all Ascension Lottery Ticket Holders and removes the associated roles'),

    new SlashCommandBuilder()
        .setName('chewybot_set_no_of_winners')
        .setDescription('Edits the number of winners')
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('sets the number of winners to be drawn')
                .setRequired(true)),
]
    .map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);