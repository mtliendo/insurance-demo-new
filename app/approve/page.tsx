import { ApproveClient } from '@/components/approve-client'

export const metadata = {
  title: 'Claims Review — Hero Shield Insurance',
}

/**
 * Public approver screen. This is the demo's audience-participation moment:
 * attendees open /approve and vote, which is what used to arrive as
 * CLAIM_APPROVAL events on the AppSync `interviewDemo/attendee` channel.
 */
export default function ApprovePage() {
  return <ApproveClient />
}
