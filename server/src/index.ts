import { app } from './app.js';
import { env } from './config/env.js';
import { startReminderJob } from './jobs/reminders.js';
import { connectDb, disconnectDb } from './lib/db.js';

await connectDb();
const server = app.listen(env.PORT, () => console.log(`EquibHub API listening on http://localhost:${env.PORT}`));
startReminderJob();
const shutdown = async () => { server.close(); await disconnectDb(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
