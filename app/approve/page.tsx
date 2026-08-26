import { ApproveClient } from '@/components/approve-client'

export const metadata = {
  title: 'Claims Review — Hero Shield Insurance',
}

/**
 * Public likes ticker. The CIBA board on /host is what authorizes a claim.
 */
export default function ApprovePage() {
  return <ApproveClient />
}
