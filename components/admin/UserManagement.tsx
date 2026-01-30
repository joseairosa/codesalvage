/**
 * UserManagement Component
 *
 * Responsibilities:
 * - Fetch and display users with filters
 * - Provide ban/unban actions
 * - Handle pagination
 * - Show user details and stats
 *
 * Architecture:
 * - Client Component with state management
 * - Table-based layout with action buttons
 * - Dialog for ban reason input
 * - Real-time updates after actions
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, UserCheck, UserX, Mail, Shield } from 'lucide-react';

/**
 * User Interface (matching API response)
 */
interface User {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  isSeller: boolean;
  isVerifiedSeller: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  bannedAt: Date | null;
  bannedReason: string | null;
  createdAt: Date;
}

/**
 * UserManagement Component
 */
export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [isBannedFilter, setIsBannedFilter] = useState<string>('all');
  const [isSellerFilter, setIsSellerFilter] = useState<string>('all');

  // Pagination
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Ban dialog state
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banError, setBanError] = useState<string | null>(null);

  /**
   * Fetch users with current filters
   */
  async function fetchUsers() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (isBannedFilter !== 'all') {
        params.append('isBanned', isBannedFilter);
      }

      if (isSellerFilter !== 'all') {
        params.append('isSeller', isSellerFilter);
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await res.json();
      setUsers(data.users);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('[UserManagement] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetch users on mount and filter changes
   */
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBannedFilter, isSellerFilter, offset]);

  /**
   * Handle ban user
   */
  async function handleBanUser() {
    if (!selectedUser || !banReason.trim()) {
      setBanError('Please provide a ban reason (minimum 10 characters)');
      return;
    }

    setActionLoading(selectedUser.id);
    setBanError(null);

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: banReason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to ban user');
      }

      // Refresh users list
      await fetchUsers();

      // Close dialog and reset state
      setBanDialogOpen(false);
      setSelectedUser(null);
      setBanReason('');
    } catch (err) {
      console.error('[UserManagement] Ban error:', err);
      setBanError(err instanceof Error ? err.message : 'Failed to ban user');
    } finally {
      setActionLoading(null);
    }
  }

  /**
   * Handle unban user
   */
  async function handleUnbanUser(user: User) {
    if (!confirm(`Are you sure you want to unban ${user.username}?`)) {
      return;
    }

    setActionLoading(user.id);

    try {
      const res = await fetch(`/api/admin/users/${user.id}/unban`, {
        method: 'PUT',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unban user');
      }

      // Refresh users list
      await fetchUsers();
    } catch (err) {
      console.error('[UserManagement] Unban error:', err);
      alert(err instanceof Error ? err.message : 'Failed to unban user');
    } finally {
      setActionLoading(null);
    }
  }

  /**
   * Open ban dialog
   */
  function openBanDialog(user: User) {
    setSelectedUser(user);
    setBanReason('');
    setBanError(null);
    setBanDialogOpen(true);
  }

  /**
   * Format date
   */
  function formatDate(date: Date | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            {/* Filter by banned status */}
            <div className="flex-1">
              <Label className="text-xs">Status</Label>
              <Select value={isBannedFilter} onValueChange={setIsBannedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="false">Active users</SelectItem>
                  <SelectItem value="true">Banned users</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter by seller status */}
            <div className="flex-1">
              <Label className="text-xs">User Type</Label>
              <Select value={isSellerFilter} onValueChange={setIsSellerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="true">Sellers</SelectItem>
                  <SelectItem value="false">Buyers only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No users found with the selected filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.username}</div>
                            {user.fullName && (
                              <div className="text-xs text-gray-500">
                                {user.fullName}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-gray-400" />
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.isAdmin && (
                              <Badge variant="default" className="gap-1">
                                <Shield className="h-3 w-3" />
                                Admin
                              </Badge>
                            )}
                            {user.isSeller && (
                              <Badge variant="secondary">Seller</Badge>
                            )}
                            {user.isVerifiedSeller && (
                              <Badge variant="outline" className="gap-1">
                                <UserCheck className="h-3 w-3" />
                                Verified
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.isBanned ? (
                            <Badge variant="destructive" className="gap-1">
                              <UserX className="h-3 w-3" />
                              Banned
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-green-700">
                              <UserCheck className="h-3 w-3" />
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.isBanned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnbanUser(user)}
                              disabled={actionLoading === user.id}
                            >
                              {actionLoading === user.id ? 'Unbanning...' : 'Unban'}
                            </Button>
                          ) : user.isAdmin ? (
                            <span className="text-xs text-gray-400">Protected</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openBanDialog(user)}
                              disabled={actionLoading === user.id}
                            >
                              Ban User
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} users
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Ban User Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              You are about to ban {selectedUser?.username}. This action will prevent
              them from accessing the platform.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="ban-reason">Reason for ban *</Label>
              <Textarea
                id="ban-reason"
                placeholder="Enter reason for ban (minimum 10 characters)..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={4}
                className="mt-2"
              />
              {banError && (
                <p className="mt-2 text-sm text-red-600">{banError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBanDialogOpen(false)}
              disabled={actionLoading === selectedUser?.id}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBanUser}
              disabled={actionLoading === selectedUser?.id || !banReason.trim()}
            >
              {actionLoading === selectedUser?.id ? 'Banning...' : 'Ban User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
