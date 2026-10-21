const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const express = require('express');

const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Bot is active and running!');
});

app.listen(port, () => {
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

// استقبال بيانات الوايت لست الكاملة من الموقع
app.post('/api/apply-whitelist', async (req, res) => {
  const data = req.body;
  
  const channelId = '1562484970751270994'; // روم استقبال الطلبات
  const channel = client.channels.cache.get(channelId);

  if (!channel) return res.status(400).send({ error: 'Channel not found' });

  const embed = new EmbedBuilder()
    .setTitle('📋 (Whitelist Application) تقديم وايت لست جديد')
    .setColor(0xF1C40F)
    .addFields(
      { name: '👤 Discord Name', value: data.discordName || 'غير متوفر', inline: true },
      { name: '🆔 Discord ID', value: data.discordId || 'غير متوفر', inline: true },
      { name: '1️⃣ معنى RDM ومثال:', value: data.rdm || 'غير متوفر' },
      { name: '2️⃣ صدم بالسيارة عمداً (VDM):', value: data.vdm || 'غير متوفر' },
      { name: '3️⃣ عدم إظهار الخوف (Fear RP):', value: data.fearRp || 'غير متوفر' },
      { name: '4️⃣ الانتقام بعد الموت (NLR):', value: data.nlr || 'غير متوفر' },
      { name: '5️⃣ استخدام ديسكورد (Meta Gaming):', value: data.metaGaming || 'غير متوفر' },
      { name: '6️⃣ فرض الفعل (Power Gaming):', value: data.powerGaming || 'غير متوفر' },
      { name: '7️⃣ استفزاز الشرطة (Cop Baiting):', value: data.copBaiting || 'غير متوفر' }
    )
    .setFooter({ text: 'قم بالرد مباشرة بالسبب في الروم المخصصة بذكر الحساب' })
    .setTimestamp();

  // لو عايز تخليها قائمة منسدلة (Select Menu) بدل الأزرار العادية
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('admin_decision_menu')
      .setPlaceholder('⚡ قرارات الإدارة (اختر الإجراء)...')
      .addOptions([
        {
          label: 'قبول الطلب',
          description: 'قبول العضو في الوايت لست',
          value: 'accept_action',
          emoji: '🟢'
        },
        {
          label: 'رفض الطلب كلياً',
          description: 'رفض الطلب مع ذكر السبب',
          value: 'reject_action',
          emoji: '🔴'
        },
        {
          label: 'طلب إعادة اختبار',
          description: 'مطالبة اللاعب بإعادة تقديم الاختبار',
          value: 'retest_action',
          emoji: '🟡'
        }
      ])
  );

  await channel.send({ embeds: [embed], components: [row] });
  res.status(200).send({ success: true });
});

// التعامل مع اختيارات القائمة المنسدلة
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'admin_decision_menu') {
    const selected = interaction.values[0];
    if (selected === 'accept_action') {
      await interaction.reply({ content: '✅ تم اختيار: [ قبول الطلب ]', ephemeral: true });
    } else if (selected === 'reject_action') {
      await interaction.reply({ content: '❌ تم اختيار: [ رفض الطلب كلياً ]', ephemeral: true });
    } else if (selected === 'retest_action') {
      await interaction.reply({ content: '🔄 تم اختيار: [ طلب إعادة اختبار ]', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
