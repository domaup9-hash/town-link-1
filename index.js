const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
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

// تحميل قاعدة البيانات أو إنشائها لو مش موجودة
function loadDb() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ applications: {} }, null, 2));
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { applications: {} };
    }
}

function saveDb(dbData) {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}

// إعدادات البوت
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 🎯 أيدي روم التقديمات الجديد والمحدث
const TARGET_CHANNEL_ID = '1558946684954742915';

// نقطة اختبار عمل السيرفر
app.get('/', (req, res) => {
    res.send('Bot is active and running perfectly!');
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

// استلام طلب التقديم من الموقع
app.post('/api/apply-whitelist', async (req, res) => {
    try {
        const { sector, discordName, discordId, name, rdm, vdm, fearRp, nlr, metaGaming, powerGaming, copBaiting, q1, q2, q3 } = req.body;

        if (!discordId || !name) {
            return res.status(400).json({ error: 'الرجاء إدخال البيانات الأساسية بشكل صحيح.' });
        }

        const db = loadDb();
        if (db.applications[discordId] && db.applications[discordId].status === 'pending') {
            return res.status(400).json({ error: 'لديك طلب تقديم قيد المراجعة بالفعل.' });
        }

        const channel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
        if (!channel) {
            return res.status(500).json({ error: 'تعذر الوصول إلى روم التقديمات في ديسكورد.' });
        }

        let embed = new EmbedBuilder()
            .setTitle(`📋 طلب تقديم جديد: ${sector}`)
            .setColor(0xf59e0b)
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

        // حفظ الطلب في قاعدة البيانات المحلية
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

// التعامل مع أزرار الإدارة في ديسكورد
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const [action, discordId] = interaction.customId.split('_');
    const db = loadDb();
    const userApp = db.applications[discordId];

    if (!userApp) {
        return interaction.reply({ content: '❌ لم يتم العثور على بيانات هذا الطلب في قاعدة البيانات.', ephemeral: true });
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

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag} successfully!`);
});

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT} with file database.`);
});

client.login(process.env.DISCORD_TOKEN);
