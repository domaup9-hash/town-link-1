const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 27540;

// أيدي الحساب المالك الوحيد المصرح له بالتحكم
const OWNER_DISCORD_ID = '827346713013387314';

const DB_FILE = path.join(__dirname, 'db.json');

const defaultDb = {
    settings: {
        police: true,
        whitelist: true,
        ems: true,
        justice: true
    },
    applications: {}
};

function loadDb() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (!parsed.settings) parsed.settings = defaultDb.settings;
        return parsed;
    } catch (e) {
        return defaultDb;
    }
}

function saveDb(dbData) {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 🎯 خريطة رومات القطاعات (تم تحديث أيدي روم الشرطة)
const CHANNELS = {
    'الشرطة': '1563198130256879698',
    'الوايت ليست': '1558946684954742915',
    'مستشفى فيسبوتشي': '1558946684954742915',
    'وزارة العدل': '1558946684954742915'
};

app.get('/', (req, res) => {
    res.send('Bot is active and running perfectly!');
});

app.get('/api/settings', (req, res) => {
    const db = loadDb();
    res.json({ settings: db.settings, ownerId: OWNER_DISCORD_ID });
});

app.get('/api/check-status/:discordId', (req, res) => {
    const { discordId } = req.params;
    const db = loadDb();
    const userApp = db.applications[discordId];
    if (userApp) {
        return res.json({ status: userApp.status });
    }
    res.json({ status: 'none' });
});

app.post('/api/apply-whitelist', async (req, res) => {
    try {
        const { sector, discordName, discordId, name, rdm, vdm, fearRp, nlr, metaGaming, powerGaming, copBaiting, q1, q2, q3, q4 } = req.body;

        if (!discordId || !name) {
            return res.status(400).json({ error: 'الرجاء إكمال جميع البيانات الأساسية بالاستمارة.' });
        }

        const db = loadDb();

        const sectorKeyMap = {
            'الشرطة': 'police',
            'الوايت ليست': 'whitelist',
            'مستشفى فيسبوتشي': 'ems',
            'وزارة العدل': 'justice'
        };
        const key = sectorKeyMap[sector] || 'whitelist';
        
        if (db.settings[key] === false) {
            return res.status(400).json({ error: `عذراً يا غالي، تقديم (${sector}) مقفول حالياً من الإدارة.` });
        }

        // 🛑 منع التقديم المكرر إذا كان مقبولاً أو لديه طلب قيد المراجعة
        if (db.applications[discordId]) {
            const currentStatus = db.applications[discordId].status;
            if (currentStatus === 'pending') {
                return res.status(400).json({ error: 'يا بطل، أنت عندك طلب تقديم قيد المراجعة بالفعل عند الإدارة! استنى القرار.' });
            }
            if (currentStatus === 'accepted') {
                return res.status(400).json({ error: 'ألف مبروك! أنت مقبول بالفعل في السيرفر ومش محتاج تقدم تاني.' });
            }
        }

        const targetChannelId = CHANNELS[sector] || CHANNELS['الوايت ليست'];
        const channel = await client.channels.fetch(targetChannelId).catch(() => null);

        if (!channel) {
            return res.status(500).json({ error: 'تعذر الوصول إلى روم التقديمات المحددة في ديسكورد.' });
        }

        let embed = new EmbedBuilder()
            .setTitle(`📋 طلب تقديم جديد: ${sector}`)
            .setColor(sector === 'الشرطة' ? 0x0284c7 : 0xf59e0b)
            .addFields(
                { name: '👤 الاسم الكامل:', value: `\`${name}\``, inline: true },
                { name: '💬 ديسكورد:', value: `\`${discordName}\` (<@${discordId}>)`, inline: true },
                { name: '🆔 أيدي ديسكورد:', value: `\`${discordId}\``, inline: false }
            )
            .setTimestamp();

        if (sector === 'الوايت ليست') {
            embed.addFields(
                { name: '1. RDM:', value: rdm || 'غير مسجل' },
                { name: '2. VDM:', value: vdm || 'غير مسجل' },
                { name: '3. Fear RP:', value: fearRp || 'غير مسجل' },
                { name: '4. NLR:', value: nlr || 'غير مسجل' },
                { name: '5. Meta Gaming:', value: metaGaming || 'غير مسجل' },
                { name: '6. Power Gaming:', value: powerGaming || 'غير مسجل' },
                { name: '7. Cop Baiting:', value: copBaiting || 'غير مسجل' }
            );
        } else if (sector === 'الشرطة') {
            embed.addFields(
                { name: '1. ساعات التواجد اليومية:', value: q1 || 'غير مسجل' },
                { name: '2. شخصيات في قطاعات أخرى:', value: q2 || 'غير مسجل' },
                { name: '3. الخبرات السابقة:', value: q3 || 'غير مسجل' },
                { name: '4. التصرف القانوني مع المخالفين:', value: q4 || 'غير مسجل' }
            );
        } else {
            embed.addFields(
                { name: 'السؤال الأول / التواجد:', value: q1 || 'غير مسجل' },
                { name: 'السؤال الثاني / الشخصيات:', value: q2 || 'غير مسجل' },
                { name: 'السؤال الثالث / الخبرات:', value: q3 || 'غير مسجل' }
            );
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_${discordId}`).setLabel('قبول الطلب ✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`reject_${discordId}`).setLabel('رفض ❌').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`retest_${discordId}`).setLabel('إعادة اختبار 🔄').setStyle(ButtonStyle.Secondary)
        );

        const sentMessage = await channel.send({ embeds: [embed], components: [row] });

        db.applications[discordId] = {
            discordName,
            name,
            sector,
            status: 'pending',
            messageId: sentMessage.id
        };
        saveDb(db);

        res.json({ success: true, message: 'تم إرسال استمارتك بنجاح وسيتواصل معك فريق الإدارة قريباً!' });

    } catch (error) {
        console.error("Error processing application:", error);
        res.status(500).json({ error: 'حدث خطأ داخلي في السيرفر أثناء المعالجة.' });
    }
});

// 📩 التعامل مع الأزرار وإرسال الرسائل على الخاص (DM) بالطريقة المصرية
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const [action, discordId] = interaction.customId.split('_');
    const db = loadDb();
    const userApp = db.applications[discordId];

    if (!userApp) {
        return interaction.reply({ content: '❌ لم يتم العثور على بيانات هذا الطلب.', ephemeral: true });
    }

    const targetUser = await client.users.fetch(discordId).catch(() => null);
    let dmSentStatus = "";

    if (action === 'accept') {
        userApp.status = 'accepted';
        saveDb(db);

        if (targetUser) {
            const acceptEmbed = new EmbedBuilder()
                .setTitle(`🎉 تم قبولك في TOWN 77 CFW!`)
                .setDescription(`ألف مبروك يا بطل! ❤️\nتم قبول تقديمك رسمياً بقطاع **(${userApp.sector})**.\n\nجهز نفسك ونورنا في السيرفر، ومستنيين منك أحلى رول بلاي يا وحش! 🚀`)
                .setColor(0x22c55e)
                .setFooter({ text: 'TOWN 77 Official Management' })
                .setTimestamp();

            await targetUser.send({ embeds: [acceptEmbed] }).then(() => {
                dmSentStatus = "\n📩 *(تم إرسال رسالة القبول للخاص بنجاح)*";
            }).catch(() => {
                dmSentStatus = "\n⚠️ *(تعذر إرسال الخاص لأن المتقدم قافل الـ DMs)*";
            });
        }

        await interaction.update({ content: `✅ **تم قبول الطلب بواسطة** ${interaction.user.tag} ${dmSentStatus}`, components: [] });

    } else if (action === 'reject') {
        userApp.status = 'rejected';
        saveDb(db);

        if (targetUser) {
            const rejectEmbed = new EmbedBuilder()
                .setTitle(`ملاحظة بشأن تقديمك في TOWN 77`)
                .setDescription(`للأسف يا غالي، تم رفض تقديمك بقطاع **(${userApp.sector})** في الوقت الحالي.\n\nمتزعلش نفسك، راجع القوانين كويس وتقدر تحاول تقدم تاني لما يفتح التقديم! بالتوفيق يا بطل ❤️`)
                .setColor(0xef4444)
                .setFooter({ text: 'TOWN 77 Official Management' })
                .setTimestamp();

            await targetUser.send({ embeds: [rejectEmbed] }).then(() => {
                dmSentStatus = "\n📩 *(تم إرسال رسالة الرفض للخاص بنجاح)*";
            }).catch(() => {
                dmSentStatus = "\n⚠️ *(تعذر إرسال الخاص لأن المتقدم قافل الـ DMs)*";
            });
        }

        await interaction.update({ content: `❌ **تم رفض الطلب بواسطة** ${interaction.user.tag} ${dmSentStatus}`, components: [] });

    } else if (action === 'retest') {
        userApp.status = 'retest';
        saveDb(db);

        if (targetUser) {
            const retestEmbed = new EmbedBuilder()
                .setTitle(`🔄 إعادة اختبار - TOWN 77`)
                .setDescription(`يا مرحب بيك! 👋\nالإدارة حولت تقديمك لقطاع **(${userApp.sector})** لـ **(إعادة اختبار)**.\n\nيرجى التوجه لغرفة الانتظار في ديسكورد السيرفر والتواصل مع فريق الدعم الفني لإعادة الاختبار. بالتوفيق! 🤝`)
                .setColor(0x3b82f6)
                .setFooter({ text: 'TOWN 77 Official Management' })
                .setTimestamp();

            await targetUser.send({ embeds: [retestEmbed] }).then(() => {
                dmSentStatus = "\n📩 *(تم إرسال طلب إعادة الاختبار للخاص بنجاح)*";
            }).catch(() => {
                dmSentStatus = "\n⚠️ *(تعذر إرسال الخاص لأن المتقدم قافل الـ DMs)*";
            });
        }

        await interaction.update({ content: `🔄 **تم تحويل المتقدم لإعادة الاختبار بواسطة** ${interaction.user.tag} ${dmSentStatus}`, components: [] });
    }
});

// أوامر التحكم محصورة برقم الأيدي الخاص بك فقط
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.author.id !== OWNER_DISCORD_ID) return;

    const content = message.content.trim();
    const db = loadDb();

    if (content === '!apply status') {
        return message.reply(`👑 **لوحة تحكم المالك | حالة التقديمات:**
• 🚓 الشرطة: ${db.settings.police ? '🟢 مفتوح' : '🔴 مغلق'}
• 📜 الوايت ليست: ${db.settings.whitelist ? '🟢 مفتوح' : '🔴 مغلق'}
• 🚑 المستشفى: ${db.settings.ems ? '🟢 مفتوح' : '🔴 مغلق'}
• ⚖️ العدل: ${db.settings.justice ? '🟢 مفتوح' : '🔴 مغلق'}`);
    }

    if (content.startsWith('!apply toggle ')) {
        const target = content.replace('!apply toggle ', '').trim().toLowerCase();
        const valid = { 'police': 'الشرطة', 'whitelist': 'الوايت ليست', 'ems': 'المستشفى', 'justice': 'وزارة العدل' };

        if (valid[target]) {
            db.settings[target] = !db.settings[target];
            saveDb(db);
            const statusStr = db.settings[target] ? '🟢 تم فتح' : '🔴 تم إغلاق';
            return message.reply(`👑 **تحديث الإدارة:** ${statusStr} تقديم (${valid[target]}) بنجاح!`);
        } else {
            return message.reply(`❌ قطاع غير معروف. استخدم: \`police\`, \`whitelist\`, \`ems\`, \`justice\``);
        }
    }
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag} successfully!`);
});

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
