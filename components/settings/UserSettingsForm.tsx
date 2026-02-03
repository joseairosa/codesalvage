/**
 * UserSettingsForm Component
 *
 * Client-side form for editing user profile settings.
 * Uses React Hook Form + Zod for validation.
 */

'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type UpdateProfileFormData } from '@/lib/validations/user';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface UserSettingsFormProps {
  initialData: {
    fullName: string;
    username: string;
    bio: string;
  };
}

export function UserSettingsForm({ initialData }: UserSettingsFormProps) {
  const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: initialData,
  });

  const onSubmit = async (data: UpdateProfileFormData) => {
    setStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.field === 'username') {
          setErrorMessage('Username is already taken. Please choose a different one.');
        } else {
          setErrorMessage(error.error || 'Failed to update profile');
        }
        setStatus('error');
        return;
      }

      setStatus('success');
      // Clear success message after a few seconds
      setTimeout(() => setStatus('idle'), 4000);
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {status === 'success' && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Profile updated successfully.</AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input id="fullName" placeholder="Your full name" {...register('fullName')} />
        {errors.fullName && (
          <p className="text-sm text-destructive">{errors.fullName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" placeholder="your-username" {...register('username')} />
        {errors.username && (
          <p className="text-sm text-destructive">{errors.username.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Letters, numbers, underscores, and hyphens only.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          placeholder="Tell us about yourself..."
          rows={4}
          {...register('bio')}
        />
        {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Changes'
        )}
      </Button>
    </form>
  );
}
