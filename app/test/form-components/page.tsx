/**
 * Form Components Test Page
 *
 * Test page for all reusable form components.
 * Demonstrates TechStackSelector, PriceInput, CompletionSlider, and CategorySelector.
 */

'use client';

import * as React from 'react';
import { TechStackSelector } from '@/components/projects/TechStackSelector';
import { PriceInput } from '@/components/projects/PriceInput';
import { CompletionSlider } from '@/components/projects/CompletionSlider';
import { CategorySelector } from '@/components/projects/CategorySelector';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function FormComponentsTestPage() {
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  const [techStack, setTechStack] = React.useState<string[]>([
    'React',
    'TypeScript',
    'Next.js',
  ]);
  const [priceCents, setPriceCents] = React.useState(50000); // $500
  const [completion, setCompletion] = React.useState(75);
  const [category, setCategory] = React.useState('web_app');

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    console.log('[Form Test] Submitted values:', {
      techStack,
      priceCents,
      priceDollars: priceCents / 100,
      completion,
      category,
    });

    alert(
      `Form Submitted!\n\n` +
        `Category: ${category}\n` +
        `Tech Stack: ${techStack.join(', ')}\n` +
        `Price: $${(priceCents / 100).toLocaleString()}\n` +
        `Completion: ${completion}%`
    );
  };

  const handleReset = () => {
    setTechStack(['React', 'TypeScript', 'Next.js']);
    setPriceCents(50000);
    setCompletion(75);
    setCategory('web_app');
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Form Components Test</h1>
          <p className="mt-2 text-muted-foreground">
            Test all reusable form components for project creation
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Category Selector</CardTitle>
              <CardDescription>Select the type of project you're listing</CardDescription>
            </CardHeader>
            <CardContent>
              <CategorySelector value={category} onChange={setCategory} />
            </CardContent>
          </Card>

          {/* Tech Stack Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Tech Stack Selector</CardTitle>
              <CardDescription>
                Select technologies used in your project (max 20)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TechStackSelector
                value={techStack}
                onChange={setTechStack}
                maxSelections={20}
              />
            </CardContent>
          </Card>

          {/* Completion Slider */}
          <Card>
            <CardHeader>
              <CardTitle>Completion Slider</CardTitle>
              <CardDescription>
                Indicate how complete your project is (50-95%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompletionSlider value={completion} onChange={setCompletion} />
            </CardContent>
          </Card>

          {/* Price Input */}
          <Card>
            <CardHeader>
              <CardTitle>Price Input</CardTitle>
              <CardDescription>
                Set the price for your project ($100 - $100,000)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PriceInput value={priceCents} onChange={setPriceCents} />
            </CardContent>
          </Card>

          {/* Current Values Display */}
          <Card>
            <CardHeader>
              <CardTitle>Current Form Values</CardTitle>
              <CardDescription>Real-time display of form state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">{category}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Tech Stack:</span>
                  <span className="max-w-xs truncate text-right font-medium">
                    {techStack.join(', ') || 'None selected'}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Tech Count:</span>
                  <span className="font-medium">{techStack.length}/20</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Completion:</span>
                  <span className="font-medium">{completion}%</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Price (cents):</span>
                  <span className="font-medium">{priceCents}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price (USD):</span>
                  <span className="font-medium">
                    $
                    {(priceCents / 100).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1">
              Submit Test Form
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset to Defaults
            </Button>
          </div>
        </form>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <h3 className="mb-1 font-medium">1. Test CategorySelector</h3>
              <p className="text-muted-foreground">
                Try selecting different categories. Note the description that appears
                below.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium">2. Test TechStackSelector</h3>
              <p className="text-muted-foreground">
                Add technologies from the dropdown or type custom ones. Try
                adding/removing. Test the 20-item limit.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium">3. Test CompletionSlider</h3>
              <p className="text-muted-foreground">
                Drag the slider to different percentages (50-95%). Watch the color and
                label change.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium">4. Test PriceInput</h3>
              <p className="text-muted-foreground">
                Type a price (e.g., "500"). Try values below $100 or above $100,000 to
                test validation. Note the formatting on blur.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium">5. Check Console</h3>
              <p className="text-muted-foreground">
                Open browser console (F12) to see detailed logging from each component.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
