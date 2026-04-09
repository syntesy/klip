import { pgTable, uuid, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { topics } from './topics.js'
import { communities } from './communities.js'

export const voiceSessionStatusEnum = pgEnum('voice_session_status', ['active', 'ended'])

export const voiceSessions = pgTable('voice_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  topicId: uuid('topic_id').notNull().references(() => topics.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  hostClerkId: varchar('host_clerk_id').notNull(),
  livekitRoomName: varchar('livekit_room_name').notNull(),
  status: voiceSessionStatusEnum('status').default('active').notNull(),
  participantCount: integer('participant_count').default(1).notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
})

export type VoiceSession = typeof voiceSessions.$inferSelect
export type NewVoiceSession = typeof voiceSessions.$inferInsert
