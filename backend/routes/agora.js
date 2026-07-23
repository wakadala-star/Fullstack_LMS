const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

// Generate Agora RTC token
router.post('/token', authenticateToken, async (req, res) => {
  try {
    const { channelName, uid } = req.body;

    if (!APP_ID || !APP_CERTIFICATE) {
      return res.status(500).json({ error: 'Agora credentials not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env' });
    }

    if (!channelName) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + 3600; // 1 hour
    const channelNameStr = String(channelName);
    const userUid = uid || 0;

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelNameStr,
      userUid,
      RtcRole.PUBLISHER,
      privilegeExpireTime
    );

    res.json({
      token,
      appId: APP_ID,
      channel: channelNameStr,
      uid: userUid,
      expiresAt: privilegeExpireTime,
    });
  } catch (error) {
    console.error('Generate Agora token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
