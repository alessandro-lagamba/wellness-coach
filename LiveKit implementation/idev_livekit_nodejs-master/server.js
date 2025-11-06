// server.js
import dotenv from 'dotenv';
import express from 'express';
import { AccessToken } from 'livekit-server-sdk';
import crypto from 'crypto';

// Load environment variables
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}


const createToken = async () => {
  // Generate unique room name using timestamp and random string
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(4).toString('hex');
  const roomName = `room-${timestamp}-${randomId}`;
  
  // Generate unique participant name using timestamp and random string
  const participantRandomId = crypto.randomBytes(3).toString('hex');
  const participantName = `user-${timestamp}-${participantRandomId}`;

  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: participantName,
    // Token to expire after 10 minutes
    ttl: '10m',
  });
  at.addGrant({ roomJoin: true, room: roomName });

  return await at.toJwt();
};

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World');
});
app.get('/getToken', async (req, res) => {
  res.send(await createToken());
});

app.listen(port, () => {
  console.log(`Server listening on port http://localhost:${port}`);
});