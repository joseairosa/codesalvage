'use client';

/**
 * API Keys Section (Settings)
 *
 * Lists the user's API keys and allows creating new ones.
 * Calls GET/POST /api/user/api-keys (cookie auth, no API key needed).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Key, Copy, Check, AlertCircle } from 'lucide-react';

const componentName = 'ApiKeysSection';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  status: string;
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  createdAt: string;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function ApiKeysSection() {
  const [keys, setKeys] = React.useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Create form state
  const [isCreating, setIsCreating] = React.useState(false);
  const [newKeyName, setNewKeyName] = React.useState('');
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const loadKeys = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/api-keys');
      if (!res.ok) throw new Error(`Failed to load API keys (${res.status})`);
      const data = await res.json();
      setKeys(data.apiKeys ?? []);
    } catch (err) {
      console.error(`[${componentName}] Load error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    setCreateError(null);
    setNewKeyValue(null);

    try {
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);

      setNewKeyValue(data.apiKey);
      setNewKeyName('');
      await loadKeys();
    } catch (err) {
      console.error(`[${componentName}] Create error:`, err);
      setCreateError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  }

  function handleCopy() {
    if (!newKeyValue) return;
    void navigator.clipboard.writeText(newKeyValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function dismissNewKey() {
    setNewKeyValue(null);
  }

  return (
    <div className="space-y-6">
      {/* New key reveal (shown once after creation) */}
      {newKeyValue && (
        <Alert className="border-green-200 bg-green-50">
          <Key className="h-4 w-4 text-green-700" />
          <AlertDescription className="space-y-3">
            <p className="font-medium text-green-900">
              API key created — save it now. You will not be able to see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-green-100 px-3 py-2 font-mono text-xs text-green-900">
                {newKeyValue}
              </code>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismissNewKey}
              className="text-green-700 hover:text-green-900"
            >
              I&apos;ve saved it
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Create form */}
      <form onSubmit={(e) => void handleCreate(e)} className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="api-key-name">New API key name</Label>
          <Input
            id="api-key-name"
            placeholder="e.g. CI pipeline, local dev"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            disabled={isCreating}
            maxLength={64}
          />
        </div>
        <Button type="submit" disabled={isCreating || !newKeyName.trim()}>
          {isCreating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create
        </Button>
      </form>

      {createError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{createError}</AlertDescription>
        </Alert>
      )}

      {/* Key list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <div className="divide-y rounded-md border">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{key.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{key.prefix}…</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {key.lastUsedAt ? (
                  <span>Last used {formatDate(key.lastUsedAt)}</span>
                ) : (
                  <span>Never used</span>
                )}
                {key.expiresAt && <span>Expires {formatDate(key.expiresAt)}</span>}
                <Badge
                  variant={key.status === 'active' ? 'secondary' : 'destructive'}
                  className="capitalize"
                >
                  {key.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
