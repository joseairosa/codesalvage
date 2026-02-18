import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PurchaseFlowStepsProps {
  hasGithubRepo: boolean;
  escrowReleaseDate: Date;
  formatDate: (date: Date) => string;
}

export function PurchaseFlowSteps({
  hasGithubRepo,
  escrowReleaseDate,
  formatDate,
}: PurchaseFlowStepsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What Happens Next?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            1
          </div>
          <div>
            <h4 className="font-semibold">Collaborator Access</h4>
            <p className="text-sm text-muted-foreground">
              {hasGithubRepo
                ? "Enter your GitHub username above. You'll be immediately added as a collaborator so you can review the real repository."
                : 'You now have immediate access to download the project code and assets.'}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            2
          </div>
          <div>
            <h4 className="font-semibold">7-Day Review Period</h4>
            <p className="text-sm text-muted-foreground">
              Your payment is held in escrow while you review the code. You have until{' '}
              <span className="font-medium">{formatDate(escrowReleaseDate)}</span> to
              raise any concerns.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            3
          </div>
          <div>
            <h4 className="font-semibold">Ownership Transfer</h4>
            <p className="text-sm text-muted-foreground">
              After the review period, full repository ownership is automatically
              transferred to your GitHub account.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            4
          </div>
          <div>
            <h4 className="font-semibold">Funds Released</h4>
            <p className="text-sm text-muted-foreground">
              Once the ownership transfer is confirmed, escrowed funds are released to the
              seller. The deal is complete.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
