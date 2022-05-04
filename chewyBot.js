// Chewy's Humble Emporium of Wishes to Yoink (C.H.E.W.Y)
// v2.0.0

// const { InteractionResponseType } = require('discord-api-types/v9');
const crypto = require('crypto');
const { Client, Intents, MessageAttachment } = require('discord.js');
const { MessageActionRow, MessageButton } = require('discord.js');
const { token, guildId, shopFrontendId, shopBackendId, logChannelId } = require('./config.json');
const { MessageEmbed } = require('discord.js');

let emporiumState = false;
let ticketPrice = 5; // Setting it to a default base price
let totalWishSupply = 0;
let noOfWinners = -1;
let topSpenders = '';
let shopFrontendMsg = '';
let minWishRequirement = 15;
let lotteryMessage = new MessageEmbed();

// Adding button as a global variable as it will me modified by multiple functions
let purchaseTicketButton = new MessageActionRow()
    .addComponents(
        new MessageButton()
            .setCustomId('primary')
            .setLabel('Purchase Ticket')
            .setStyle('PRIMARY'),
    );

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
});

try {
    client.on('interactionCreate', async interaction => {

        let userId = interaction.member.id;
        const guild = client.guilds.cache.get(guildId);

        // On button click - Purchase Ticket Button
        if (interaction.isButton()) {
            // Not sure if this will ever trigger but better safe than sorry
            // If emporium is not open, unable to purchase
            await interaction.deferReply({ ephemeral: true });

            if (!emporiumState) {
                interaction.editReply('Please wait for the emporium to be **OPEN** to use this command');
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
                    await interaction.editReply('You do not have sufficient wishes to purchase an Ascension Lottery Ticket');
                    return;
                }
                prevAWCount = parseInt(prevAWRole.name.substring(0, prevAWRole.name.indexOf('x')));

                if (prevAWCount < minWishRequirement) {
                    await interaction.editReply(`You need a minimum of ${minWishRequirement} Ascension Wishes to participate in this lottery`);
                    return;
                }

                if (prevAWCount < ticketPrice) {
                    await interaction.editReply('You do not have sufficient wishes to purchase an Ascension Lottery Ticket');
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
                    console.log('An error while deducting wishes, adding previous wishes back (if any)');
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

                    await interaction.editReply('You have successfully purchased 1 Ascension Lottery Ticket');
                    client.channels.cache.get(logChannelId).send(`<@${interaction.member.user.id}> has purchased 1 Ascension Lottery Ticket for **__${ticketPrice} wishes__**\n` +
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
                    await interaction.editReply('An error has occured before granting ALT. Adding previous ALT role back (if any)');
                    return;
                }

            } catch (e) {
                console.log(e);
                console.log('Unexpected error when clicking `Purchase Ticket`');
                await interaction.editReply('An error has occured when trying to purchase a ticket. Please try again in a few seconds');
            }

            return;

        } else if (!interaction.isCommand()) {
            return; // If it is anything other than a button interaction or command, exit gracefully
        }

        // Else it should be a command and we will decide what to do with each command
        const { commandName } = interaction;

        try {
            switch (commandName) {

                /*
                    Function: /chewybot_open_emporium

                    Main function for the bot. Opens the emporium and starts th elottery draw with the following parameters:
                        price: Price of 1 x Ascension Lottery Ticket (ALT)
                        duration: Sets the duration of the draw (in hours)
                        winners: Sets the number of winners for this draw

                    Note: Pausing a sale is different from closing the emporium - pausing simply disable the clicking of the button
                */
                case 'chewybot_open_emporium':
                    await interaction.deferReply({ ephemeral: true });

                    // If emporium is already open (set to true)
                    if (emporiumState) {
                        await interaction.editReply('Please wait for the emporium to be **CLOSED** to use this command');
                        return;
                    }
                    try {
                        // Check if user provided the price option (null if options is not given)
                        let setPrice = interaction.options.getInteger('price');
                        let duration = interaction.options.getInteger('duration') * 60 * 60; // Convert to seconds
                        minWishRequirement = interaction.options.getInteger('minimum');
                        noOfWinners = interaction.options.getInteger('winners');

                        // Input validation
                        if (noOfWinners <= 0) {
                            await interaction.editReply('Please set the number of winners to be greater than 0');
                            return;
                        }

                        if (duration <= 0) {
                            await interaction.editReply('Please set the duration to be greater than 0');
                            return;
                        }

                        if (setPrice <= 0) {
                            await interaction.editReply('Please set the ticket price to be greater than 0');
                            return;
                        }

                        ticketPrice = setPrice;


                        // FETCH LATEST DATA FROM GUILD
                        let members = await guild.members.fetch();
                        let roles = await guild.roles.fetch();
                        // FETCH LATEST DATA FROM GUILD

                        emporiumState = true;

                        const now = parseInt(Date.now() / 1000);
                        const user = interaction.member.user;
                        const hostedBy = user.username + '#' + user.discriminator;
                        const hostPic = user.displayAvatarURL();

                        let timeToPrint = secondsToDhms(duration);
                        const deadline = now + (duration);

                        // Reset the message if re-opening emporium
                        lotteryMessage = new MessageEmbed();
                        lotteryMessage.setColor('0x0099ff')
                            .setTitle('C.H.E.W.Y. PARADIGM LOTTERY')
                            .setDescription(`Purchase a non-refundable Paradigm Lottery Ticket by clicking on \`Purchase Ticket\` below to join this lottery. You need a minimum of ${minWishRequirement} Ascension Wishes to participate. The draw ends on  <t:${deadline}:F>\n `)
                            .setThumbnail('https://cdn.discordapp.com/attachments/938343677309370398/965843012729057300/Ticket.png')
                            .addFields(
                                {
                                    name: 'Lottery Details',
                                    value: `\n\`\`\`Draw Winners: ${noOfWinners}\nTicket Price: ${ticketPrice} wishes\nTime Left: ${timeToPrint[0]}d ${timeToPrint[1]}h ${timeToPrint[2]}m ${timeToPrint[3]}s\nTotal Wishes Burned: 0\`\`\`\n`,
                                },
                                {
                                    name: 'Top Spenders',
                                    value: '``` ```',
                                },
                                {
                                    name: 'Note',
                                    value: 'Do not click on `Purchase Ticket` again while the bot is processing the sale or you WILL LOSE your wishes. __**NO REFUNDS**__ will be made for such errors.',
                                })
                            .setTimestamp(new Date())
                            .setFooter({
                                text: `This message automatically updates every 10 seconds\nHosted by: ${hostedBy}`,
                                iconURL: `${hostPic}`,
                            });

                        purchaseTicketButton.components[0].setDisabled(false);
                        shopFrontendMsg = await client.channels.cache.get(shopFrontendId).send({ embeds: [lotteryMessage], components: [purchaseTicketButton] });

                        let lotteryActive = setInterval(async function updateLotteryBoard() {

                            roles = await guild.roles.fetch();

                            let timeRemaining = Math.max(0, deadline - parseInt(Date.now() / 1000));

                            timeToPrint = secondsToDhms(timeRemaining);
                            let participantArray = {};

                            let allALTRoles = roles.filter(role => role.name.endsWith('x Ascension Lottery Ticket'));

                            for (const role of allALTRoles) {
                                let count = parseInt(role[1].name.split('x')[0]);

                                guild.roles.cache.get(role[0]).members.map((m) => {
                                    let nickname = m.user.username + '#' + m.user.discriminator;
                                    participantArray[nickname] = count;
                                });
                            }
                            const wishesBurned = Object.keys(participantArray).length == 0 ? 0 : Object.values(participantArray).reduce((a, b) => a + b) * ticketPrice;

                            const sortedValues = Object.entries(participantArray).sort(([, a], [, b]) => b - a);

                            let topSpendersTemp = '';
                            for (let i = 0; i < sortedValues.length; i++) {
                                if (i < 5) {
                                    topSpendersTemp += `${i + 1}. ${sortedValues[i][0]}: ${sortedValues[i][1]} tickets\n`;
                                }
                            }

                            topSpenders = topSpendersTemp != '' ? topSpendersTemp : ' ';

                            // Once time is up, have one final edit to the Lottery Announcement and close the Emporium
                            if (timeRemaining <= 0) {

                                lotteryMessage.setDescription('The Lottery has ended. Please wait for winners to be drawn\n ');
                                lotteryMessage.setFields(
                                    {
                                        name: '-- THE DRAW HAS ENDED --',
                                        value: `\n\`\`\`Drawing ${noOfWinners} winners, standby...\nTotal Wishes Burned: ${wishesBurned}\`\`\`\n`,
                                    },
                                    {
                                        name: 'Top Spenders',
                                        value: `\`\`\`${topSpenders}\`\`\``,
                                    });
                                lotteryMessage.setTimestamp(new Date());
                                lotteryMessage.setFooter({ text: 'The draw has ended. Please wait for the winners to be drawn' });

                                clearInterval(lotteryActive);
                                purchaseTicketButton.components[0].setDisabled(true);
                                shopFrontendMsg.edit({ embeds: [lotteryMessage], components: [purchaseTicketButton] });

                                emporiumState = false;

                                client.channels.cache.get(shopFrontendId).send('----------- Emporium is now officially **CLOSED** -----------');
                                client.channels.cache.get(logChannelId).send('The draw has ended. Please run `/chewybot_burn_all_tickets` to select the winners');

                                return;
                            }

                            lotteryMessage.setFields(
                                {
                                    name: 'Lottery Details',
                                    value: `\n\`\`\`Draw Winners: ${noOfWinners}\nTicket Price: ${ticketPrice} wishes\nTime Left: ${timeToPrint[0]}d ${timeToPrint[1]}h ${timeToPrint[2]}m ${timeToPrint[3]}s\nTotal Wishes Burned: ${wishesBurned}\`\`\`\n`,
                                },
                                {
                                    name: 'Top Spenders',
                                    value: `\`\`\`${topSpenders}\`\`\``,
                                },
                                {
                                    name: 'Note',
                                    value: 'Do not click on `Purchase Ticket` again while the bot is processing the sale or you WILL LOSE your wishes. __**NO REFUNDS**__ will be made for such errors.',
                                });

                            shopFrontendMsg.edit({ embeds: [lotteryMessage] });

                        }, 10000);

                        await interaction.editReply('Lottery started');
                        await client.channels.cache.get(shopBackendId).send(`Lottery has started with **${noOfWinners} winners** and **${ticketPrice} wishes** per lottery ticket in <#${shopFrontendId}>`);
                        await client.channels.cache.get(logChannelId).send(`<@${userId}> has **OPENED** the emporium with Ascension Lottery Tickets on sale for **__${ticketPrice} Ascension Wishes__** per ticket`);

                    } catch (e) {
                        console.log(e);
                        console.log('An error has occured when opening the emporium. Rolling back');

                        // Close emporium
                        emporiumState = false;

                    }

                    return;

                /*
                    Function: /chewybot_pause_sale

                    Pauses the sale of Ascension Lottery Tickets (disables Purchase Ticket button)

                    Note: Pausing a sale is different from closing the emporium - pausing simply disable the clicking of the button
                */
                case 'chewybot_pause_sale':
                    await interaction.deferReply({ ephemeral: true });

                    if (shopFrontendMsg === '') {
                        await interaction.editReply('There is no sale to be paused! Please run `/chewybot_open_emporium` first!');
                        return;
                    }

                    purchaseTicketButton.components[0].setDisabled(true);
                    shopFrontendMsg.edit({ components: [purchaseTicketButton] });

                    await interaction.editReply('**The sale of Ascension Lottery Tickets has been paused!**');
                    await client.channels.cache.get(shopFrontendId).send('**Ascension Lottery Ticket sale paused. Please wait for the sale to be resumed!**');
                    await client.channels.cache.get(logChannelId).send(`<@${userId}> has paused the sale at <t:${parseInt(Date.now() / 1000)}:F>`);

                    return;

                /*
                    Function: /chewybot_resume_sale

                    Resumes the sale of Ascension Lottery Tickets (enables Purchase Ticket button)
                */
                case 'chewybot_resume_sale':
                    await interaction.deferReply({ ephemeral: true });

                    if (shopFrontendMsg === '') {
                        await interaction.editReply('There is no sale to be resumed! Please run `/chewybot_open_emporium` first!');
                        return;
                    }

                    purchaseTicketButton.components[0].setDisabled(false);
                    shopFrontendMsg.edit({ components: [purchaseTicketButton] });

                    await interaction.editReply('**The sale of Ascension Lottery Tickets has resumed!**');
                    await client.channels.cache.get(shopFrontendId).send('**Ascension Lottery Ticket sale resumed!**');
                    await client.channels.cache.get(logChannelId).send(`<@${userId}> has resumed the sale at <t:${parseInt(Date.now() / 1000)}:F>`);

                    return;

                /*
                    Function: /chewybot_check_wish_supply

                    Pulls the latest data from Discord and produces a histogram of the amount of ascension wishes in a specified bin
                */
                case 'chewybot_check_supply_and_rrp':
                    await interaction.deferReply({ ephemeral: true });

                    try {
                        // FETCH LATEST DATA FROM GUILD
                        const members = await guild.members.fetch();
                        const roles = await guild.roles.fetch();
                        // FETCH LATEST DATA FROM GUILD

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

                /*
                    Function: /chewybot_burn_all_tickets

                    1. Adds all Ascension Lottery Tickets (ALT) holders to a list (name appears once for each ticket held - 2x ALT = 2 times).
                    2. Shuffes this list with Fisher-Yates ALgorithm (https://www.youtube.com/watch?v=tLxBwSL3lPQ)
                    3. Picks the first X number of unique names, where X is the number of winners speficied by Admin
                    4. Outputs lottery partitcipants + winners into a file with it's hash as the filename (for verification)
                    4. Removes ALL ALT roles from everyone in the server
                */
                case 'chewybot_burn_all_tickets':
                    await interaction.deferReply({ ephemeral: true });

                    // Check if emporium is closed first
                    if (emporiumState) {
                        await interaction.editReply('Please wait for the emporium to be **CLOSED** to use this command');
                        return;
                    }

                    if (noOfWinners <= 0) {
                        await interaction.editReply('Current number of winners has **not** been set. Please use `/chewybot_open_emporium` to start a lottery, or use `/chewybot_set_no_of_winners` if the lottery has ended and the bot has crashed');
                        return;
                    }

                    try {
                        await interaction.editReply('------- Burning all tickets, standby -------');

                        // FETCH LATEST DATA FROM GUILD
                        const members = await guild.members.fetch();
                        const roles = await guild.roles.fetch();
                        // FETCH LATEST DATA FROM GUILD

                        let allALTRoles = roles.filter(role => role.name.endsWith('x Ascension Lottery Ticket'));
                        let rollback = {};
                        let ticketArray = new Array();
                        let participantMap = {};
                        let output = '';

                        try {
                            // Retrieve all members with the ALT role and remove them from everyone (included roleback if it fails)
                            for (const role of allALTRoles) {
                                let count = parseInt(role[1].name.split('x')[0]);
                                let participantArray = roles.get(role[0]).members.map(m => m.user);

                                for (let participant of participantArray) {
                                    participantMap[`${participant.username}#${participant.discriminator}`] = count;

                                    for (let i = 0; i < count; i++) {
                                        ticketArray.push(`${participant.username}#${participant.discriminator}`);
                                    }

                                    await guild.members.cache.get(participant.id).roles.remove(role[0]);
                                    rollback[participant.id] = role[0];
                                }

                            }

                            if (ticketArray.length == 0) {
                                await interaction.editReply('------- No ALTs were burnt -------');
                                return;
                            }

                            // Shuffle with Fisher-Yates ALgorithm
                            // https://medium.com/@nitinpatel_20236/how-to-shuffle-correctly-shuffle-an-array-in-javascript-15ea3f84bfb
                            for (let i = ticketArray.length - 1; i > 0; i--) {
                                const j = Math.floor(Math.random() * i);
                                const temp = ticketArray[i];
                                ticketArray[i] = ticketArray[j];
                                ticketArray[j] = temp;
                            }

                            let lotteryResults = new Array();
                            let winnersTotal = 0;
                            let i = 0;

                            // Keep going down the list until we have a sufficient number of unique winners
                            while (lotteryResults.length < noOfWinners) {

                                if (i > ticketArray.length) {
                                    break;
                                }

                                if (lotteryResults.indexOf(ticketArray[i]) == -1) {
                                    lotteryResults.push(ticketArray[i]);
                                    winnersTotal += participantMap[ticketArray[i]];
                                }

                                i++;
                            }

                            let lotteryWinners = lotteryResults.join(', ');
                            let averagePaid = parseInt(winnersTotal / noOfWinners);
                            let percentageChance = parseInt(averagePaid / ticketArray.length * 100);


                            lotteryMessage = new MessageEmbed();
                            lotteryMessage.setColor('0x0099ff')
                                .setTitle('C.H.E.W.Y. PARADIGM LOTTERY WINNERS')
                                .setDescription(` \`${lotteryWinners}\` ran away with the Paradigm Whitelist!\n\nThey paid an average of **${averagePaid}x Ascension Wishes** with a **${percentageChance}% chance** of winning!\n `)
                                .setThumbnail('https://cdn.discordapp.com/attachments/938343677309370398/965843012729057300/Ticket.png')
                                .addFields(
                                    {
                                        name: 'Lottery Pool Details',
                                        value: `\n\`\`\`Total Participants: ${Object.keys(participantMap).length}\nTotal Tickets: ${ticketArray.length} tickets\`\`\``,
                                    },
                                    {
                                        name: 'Top Spenders',
                                        value: `\`\`\`${topSpenders}\`\`\``,
                                    })
                                .setTimestamp(new Date())
                                .setFooter({
                                    text: 'Congratulations to the winners of the paradigm lottery!',
                                });

                            await client.channels.cache.get(shopFrontendId).send({ embeds: [lotteryMessage] });

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

                case 'chewybot_set_no_of_winners':
                    await interaction.deferReply();

                    noOfWinners = interaction.options.getInteger('winners');
                    await interaction.editReply(`No of Winners has been set to ${noOfWinners}`);
                    return;

            }

        } catch (e) {
            console.log(e);
            console.log('Something went wrong');

        }
    });

    client.login(token);

} catch (e) {
    console.log(e);
} finally {
    purchaseTicketButton.components[0].setDisabled(true);
}

