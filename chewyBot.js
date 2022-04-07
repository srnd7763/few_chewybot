// Chewy's Humble Emporium of Wishes to Yoink (C.H.E.W.Y)
// v2.0.0

// const { InteractionResponseType } = require('discord-api-types/v9');
const crypto = require('crypto');
const { Client, Intents, MessageAttachment } = require('discord.js');
const { token, guildId, perms, shopFrontendId, commandId, logChannelId } = require('./config.json');

const { ApplicationCommandPermissionType } = require('discord-api-types/v9');
let emporiumState = false;
let ticketPrice = 4; // Setting it to a default base price
let totalWishSupply = 0;

function secondsToDhms(seconds) {
    seconds = Number(seconds);
    let d = Math.floor(seconds / (3600 * 24));
    let h = Math.floor(seconds % (3600 * 24) / 3600);
    let m = Math.floor(seconds % 3600 / 60);
    let s = Math.floor(seconds % 60);

    return [d, h, m, s];
}

// Function to plot distribution of wish supply
function generateHistogram(X, binRange) {
    // inclusive of the first number
    let max = Math.max(...X);
    let min = Math.min(...X);
    let len = max - min + 1;
    let numberOfBins = Math.ceil(len / binRange);

    let bins = new Array(numberOfBins).fill(0);
    let output = {};

    // -min to normalise values for the array
    X.forEach((x) => bins[Math.floor((x - min) / binRange)]++);

    // Output as an object with { bin range, count }
    let binMin = min;
    let binMax = min;
    for (const num of bins) {
        binMax = (binMax + binRange) < max ? binMin + binRange : max;

        if (num) {
            if (binRange === 1 || binMin == binMax) {
                output[`(${binMin})`] = num;
            } else {
                output[`(${binMin} - ${binMax})`] = num;
            }
        }

        binMin += binRange;
    }
    return output;
}

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES] });

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Ready!');
    let guild = client.guilds.cache.get(guildId);
    guild.commands.fetch().then(commands => {
        commands.forEach(command => console.log(`${command.name} : "${command.id}",`))
    });

    /*
        Set permission for the following commands
        1. chewybot_open_emporium: admin only
        2. chewybot_close_emporium: admin only
        3. chewybot_check_supply_and_rrp: guardians
        4. chewybot_burn_all_tickets: admin only
        5. chewybot_purchase_tickets: everyone - when open (Not in this block of code)
    */
    client.application.commands.permissions.set({
        guild: guildId,
        command: commandId['chewybot_open_emporium'],
        permissions: [{
            id: perms['adminId'],
            type: 'ROLE',
            permission: true
        }]
    });

    client.application.commands.permissions.set({
        guild: guildId,
        command: commandId['chewybot_close_emporium'],
        permissions: [{
            id: perms['adminId'],
            type: 'ROLE',
            permission: true
        }]
    });

    client.application.commands.permissions.set({
        guild: guildId,
        command: commandId['chewybot_check_supply_and_rrp'],
        permissions: [{
            id: perms['navigatorId'],
            type: 'ROLE',
            permission: true
        }]
    });

    client.application.commands.permissions.set({
        guild: guildId,
        command: commandId['chewybot_burn_all_tickets'],
        permissions: [{
            id: perms['adminId'],
            type: 'ROLE',
            permission: true
        }]
    });

});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    try {
        // Admin functions (usable only by certain roles)
        let userId = interaction.member.id;
        const guild = client.guilds.cache.get(guildId);

        switch (commandName) {

            case 'chewybot_open_emporium':
                await interaction.deferReply();

                // If emporium is already open (set to true)
                if (emporiumState) {
                    await interaction.editReply('Please wait for the emporium to be **CLOSED** to use this command');
                    return;
                }
                try {
                    emporiumState = true;

                    // Check if user provided the price option (null if options is not given)
                    let setPrice = interaction.options.getInteger('price') ;
                    let duration = interaction.options.getInteger('duration'); //* 60 * 60; // Convert to seconds
                    let noOfWinners = interaction.options.getInteger('winners');

                    if (setPrice != null) {
                        ticketPrice = setPrice;
                    }

                    // Assign permissions to @everyone to be able to use the purchase command
                    client.application.commands.permissions.set({
                        guild: guildId,
                        command: commandId['chewybot_purchase_ticket'],
                        permissions: [{
                            id: guild.roles.everyone.id,
                            type: 'ROLE',
                            permission: true,
                        }]
                    });

                    const now = parseInt(Date.now() / 1000);
                    const user = interaction.member.user;
                    const hostedBy = user.username + '#' + user.discriminator;
                    const hostPic = user.displayAvatarURL();

                    let timeToPrint = secondsToDhms(duration);
                    const deadline = now + (duration);

                    let lotteryBoard = {
                        color: 0x0099ff,
                        title: 'C.H.E.W.Y. PARADIGM LOTTERY',
                        description: 'Purchase a Paradigm lottery ticket in <#958517777554108416> using `chewybot_purchase_ticket` to join this Paradigm Raffle',
                        thumbnail: {
                            url: 'https://cdn.discordapp.com/emojis/828630267983298580.webp?size=128&quality=lossless',
                        },
                        fields: [
                            {
                                name: `**Lottery Details** (Draw Date: <t:${deadline}:F>)`,
                                value: `\n\`\`\`Draw Winners: ${noOfWinners}\nTicket Price: ${ticketPrice} wishe(s)\nTime Left: ${timeToPrint[0]}d ${timeToPrint[1]}h ${timeToPrint[2]}m ${timeToPrint[3]}s\nTotal Wishes Burned: 0\`\`\`\n`,
                            },
                            {
                                name: '**Top Spenders**',
                                value: '```Nil```',
                            },
                        ],
                        timestamp: new Date(),
                        footer: {
                            text: `Hosted by: ${hostedBy}`,
                            icon_url: `${hostPic}`,
                        },
                    };

                    let shopFrontendMsg = await client.channels.cache.get(shopFrontendId).send({ embeds: [lotteryBoard] });

                    //interaction.editReply({ embeds: [lotteryBoard] });

                    // SUPER IMPORTANT 2 LINES TO FETCH LATEST DATA FRO0M GUILD!!!
                    const members = await guild.members.fetch();
                    const roles = await guild.roles.fetch();
                    // SUPER IMPORTANT 2 LINES TO FETCH LATEST DATA FROM GUILD!!!

                    let lotteryActive = setInterval(function updateLotteryBoard() {
                        let timeRemaining = Math.max(0, deadline - parseInt(Date.now() / 1000));

                        timeToPrint = secondsToDhms(timeRemaining);
                        let participantArray = {};

                        let allALTRoles = roles.filter(role => role.name.endsWith('x Ascension Lottery Ticket'));

                        for (const role of allALTRoles) {
                            let count = parseInt(role[1].name.split('x')[0]);

                            guild.roles.cache.get(role[0]).members.map((m) => {
                                let nickname = m.user.username + '#' + m.user.discriminator;
                                participantArray[nickname] = count ;
                            });
                        }
                        const wishesBurned = Object.keys(participantArray).length == 0 ? 0 : Object.values(participantArray).reduce((a, b) => a + b) * ticketPrice;

                        const sortedValues = Object.entries(participantArray).sort(([, a], [, b]) => b - a);
                        let topSpenders = '';


                        for (let i = 0; i < sortedValues.length; i++) {
                            if (i < 3) {
                                topSpenders += `${i + 1}. ${sortedValues[i][0]}\n`;
                            }
                        }

                        // Once time is up, have one final edit to the Lottery Announcement and close the Emporium
                        if (timeRemaining <= 0) {

                            lotteryBoard['description'] = 'The Lottery has ended. Please wait for winner(s) to be drawn';

                            lotteryBoard['fields'] = [
                                {
                                    name: '-- THE DRAW HAS ENDED --',
                                    value: `\n\`\`\`Drawing ${noOfWinners} winners, standby...\nTotal Wishes Burned: ${wishesBurned}\`\`\`\n`,
                                },
                                {
                                    name: '**Top Spenders**',
                                    value: `\`\`\`${topSpenders}\`\`\``,
                                },
                            ];

                            clearInterval(lotteryActive);
                            shopFrontendMsg.edit({ embeds: [lotteryBoard] });

                            emporiumState = false;

                            client.channels.cache.get(shopFrontendId).send('----------- Emporium is now officially **CLOSED** -----------');
                            client.channels.cache.get(logChannelId).send('The draw has ended. Please run `/chewybot_burn_all_tickets`');

                            // Remove permission if emporium is closed
                            client.application.commands.permissions.set({
                                guild: guildId,
                                command: commandId['chewybot_purchase_ticket'],
                                permissions: [{
                                    id: guild.roles.everyone.id,
                                    type: 'ROLE',
                                    permission: false,
                                }]
                            });

                            return;
                        }

                        lotteryBoard['fields'] = [
                            {
                                name: `Lottery Details (Draw Date: <t:${deadline}:F>)`,
                                value: `\n\`\`\`Draw Winners: ${noOfWinners}\nTicket Price: ${ticketPrice} wishes\nTime Left: ${timeToPrint[0]}d ${timeToPrint[1]}h ${timeToPrint[2]}m ${timeToPrint[3]}s\nTotal Wishes Burned: ${wishesBurned}\`\`\`\n`,
                            },
                            {
                                name: '**Top Spenders**',
                                value: `\`\`\`${topSpenders} \`\`\``,
                            },
                        ];

                        shopFrontendMsg.edit({ embeds: [lotteryBoard] });

                    }, 5000);

                    await interaction.editReply(`Lottery has started with ${noOfWinners} winner(s) and ${ticketPrice} wishes per lottery ticket in <#${shopFrontendId}>`);
                    await client.channels.cache.get(logChannelId).send(`<@${userId}> has **OPENED** the emporium with Ascension Lottery Tickets on sale for **__${ticketPrice} Ascension Wishes__** per ticket`);

                } catch (e) {
                    console.log(e);
                    console.log('An error has occured when opening the emporium. Rolling back');

                    // Close emporium and remove roles from everyone
                    emporiumState = false;

                    // Remove permissions from @everyone for the purchase command
                    client.application.commands.permissions.set({
                        guild: guildId,
                        command: commandId['chewybot_purchase_ticket'],
                        permissions: [{
                            id: guild.roles.everyone.id,
                            type: 'ROLE',
                            permission: false,
                        }]
                    });
                }

                return;

            case 'chewybot_check_supply_and_rrp':
                await interaction.deferReply({ ephemeral: true });

                // Calculate total number of wishes in supply and recommended retail price (RRP)
                try {
                    // SUPER IMPORTANT 2 LINES TO FETCH LATEST DATA FROM GUILD!!!
                    const members = await guild.members.fetch();
                    const roles = await guild.roles.fetch();
                    // SUPER IMPORTANT 2 LINES TO FETCH LATEST DATA FROM GUILD!!!

                    const allAWRoles = roles.filter(role => role.name.endsWith('x Ascension Wish'));
                    let wishArray = [];

                    if (allAWRoles) {
                        // For each Ascension Wish role, count all members of each role, fill those values in a temp array and push it to final array
                        for (const role of allAWRoles) {
                            let roleWishes = parseInt(role[1].name.split('x')[0]);
                            let memberCount = roles.get(role[0]).members.size;
                            let tempArr = new Array(memberCount).fill(roleWishes);
                            wishArray.push(...tempArr);
                        }

                        totalWishSupply = wishArray.reduce((a, b) => a + b, 0);

                        let binRange = interaction.options.getInteger('bin_range');
                        let wishDistribution = generateHistogram(wishArray, binRange);

                        let response = `**Total Wishes Currently in Circulation: __${totalWishSupply}__**\n\n**Wish Distribution** (Bin Range = ${binRange})\n\n`;

                        for (const bin in wishDistribution) {
                            response += `${bin} : ${wishDistribution[bin]}\n`;
                        }

                        await interaction.editReply(response);
                    }

                } catch (e) {
                    console.log(e);
                    await interaction.editReply('An error was encountered when executing chewybot_check_recommended_rates, please try again');
                }

                return;

            case 'chewybot_purchase_ticket':
                // Not sure if this will ever trigger but better safe than sorry
                // If emporum is not open, unable to purchase
                await interaction.deferReply({ ephemeral: true });

                if (!emporiumState) {
                    await interaction.editReply('Please wait for the emporium to be **OPEN** to use this command');
                    return;
                }

                try {
                    const member = interaction.member;

                    // SUPER IMPORTANT 2 LINES TO FETCH LATEST DATA FROM GUILD!!!
                    const members = await guild.members.fetch();
                    const roles = await guild.roles.fetch();
                    // SUPER IMPORTANT 2 LINES TO FETCH LATEST DATA FROM GUILD!!!

                    const prevAWRole = member.roles.cache.find(role => role.name.endsWith('x Ascension Wish'));
                    let prevAWCount = 0;
                    let newAWCount = -1;

                    if (!prevAWRole) {
                        interaction.editReply('You do not have sufficient wishes to purchase an Ascension Lottery Ticket');
                        return;
                    }
                    prevAWCount = parseInt(prevAWRole.name.substring(0, prevAWRole.name.indexOf('x')));

                    if (prevAWCount < ticketPrice) {
                        interaction.editReply('You do not have sufficient wishes to purchase an Ascension Lottery Ticket');
                        return;
                    }

                    let findAWRole = undefined;

                    // Code to deduct wishes
                    try {
                        await member.roles.remove(prevAWRole.id);
                        newAWCount = prevAWCount - ticketPrice;

                        if (newAWCount != 0) {
                            // Deduct ascension wishes first
                            findAWRole = guild.roles.cache.find(role => role.name === newAWCount + 'x Ascension Wish');

                            // Create role if it does not exist in the server
                            if (!findAWRole || findAWRole == undefined) {
                                findAWRole = await guild.roles.create({
                                    name: newAWCount + 'x Ascension Wish',
                                    color: 'GREEN'
                                });
                            }

                            await member.roles.add(findAWRole.id);
                        }

                    // Catch any errors and rollback if issues occur
                    } catch (e) {
                        console.log('An error while deducting wishes, adding previous wishes back (if any)')
                        if (prevAWRole) {
                            await member.roles.add(prevAWRole.id);
                        }
                        return;
                    }

                    // Code to add or increment ALT role
                    const prevALTRole = member.roles.cache.find(role => role.name.endsWith('x Ascension Lottery Ticket'));
                    let findALTRole = undefined;
                    try {
                        // Check if member alread has a role
                        let prevALTCount = 0;

                        // If there was a previous role, add to count and remove role
                        if (prevALTRole) {
                            prevALTCount = parseInt(prevALTRole.name.substring(0, prevALTRole.name.indexOf('x')));
                            await member.roles.remove(prevALTRole.id);
                        }

                        // Search guild if this role already exists
                        let newALTCount = prevALTCount + 1;
                        findALTRole = guild.roles.cache.find(role => role.name === newALTCount + 'x Ascension Lottery Ticket');

                        // If role is not found, create new role
                        if (!findALTRole || findALTRole == undefined) {
                            findALTRole = await guild.roles.create({
                                name: newALTCount + 'x Ascension Lottery Ticket',
                                color: 'BLACK',
                            });
                        }

                        // Add role to member
                        await member.roles.add(findALTRole.id);

                        interaction.editReply('You have successfully purchased 1 Ascension Lottery Ticket');
                        client.channels.cache.get(logChannelId).send(`**${interaction.member.user.username}#${interaction.member.user.discriminator}** has purchased 1 Ascension Lottery Ticket for **__${ticketPrice} wishe(s)__**\n` +
                                                                        `**Previous:** ${prevAWRole}, ${prevALTRole}`);

                    // Catch any errors and rollback if issues occur
                    } catch (e) {
                        console.log(e);
                        console.log(('An error has occured before granting ALT. Adding previous ALT role back (if any)'));

                        // Rollback Ascension Wish role
                        if (prevAWRole) {
                            await member.roles.add(prevAWRole.id);

                            if (findAWRole != undefined) {
                                await member.roles.remove(findAWRole);
                            }
                        }

                        // Rollback ALT Role (if any)
                        if (prevALTRole) {
                            await member.roles.add(prevALTRole.id);

                            if (findALTRole != undefined || !findALTRole) {
                                await member.roles.remove(findALTRole);
                            }
                        }

                        interaction.editReply('An error has occured. Please try again in a few seconds');
                        return;
                    }

                } catch (e) {
                    console.log(e);
                    console.log('Unexpected error in chewybot_purchase_ticket');
                    await interaction.editReply('An error was encountered when executing chewybot_purchase_ticket, please try again');
                }

                return;

            case 'chewybot_burn_all_tickets':
                await interaction.deferReply();

                // Check if emporium is closed first
                if (emporiumState) {
                    await interaction.editReply('Please wait for the emporium to be **CLOSED** to use this command');
                    return;
                }

                try {
                    await interaction.editReply('------- Burning all tickets, standby -------');

                    // SUPER IMPORTANT 2 LINES TO FETCH LATEST DATA FROM GUILD!!!
                    const members = await guild.members.fetch();
                    const roles = await guild.roles.fetch();
                    // SUPER IMPORTANT 2 LINES TO FETCH LATEST DATA FROM GUILD!!!

                    let allALTRoles = roles.filter(role => role.name.endsWith('x Ascension Lottery Ticket'));
                    let rollback = {};
                    let ticketArray = new Array();
                    let output = '';

                    try {
                        // Retrieve all members with the ALT role and remove them from everyone (included roleback if it fails)
                        for (const role of allALTRoles) {
                            let count = parseInt(role[1].name.split('x')[0]);
                            let participantArray = guild.roles.cache.get(role[0]).members.map(m => m.user);

                            for (let participant of participantArray) {
                                for (let i = 0; i < count; i++) {
                                    ticketArray.push(`${participant.username}#${participant.discriminator}`);
                                }

                                await guild.members.cache.get(participant.id).roles.remove(role[0]);
                                rollback[participant.id] = role[0];
                            }

                        }

                        if (ticketArray.length == 0) {
                            await interaction.editReply('------- No ALTs were burnt -------');
                            return ;
                        }

                        // Shuffle with Fisher-Yates ALgorithm
                        // https://medium.com/@nitinpatel_20236/how-to-shuffle-correctly-shuffle-an-array-in-javascript-15ea3f84bfb
                        for (let i = ticketArray.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * i);
                            const temp = ticketArray[i];
                            ticketArray[i] = ticketArray[j];
                            ticketArray[j] = temp;
                        }

                        // Since we trust the shuffling, take the first entry as the winner
                        let lotteryResults = 'Winner: ' + ticketArray[0];

                        // Add the winner to the array
                        ticketArray.unshift(lotteryResults);

                        // Format the array to be output to file
                        ticketArray.forEach(line => {
                            if (output.length == 0) {
                                output += line + '\n\n[ Lottery Entries ]\n';
                            } else {
                                output += line + '\n';
                            }
                        });

                        // Add all username+discriminator of ALT holders, and winner to a file and return
                        const bufferFile = Buffer.from(output, 'utf-8');
                        const hashSum = crypto.createHash('sha256');
                        hashSum.update(bufferFile);
                        const filename = hashSum.digest('hex');
                        const attachmentFile = new MessageAttachment(bufferFile, `${filename}.txt`);

                        client.channels.cache.get(logChannelId).send({
                            content: `**Ascension Lottery Participants**\nFilename: ${filename}.txt`,
                            files: [{
                                attachment: attachmentFile.attachment,
                                name: attachmentFile.name 
                            }]
                        });

                        await interaction.editReply('All ALTs were burnt');
                        await client.channels.cache.get(logChannelId).send(`<@${userId}> has burned all ascension Lottery tickets`);


                    // Catch any errors and rollback if issues occur
                    } catch (e) {
                        console.log(e);
                        console.log('An error has occured when burning ALT. Initiating rollback');

                        for (let participant in rollback) {
                            await guild.members.cache.get(participant).roles.add(rollback[participant]);
                        }
                        await interaction.editReply('An error was encountered when executing chewybot_burn_all_tickets, rolling back previous state');

                        return;
                    }

                } catch (e) {
                    console.log(e);
                    console.log('Unexpected error in chewybot_burn_all_tickets');
                    await interaction.editReply('An error was encountered when executing chewybot_burn_all_tickets, please try again');
                }

                return;
        }

    } catch (e) {
        console.log(e);
        console.log('Something went wrong');

    }
});

// Login to Discord with your client's token
client.login(token);
