import { z } from 'zod'

export const nostrEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string(),
})

export const communityDefinitionSchema = z.object({
  id: z.string(), // d tag
  name: z.string().optional(),
  description: z.string().optional(),
  rules: z.string().optional(),
  image: z.string().url().optional(),
  moderators: z.array(z.string()),
  relays: z.array(z.string().url()),
  creator: z.string(),
})

export const approvalSchema = z.object({
  eventId: z.string(),
  moderatorPubkey: z.string(),
  communityATag: z.string(),
})

export type CommunityDefinition = z.infer<typeof communityDefinitionSchema>
