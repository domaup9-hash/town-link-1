const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  EmbedBuilder 
} = require('discord.js');
const express = require('express');
const cors = require('cors');

// 1. إعداد سيرفر Express لاستقبال الطلبات من الموقع
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TOKEN; // سيتم قراءته من Environment Variables
const TARGET_CHANNEL_ID = '1562484970751270994'; // روم الوايت ليست بالديسكورد

// 2. إعداد بوت الديسكورد
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', () => {
  console.log(`✅ تم تسجيل الدخول بنجاح كـ: ${client.user.tag}`);
});

// 3. API endpoint لاستقبال التقديمات من الموقع وإرسالها للديسكورد
app.post('/api/apply-whitelist', async (req, res) => {
  try {
    const data = req.body;

    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على القناة في الديسكورد' });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ استمارة اختبار الوايت ليست: ${data.name}`)
      .setColor(0xf59e0b)
      .addFields(
        { name: "👤 الاسم:", value: `\`${data.name}\``, inline: true },
        { name: "💬 Discord:", value: `\`${data.discordUser}\``, inline: true },
        { name: "🆔 ID:", value: `\`${data.discordId}\``, inline: false },
        { name: "1. معنى RDM ومثال:", value: data.q1 || 'بدون إجابة' },
        { name: "2. صدم بالسيارة عمداً (VDM):", value: data.q2 || 'بدون إجابة' },
        { name: "3. عدم إظهار الخوف (Fear RP):", value: data.q3 || 'بدون إجابة' },
        { name: "4. الانتقام بعد الموت (NLR):", value: data.q4 || 'بدون إجابة' },
        { name: "5. استخدام ديسكورد (Meta Gaming):", value: data.q5 || 'بدون إجابة' },
        { name: "6. فرض الفعل (Power Gaming):", value: data.q6 || 'بدون إجابة' },
        { name: "7. استفزاز الشرطة (Cop Baiting):", value: data.q7 || 'بدون إجابة' }
      )
      .setTimestamp();

    // إضافة الأزرار التفاعلية
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wl_accept_${data.discordId}`)
        .setLabel('قبول ✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`wl_reject_${data.discordId}`)
        .setLabel('رفض ❌')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`wl_retest_${data.discordId}`)
        .setLabel('إعادة اختبار 🔄')
        .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ 
      content: `📋 **تقديم وايت ليست جديد (<@${data.discordId}>)**`, 
      embeds: [embed], 
      components: [row] 
    });

    return res.status(200).json({ success: true, message: 'تم إرسال التقديم بنجاح' });

  } catch (error) {
    console.error('خطأ أثناء معالجة التقديم:', error);
    return res.status(500).json({ success: false, message: 'حدث خطأ في السيرفر' });
  }
});

// 4. التعامل مع التفاعلات (الضغط على الأزرار ونوافذ الأسباب)
client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    const parts = interaction.customId.split('_');
    if (parts[0] !== 'wl') return;

    const actionType = parts[1]; // accept, reject, retest
    const targetUserId = parts[2];

    if (actionType === 'accept') {
      const oldEmbed = interaction.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(0x22c55e)
        .addFields({ name: "✅ القرار النهائي:", value: `تم القبول بواسطة <@${interaction.user.id}>`, inline: false });

      await interaction.update({
        content: `🎉 **تم قبول طلب الوايت ليست بنجاح!** (<@${targetUserId}>)`,
        embeds: [updatedEmbed],
        components: []
      });
      return;
    }

    // إظهار نافذة (Modal) لكتابة السبب في حالة الرفض أو إعادة الاختبار
    const modal = new ModalBuilder()
      .setCustomId(`modal_${actionType}_${targetUserId}`)
      .setTitle(actionType === 'reject' ? 'سبب رفض تقديم الوايت ليست' : 'سبب طلب إعادة الاختبار');

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason_text')
      .setLabel('اكتب السبب بالتفصيل هنا:')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('مثال: عدم فهم قانون RDM بشكل صحيح...');

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
  } 
  
  else if (interaction.isModalSubmit()) {
    const parts = interaction.customId.split('_');
    const actionType = parts[1]; // reject or retest
    const targetUserId = parts[2];
    const reason = interaction.fields.getTextInputValue('reason_text');

    const isReject = actionType === 'reject';
    const statusText = isReject ? '❌ **تم رفض الطلب**' : '🔄 **مطلوب إعادة الاختبار**';
    const embedColor = isReject ? 0xef4444 : 0xf59e0b;
    const fieldTitle = isReject ? "🚫 سبب الرفض:" : "🔄 سبب إعادة الاختبار:";

    const oldEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(oldEmbed)
      .setColor(embedColor)
      .addFields(
        { name: "👤 الإداري المسؤول:", value: `<@${interaction.user.id}>`, inline: true },
        { name: fieldTitle, value: `\`\`\`${reason}\`\`\``, inline: false }
      );

    await interaction.update({
      content: `${statusText} للاعب <@${targetUserId}>\n**السبب:** ${reason}`,
      embeds: [updatedEmbed],
      components: []
    });
  }
});

// تشغيل السيرفر والبوت
app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
});

client.login(BOT_TOKEN);