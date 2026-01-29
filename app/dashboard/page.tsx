/**
 * Dashboard Page (Protected Route)
 *
 * Requires authentication via Firebase.
 * Redirects to sign-in if user is not authenticated.
 */

import { requireAuth } from '@/lib/auth-helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const session = await requireAuth();

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600">
          Welcome back, {session.user.username || session.user.email}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Email:</span> {session.user.email}
              </div>
              <div>
                <span className="font-medium">Username:</span>{' '}
                {session.user.username || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Role:</span>{' '}
                {session.user.isSeller ? 'Seller' : 'Buyer'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Projects:</span> 0
              </div>
              <div>
                <span className="font-medium">Transactions:</span> 0
              </div>
              <div>
                <span className="font-medium">Messages:</span> 0
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Verified:</span>{' '}
                {session.user.isVerifiedSeller ? 'Yes' : 'No'}
              </div>
              <div>
                <span className="font-medium">Member Since:</span> Recently
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
