const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 27540;

// ملف قاعدة البيانات المحلية
const DB_FILE = path.join(__dirname, 'db.json');

// الحالة الافتراضية للتقديمات (فتح / إغلاق)
const defaultDb = {
    settings: {
        police: true,      // تقديم الشرطة
        whitelist: true,   // تقديم الوايت ليست
        ems: true,         // تقديم المستشفى
        justice: true      // تقديم وزارة العدل
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

// 🎯 خريطة رومات القطاعات المختلفة
const CHANNELS = {
    'الشرطة': '1562786441816313896',
    'الوايت ليست': '1558946684954742915',
    'مستشفى فيسبوتشي': '1558946684954742915',
    'وزارة العدل': '1558946684954742915'
};

app.get('/', (req, res) => {
    res.send('Bot is active and running perfectly!');
});

// إرجاع حالة فتح وإغلاق التقديمات للموقع
app.get('/api/settings', (req, res) => {
    const db = loadDb();
    res.json(db.settings);
});

// فحص حالة المتقدم
app.get('/api/check-status/:discordId', (req, res) => {
    const { discordId } = req.params;
    const db = loadDb();
    const userApp = db.applications[discordId];
    if (userApp) {
        return res.json({ status: userApp.status });
    }
    res.json({ status: 'none' });
});

// استقبال استمارة التقديم من الموقع
app.post('/api/apply-whitelist', async (req, res) => {
    try {
        const { sector, discordName, discordId, name, rdm, vdm, fearRp, nlr, metaGaming, powerGaming, copBaiting, q1, q2, q3, q4 } = req.body;

        if (!discordId || !name) {
            return res.status(400).json({ error: 'الرجاء إدخال البيانات الأساسية بشكل صحيح.' });
        }

        const db = loadDb();

        // التحقق مما إذا كان التقديم مقفول لهذا القطاع
        const sectorKeyMap = {
            'الشرطة': 'police',
            'الوايت ليست': 'whitelist',
            'مستشفى فيسبوتشي': 'ems',
            'وزارة العدل': 'justice'
        };
        const key = sectorKeyMap[sector] || 'whitelist';
        if (db.settings[key] === false) {
            return res.status(400).json({ error: `عذراً، تقديم (${sector}) مغلق حالياً من قبل الإدارة.` });
        }

        if (db.applications[discordId] && db.applications[discordId].status === 'pending') {
            return res.status(400).json({ error: 'لديك طلب تقديم قيد المراجعة بالفعل.' });
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
                { name: '2. هل لديك شخصية في قطاع آخر؟:', value: q2 || 'غير مسجل' },
                { name: '3. الخبرات السابقة في الشرطة:', value: q3 || 'غير مسجل' },
                { name: '4. تصرفك في حال تعاملت مع شخص يخالف القوانين:', value: q4 || 'غير مسجل' }
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

        res.json({ success: true, message: 'تم إرسال تقديمك بنجاح للإدارة!' });

    } catch (error) {
        console.error("Error processing application:", error);
        res.status(500).json({ error: 'حدث خطأ داخلي في السيرفر.' });
    }
});

// التعامل مع أزرار الإدارة
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const [action, discordId] = interaction.customId.split('_');
    const db = loadDb();
    const userApp = db.applications[discordId];

    if (!userApp) {
        return interaction.reply({ content: '❌ لم يتم العثور على بيانات هذا الطلب.', ephemeral: true });
    }

    if (action === 'accept') {
        userApp.status = 'accepted';
        saveDb(db);
        await interaction.update({ content: `✅ **تم قبول الطلب بواسطة** ${interaction.user.tag}`, components: [] });
    } else if (action === 'reject') {
        userApp.status = 'rejected';
        saveDb(db);
        await interaction.update({ content: `❌ **تم رفض الطلب بواسطة** ${interaction.user.tag}`, components: [] });
    } else if (action === 'retest') {
        userApp.status = 'retest';
        saveDb(db);
        await interaction.update({ content: `🔄 **تم تحويل المتقدم لإعادة الاختبار بواسطة** ${interaction.user.tag}`, components: [] });
    }
});

// 🛠️ أوامر التحكم في فتح وإغلاق التقديمات عبر الشات في ديسكورد
client.on('messageCreate', async message => {
    if (message.author.bot || !message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

    const content = message.content.trim();
    const db = loadDb();

    if (content === '!apply status') {
        return message.reply(`📊 **حالة التقديمات الحالية:**
• الشرطة: ${db.settings.police ? '🟢 مفتوح' : '🔴 مغلق'}
• الوايت ليست: ${db.settings.whitelist ? '🟢 مفتوح' : '🔴 مغلق'}
• المستشفى: ${db.settings.ems ? '🟢 مفتوح' : '🔴 مغلق'}
• العدل: ${db.settings.justice ? '🟢 مفتوح' : '🔴 مغلق'}`);
    }

    if (content.startsWith('!apply toggle ')) {
        const target = content.replace('!apply toggle ', '').trim().toLowerCase();
        const valid = { 'police': 'الشرطة', 'whitelist': 'الوايت ليست', 'ems': 'المستشفى', 'justice': 'وزارة العدل' };

        if (valid[target]) {
            db.settings[target] = !db.settings[target];
            saveDb(db);
            const statusStr = db.settings[target] ? '🟢 فتح' : '🔴 إغلاق';
            return message.reply(`تم ${statusStr} تقديم (${valid[target]}) بنجاح!`);
        } else {
            return message.reply(`❌ قطاع غير معروف. الخيارات المتاحة: \`police\`, \`whitelist\`, \`ems\`, \`justice\``);
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
