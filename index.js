const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// إعداد المنفذ المخصص بناءً على متغيرات بيئة الاستضافة Bot-Hosting
const port = process.env.SERVER_PORT || process.env.PORT || 26303;

// تفعيل CORS للسماح بالاتصال من موقع GitHub Pages
app.use(cors({ origin: '*' }));
app.use(express.json());

// ملف تخزين التقديمات لمنع التكرار
const dbFilePath = path.join(__dirname, 'applications.json');

function getApplications() {
  if (!fs.existsSync(dbFilePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveApplications(data) {
  fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2));
}

// نقطة الفحص قبل فتح استمارة التقديم
app.get('/api/check-status/:discordId', (req, res) => {
  const discordId = req.params.discordId;
  const apps = getApplications();
  
  if (apps[discordId]) {
    return res.status(200).json({ status: apps[discordId].status });
  }
  res.status(200).json({ status: 'none' });
});

// استقبال التقديمات وإرسالها إلى الديسكورد
app.post('/api/apply-whitelist', async (req, res) => {
  const data = req.body;
  const discordId = data.discordId;

  const apps = getApplications();
  if (apps[discordId] && apps[discordId].status === 'pending') {
    return res.status(400).json({ error: 'لديك تقديم قيد المراجعة بالفعل، يرجى انتظار قرار الإدارة.' });
  }
  
  const channelId = '1562484970751270994'; // روم استقبال التقديمات
  const channel = client.channels.cache.get(channelId);

  if (!channel) return res.status(400).send({ error: 'Channel not found' });

  const embed = new EmbedBuilder()
    .setTitle('📋 (Whitelist Application) تقديم وايت لست جديد')
    .setColor(0xF1C40F)
    .addFields(
      { name: '👤 Discord Name', value: data.discordName || 'غير متوفر', inline: true },
      { name: '🆔 Discord ID', value: discordId || 'غير متوفر', inline: true },
      { name: '1️⃣ معنى RDM ومثال:', value: data.rdm || 'غير متوفر' },
      { name: '2️⃣ صدم بالسيارة عمداً (VDM):', value: data.vdm || 'غير متوفر' },
      { name: '3️⃣ عدم إظهار الخوف (Fear RP):', value: data.fearRp || 'غير متوفر' },
      { name: '4️⃣ الانتقام بعد الموت (NLR):', value: data.nlr || 'غير متوفر' },
      { name: '5️⃣ استخدام ديسكورد (Meta Gaming):', value: data.metaGaming || 'غير متوفر' },
      { name: '6️⃣ فرض الفعل (Power Gaming):', value: data.powerGaming || 'غير متوفر' },
      { name: '7️⃣ استفزاز الشرطة (Cop Baiting):', value: data.copBaiting || 'غير متوفر' },
      { name: '📌 الحالة الحالية:', value: '⏳ قيد المراجعة والانتظار' }
    )
    .setFooter({ text: `Discord ID: ${discordId}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`admin_decision_${discordId}`)
      .setPlaceholder('⚡ قرارات الإدارة (اختر الإجراء)...')
      .addOptions([
        { label: 'قبول الطلب', description: 'قبول العضو في الوايت لست', value: 'accept_action', emoji: '🟢' },
        { label: 'رفض الطلب كلياً', description: 'رفض الطلب مع ذكر السبب', value: 'reject_action', emoji: '🔴' },
        { label: 'طلب إعادة اختبار', description: 'مطالبة اللاعب بإعادة تقديم الاختبار', value: 'retest_action', emoji: '🟡' }
      ])
  );

  const sentMessage = await channel.send({ embeds: [embed], components: [row] });

  apps[discordId] = {
    status: 'pending',
    messageId: sentMessage.id,
    discordName: data.discordName
  };
  saveApplications(apps);

  res.status(200).send({ success: true });
});

app.get('/', (req, res) => {
  res.send('Bot is active and running!');
});

// ربط السيرفر بـ 0.0.0.0 والمنفذ المحدد
app.listen(port, '0.0.0.0', () => {
  console.log(`Web server running on port ${port}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag} successfully!`);
});

// التحكم في قرارات الإدارة بداخل الديسكورد
client.on('interactionCreate', async interaction => {
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('admin_decision_')) {
    const discordId = interaction.customId.split('_')[2];
    const selected = interaction.values[0];

    if (selected === 'retest_action') {
      const apps = getApplications();
      if (apps[discordId]) {
        apps[discordId].status = 'retest';
        saveApplications(apps);
      }
      await interaction.update({ content: `🔄 تم طلب إعادة اختبار لهذا الطلب بواسطة <@${interaction.user.id}>`, components: [] });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`reason_modal_${selected}_${discordId}`)
      .setTitle(selected === 'accept_action' ? 'سبب القبول' : 'سبب الرفض');

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason_text')
      .setLabel('اكتب السبب أو الملاحظة للإدارة/اللاعب:')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('reason_modal_')) {
    const parts = interaction.customId.split('_');
    const actionType = parts[2];
    const discordId = parts[3];
    const reason = interaction.fields.getTextInputValue('reason_text');

    const apps = getApplications();
    if (apps[discordId]) {
      apps[discordId].status = actionType === 'accept_action' ? 'accepted' : 'rejected';
      saveApplications(apps);
    }

    const statusText = actionType === 'accept_action' ? '🟢 **تم قبول الطلب بنجاح**' : '🔴 **تم رفض الطلب كلياً**';

    try {
      const message = interaction.message;
      if (message) {
        const oldEmbed = message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed).spliceFields(8, 1, { name: '📌 الحالة:', value: `${statusText}\n📝 **السبب:** ${reason}` });
        await message.edit({ embeds: [newEmbed], components: [] });
      }
    } catch (e) {}

    await interaction.reply({ content: `✅ تم تنفيذ القرار بنجاح وتسجيل السبب.`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
