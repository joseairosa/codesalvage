/**
 * Review Submission Page
 *
 * Allows buyers to submit reviews for completed purchases.
 *
 * Features:
 * - Overall rating (1-5 stars)
 * - Detailed ratings (code quality, docs, responsiveness, accuracy)
 * - Written comment
 * - Anonymous option
 *
 * @example
 * /transactions/txn123/review
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Star, AlertCircle, CheckCircle2 } from 'lucide-react';

const componentName = 'ReviewSubmissionPage';

export default function ReviewSubmissionPage({ params }: { params: { id: string } }) {
  console.log(`[${componentName}] Page rendered for transaction:`, params.id);

  const router = useRouter();
  const { data: _session, status: sessionStatus } = useSession();

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const [overallRating, setOverallRating] = React.useState(0);
  const [codeQualityRating, setCodeQualityRating] = React.useState(0);
  const [documentationRating, setDocumentationRating] = React.useState(0);
  const [responsivenessRating, setResponsivenessRating] = React.useState(0);
  const [accuracyRating, setAccuracyRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [isAnonymous, setIsAnonymous] = React.useState(false);

  /**
   * Submit review
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (overallRating === 0) {
      setError('Please select an overall rating');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: params.id,
          overallRating,
          comment: comment.trim() || undefined,
          codeQualityRating: codeQualityRating || undefined,
          documentationRating: documentationRating || undefined,
          responsivenessRating: responsivenessRating || undefined,
          accuracyRating: accuracyRating || undefined,
          isAnonymous,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit review');
      }

      const data = await response.json();
      console.log(`[${componentName}] Review submitted:`, data.review.id);

      setSuccess(true);

      // Redirect to buyer dashboard after 2 seconds
      setTimeout(() => {
        router.push('/buyer/purchases');
      }, 2000);
    } catch (err) {
      console.error(`[${componentName}] Submit error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Star Rating Component
   */
  const StarRating = ({
    rating,
    onChange,
    label,
  }: {
    rating: number;
    onChange: (rating: number) => void;
    label: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-8 w-8 ${
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-muted-foreground">
            ({rating} {rating === 1 ? 'star' : 'stars'})
          </span>
        )}
      </div>
    </div>
  );

  /**
   * Redirect if not authenticated
   */
  React.useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=/transactions/${params.id}/review`);
    }
  }, [sessionStatus, params.id, router]);

  if (success) {
    return (
      <div className="container mx-auto max-w-2xl py-10">
        <Alert className="border-green-500">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <AlertDescription>
            <strong>Review submitted!</strong> Thank you for your feedback. Redirecting to your purchases...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Review Your Purchase</h1>
          <p className="mt-2 text-muted-foreground">
            Share your experience to help other buyers
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Review Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Rate Your Experience</CardTitle>
              <CardDescription>
                Your honest feedback helps improve the marketplace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overall Rating */}
              <div className="rounded-lg border p-4">
                <StarRating
                  rating={overallRating}
                  onChange={setOverallRating}
                  label="Overall Rating *"
                />
              </div>

              {/* Detailed Ratings */}
              <div className="space-y-4">
                <h3 className="font-semibold">Detailed Ratings (Optional)</h3>

                <StarRating
                  rating={codeQualityRating}
                  onChange={setCodeQualityRating}
                  label="Code Quality"
                />

                <StarRating
                  rating={documentationRating}
                  onChange={setDocumentationRating}
                  label="Documentation"
                />

                <StarRating
                  rating={responsivenessRating}
                  onChange={setResponsivenessRating}
                  label="Seller Responsiveness"
                />

                <StarRating
                  rating={accuracyRating}
                  onChange={setAccuracyRating}
                  label="Project Accuracy"
                />
              </div>

              {/* Written Comment */}
              <div className="space-y-2">
                <Label htmlFor="comment">Written Review (Optional)</Label>
                <Textarea
                  id="comment"
                  placeholder="Share details about your experience with this project..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {comment.length} / 2000 characters
                </p>
              </div>

              {/* Anonymous Option */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="anonymous"
                  checked={isAnonymous}
                  onCheckedChange={(checked) => setIsAnonymous(checked === true)}
                />
                <Label
                  htmlFor="anonymous"
                  className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Post this review anonymously
                </Label>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/buyer/purchases')}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading || overallRating === 0}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Review'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
