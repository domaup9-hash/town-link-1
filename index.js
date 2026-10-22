const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const express = require('express');

const app = express();
const port = 3000;

app.use(express.json());

// قاعدة بيانات مؤقتة لتخزين حالة التقديم لكل لاعب باستخدام Discord ID
const applicationsDB = new Map();

// ⚙️ الأيديهات الرسمية الخاصة بسيرفرك وروم التقديم
const GUILD_ID = '1342331946847436853'; // أيدي السيرفر
const CHANNEL_ID = '1562484970751270994'; // روم التقديمات

// أيديهات الرتب الرسمية
const ROLE_ACCEPTED = '1558946270721216593'; // مقبولين مبدئياً
const ROLE_REJECTED = '1558946241516150834'; // مرفوض
const ROLE_RETEST = '1558946276861550632';   // إعادة اختبار

app.get('/', (req, res) => {
  res.send('Bot is active and running perfectly!');
});

// 1. مسار التحقق من حالة اللاعب قبل فتح شاشة الاختبار في الموقع
app.get('/api/check-status/:discordId', (req, res) => {
  const discordId = req.params.discordId;
  const userApp = applicationsDB.get(discordId);

  if (!userApp) {
    return res.status(200).json({ status: 'none' });
  }

  if (userApp.status === 'pending') {
    return res.status(200).json({ status: 'pending' });
  }

  if (userApp.status === 'accepted') {
    return res.status(200).json({ status: 'accepted' });
  }

  if (userApp.status === 'rejected') {
    return res.status(200).json({ status: 'rejected' });
  }

  if (userApp.status === 'retest') {
    return res.status(200).json({ status: 'retest' });
  }

  res.status(200).json({ status: 'none' });
});

// 2. مسار استقبال جميع استمارات التقديم من الموقع
app.post('/api/apply-whitelist', async (req, res) => {
  const data = req.body;
  const discordId = data.discordId;

  if (!discordId) {
    return res.status(400).json({ error: 'Discord ID is required.' });
  }

  // التحقق من عدم التكرار
  const existingApp = applicationsDB.get(discordId);
  if (existingApp && existingApp.status === 'pending') {
    return res.status(400).json({ error: 'عذراً، لديك تقديم قيد المراجعة بالفعل!' });
  }
  if (existingApp && existingApp.status === 'accepted') {
    return res.status(400).json({ error: 'أنت مقبول بالفعل في الوايت ليست ولا تحتاج للتقديم مجدداً.' });
  }
  if (existingApp && existingApp.status === 'rejected') {
    return res.status(400).json({ error: 'لقد تم رفض تقديمك سابقاً، لا يمكنك التقديم مجدداً.' });
  }

  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) return res.status(500).json({ error: 'Recruitment channel not found on Discord.' });

  // حفظ حالة اللاعب كـ "قيد المراجعة"
  applicationsDB.set(discordId, { status: 'pending', data: data });

  const embed = new EmbedBuilder()
    .setTitle(`📋 تقديم جديد - ${data.sector || 'الوايت ليست'}`)
    .setColor(0xF1C40F)
    .setTimestamp();

  if (data.rdm) {
    // أسئلة الوايت ليست
    embed.addFields(
      { name: '👤 Discord Name', value: data.discordName || 'غير متوفر', inline: true },
      { name: '🆔 Discord ID', value: discordId, inline: true },
      { name: '1️⃣ معنى RDM ومثال:', value: data.rdm || 'غير متوفر' },
      { name: '2️⃣ صدم بالسيارة عمداً (VDM):', value: data.vdm || 'غير متوفر' },
      { name: '3️⃣ عدم إظهار الخوف (Fear RP):', value: data.fearRp || 'غير متوفر' },
      { name: '4️⃣ الانتقام بعد الموت (NLR):', value: data.nlr || 'غير متوفر' },
      { name: '5️⃣ استخدام ديسكورد (Meta Gaming):', value: data.metaGaming || 'غير متوفر' },
      { name: '6️⃣ فرض الفعل (Power Gaming):', value: data.powerGaming || 'غير متوفر' },
      { name: '7️⃣ استفزاز الشرطة (Cop Baiting):', value: data.copBaiting || 'غير متوفر' }
    );
  } else {
    // أسئلة القطاعات الأخرى (الإسعاف، وزارة العدل، إلخ)
    embed.addFields(
      { name: '👤 الاسم الكامل:', value: data.name || 'غير متوفر', inline: true },
      { name: '👤 Discord Name:', value: data.discordName || 'غير متوفر', inline: true },
      { name: '🆔 Discord ID:', value: discordId, inline: true },
      { name: '1️⃣ التواجد اليومي:', value: data.q1 || 'غير متوفر' },
      { name: '2️⃣ الشخصيات الأخرى والوظائف:', value: data.q2 || 'غير متوفر' },
      { name: '3️⃣ الخبرات السابقة:', value: data.q3 || 'غير متوفر' }
    );
  }

  embed.setFooter({ text: `Discord ID: ${discordId} | قم بالرد مباشرة بالسبب في الروم المخصصة` });

  // القائمة المنسدلة للتحكم في القرار من قبل الإدارة
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`admin_decision_${discordId}`)
      .setPlaceholder('⚡ قرارات الإدارة (اختر الإجراء)...')
      .addOptions([
        { label: 'قبول الطلب', description: 'قبول العضو ومنحه رتبة مقبول مبدئياً', value: 'accept_action', emoji: '🟢' },
        { label: 'رفض الطلب كلياً', description: 'رفض الطلب ومنحه رتبة مرفوض', value: 'reject_action', emoji: '🔴' },
        { label: 'طلب إعادة اختبار', description: 'السماح للاعب بتقديم اختبار جديد من الموقع', value: 'retest_action', emoji: '🟡' }
      ])
  );

  await channel.send({ embeds: [embed], components: [row] });
  res.status(200).json({ success: true });
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag} successfully!`);
});

// 3. التفاعل مع خيارات الإدارة وإعطاء الرتب التلقائية
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId.startsWith('admin_decision_')) {
    const discordId = interaction.customId.split('_')[2];
    const selected = interaction.values[0];
    const guild = interaction.guild;

    if (!guild) return;

    let member;
    try {
      member = await guild.members.fetch(discordId);
    } catch (e) {
      member = null;
    }

    if (selected === 'accept_action') {
      applicationsDB.set(discordId, { status: 'accepted' });
      
      if (member) {
        try {
          await member.roles.add(ROLE_ACCEPTED);
          await member.roles.remove(ROLE_REJECTED).catch(()=>{});
          await member.roles.remove(ROLE_RETEST).catch(()=>{});
        } catch(err) { console.log("خطأ في تطبيق رتبة القبول:", err); }
      }

      await interaction.update({
        content: `✅ **تم قبول الطلب بنجاح بواسطة ${interaction.user.tag}** وتم إعطاؤه رتبة <@&${ROLE_ACCEPTED}>.`,
        components: []
      });

    } else if (selected === 'reject_action') {
      applicationsDB.set(discordId, { status: 'rejected' });

      if (member) {
        try {
          await member.roles.add(ROLE_REJECTED);
          await member.roles.remove(ROLE_ACCEPTED).catch(()=>{});
          await member.roles.remove(ROLE_RETEST).catch(()=>{});
        } catch(err) { console.log("خطأ في تطبيق رتبة الرفض:", err); }
      }

      await interaction.update({
        content: `❌ **تم رفض الطلب كلياً بواسطة ${interaction.user.tag}** وتم إعطاؤه رتبة <@&${ROLE_REJECTED}>.`,
        components: []
      });

    } else if (selected === 'retest_action') {
      applicationsDB.set(discordId, { status: 'retest' });

      if (member) {
        try {
          await member.roles.add(ROLE_RETEST);
          await member.roles.remove(ROLE_ACCEPTED).catch(()=>{});
          await member.roles.remove(ROLE_REJECTED).catch(()=>{});
        } catch(err) { console.log("خطأ في تطبيق رتبة إعادة الاختبار:", err); }
      }

      await interaction.update({
        content: `🔄 **تم طلب إعادة اختبار بواسطة ${interaction.user.tag}** وأصبح بإمكان اللاعب التقديم مجدداً من الموقع.`,
        components: []
      });
    }
  }
});

app.listen(port, () => {
  console.log(`Web server running on port ${port}`);
});

client.login(process.env.DISCORD_TOKEN);
