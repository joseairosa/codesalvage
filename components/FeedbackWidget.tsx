'use client';

/**
 * FeedbackWidget
 *
 * Floating feedback button fixed to the bottom-right of every page.
 * Expands into a form for submitting general, feature, bug, or support feedback.
 * Anonymous submissions require an email; authenticated users get rate limiting.
 */

import { useState, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSession } from '@/lib/hooks/useSession';

type FeedbackType = 'general' | 'feature' | 'bug' | 'support';
type WidgetState = 'minimized' | 'expanded' | 'submitting' | 'success';

export function FeedbackWidget() {
  const { data: session, status } = useSession();
  const user = session?.user;

  const [widgetState, setWidgetState] = useState<WidgetState>('minimized');
  const [type, setType] = useState<FeedbackType>('general');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [email, setEmail] = useState('');
  const [remainingSubmissions, setRemainingSubmissions] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  // Pre-fill email from session and load rate limit for authenticated users
  useEffect(() => {
    if (!user) return;

    if (user.email) setEmail(user.email);

    const loadRateLimit = async () => {
      try {
        const res = await fetch('/api/feedback/rate-limit');
        if (res.ok) {
          const data = (await res.json()) as { remaining: number };
          setRemainingSubmissions(data.remaining);
        }
      } catch {
        // Rate limit check is non-critical — fail silently
      }
    };

    loadRateLimit();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) return setFormError('Title is required');
    if (title.length > 200) return setFormError('Title must be 200 characters or less');
    if (!content.trim()) return setFormError('Details are required');
    if (content.length > 5000)
      return setFormError('Details must be 5000 characters or less');
    if (!user && !email.trim()) return setFormError('Email address is required');

    setWidgetState('submitting');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          content: content.trim(),
          email: email.trim(),
        }),
      });

      if (res.ok) {
        setWidgetState('success');
        if (remainingSubmissions !== null) {
          setRemainingSubmissions(Math.max(0, remainingSubmissions - 1));
        }
        setTimeout(() => {
          setTitle('');
          setContent('');
          setEmail(user?.email ?? '');
          setType('general');
          setWidgetState('minimized');
        }, 2000);
      } else {
        const data = (await res.json()) as { message?: string };
        setFormError(data.message ?? 'Failed to submit feedback. Please try again.');
        setWidgetState('expanded');
      }
    } catch {
      setFormError('An unexpected error occurred. Please try again.');
      setWidgetState('expanded');
    }
  };

  if (widgetState === 'minimized') {
    return (
      <button
        onClick={() => setWidgetState('expanded')}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-110 hover:shadow-xl"
        aria-label="Send feedback"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  if (widgetState === 'success') {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-96">
        <Card className="shadow-2xl">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <CheckCircle2 className="mb-4 h-16 w-16 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold">Thank you!</h3>
            <p className="text-center text-sm text-muted-foreground">
              Your feedback has been submitted successfully.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSubmitting = widgetState === 'submitting';
  const isRateLimited = user !== undefined && remainingSubmissions === 0;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96">
      <Card className="shadow-2xl">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle>Send Feedback</CardTitle>
            <CardDescription>Help us improve CodeSalvage</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWidgetState('minimized')}
            disabled={isSubmitting}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Type</label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as FeedbackType)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Feedback</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="support">Support Request</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Title <span className="text-muted-foreground">({title.length}/200)</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of your feedback"
                maxLength={200}
                disabled={isSubmitting}
              />
            </div>

            {/* Content */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Details{' '}
                <span className="text-muted-foreground">({content.length}/5000)</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe your feedback in detail..."
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                maxLength={5000}
                disabled={isSubmitting}
              />
            </div>

            {/* Email — always shown; pre-filled for logged-in users */}
            {status !== 'loading' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={isSubmitting || !!user}
                />
              </div>
            )}

            {/* Rate limit notice */}
            {user && remainingSubmissions !== null && (
              <p className="text-xs text-muted-foreground">
                {remainingSubmissions > 0
                  ? `${remainingSubmissions} submission${remainingSubmissions === 1 ? '' : 's'} remaining today`
                  : 'Daily limit reached. Please try again tomorrow.'}
              </p>
            )}

            {/* Error */}
            {formError && <p className="text-xs text-destructive">{formError}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isRateLimited}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Feedback
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
