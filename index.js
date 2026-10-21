const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

const app = express();
const port = 3000;

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

// استقبال طلبات التقديم من الموقع وإرسالها للديسكورد مع أزرار التحكم
app.use(express.json());

app.post('/api/apply-whitelist', async (req, res) => {
  const data = req.body;
  
  // آدي آي دي رالروم أو الويب هوك اللي هيوصل عليه التقديم (غيره للروم بتاعتك)
  const channelId = '1562484970751270994'; 
  const channel = client.channels.cache.get(channelId);

  if (!channel) return res.status(400).send({ error: 'Channel not found' });

  const embed = new EmbedBuilder()
    .setTitle('📋 طلب تقديم وايت لست جديد')
    .setColor(0x00AE86)
    .addFields(
      { name: 'الاسم الحقيقي', value: data.name || 'غير متوفر', inline: true },
      { name: 'العمر', value: data.age || 'غير متوفر', inline: true },
      { name: 'الاستايل/القصة', value: data.story || 'غير متوفر' }
    )
    .setTimestamp();

  // أزرار التحكم (قبول، رفض، إعادة اختبار)
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('accept_btn').setLabel('قبول').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('reject_btn').setLabel('رفض').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('retest_btn').setLabel('إعادة اختبار').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });
  res.status(200).send({ success: true });
});

// التعامل مع الضغط على الأزرار من قبل الأدمن
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'accept_btn') {
    await interaction.reply({ content: '✅ تم قبول هذا الطلب بنجاح!', ephemeral: true });
  } else if (interaction.customId === 'reject_btn') {
    await interaction.reply({ content: '❌ تم رفض هذا الطلب.', ephemeral: true });
  } else if (interaction.customId === 'retest_btn') {
    await interaction.reply({ content: '🔄 تم طلب إعادة الاختبار لصاحب الطلب.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN || 'MTU2MTkxMjk3NTMxOTg5MjA0MA.GRFE4a.2q37I2b7nLkRhGcoGwSZN6S04dPVLXOFLgZ8F0');
