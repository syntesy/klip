import { pgTable, uuid, varchar, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
import { topics } from './topics'
import { communities } from './communities'

export const voiceSessionStatusEnum = pgEnum('voice_session_status', ['active', 'ended'])

export const voiceSessions = pgTable('voice_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  topicId: uuid('topic_id').notNull().references(() => topics.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  hostClerkId: varchar('host_clerk_id', { length: 255 }).notNull(),
  livekitRoomName: varchar('livekit_room_name').notNull(),
  status: voiceSessionStatusEnum('status').default('active').notNull(),
  participantCount: integer('participant_count').default(1).notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
}, (t) => [
  // Covers the most frequent query: find active session for a topic
  index('voice_sessions_topic_status_idx').on(t.topicId, t.status),
])

export type VoiceSession = typeof voiceSessions.$inferSelect
export type NewVoiceSession = typeof voiceSessions.$inferInsert
