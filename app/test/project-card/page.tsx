/**
 * ProjectCard Component Test Page
 *
 * Interactive test page for the ProjectCard component.
 * Displays various project cards with different states.
 */

'use client';

import * as React from 'react';
import { ProjectCard, type ProjectCardData } from '@/components/projects/ProjectCard';

const mockProjects: ProjectCardData[] = [
  {
    id: '1',
    title: 'E-commerce Dashboard with Analytics',
    description:
      'A comprehensive e-commerce admin dashboard built with React and Node.js. Includes real-time analytics, inventory management, order tracking, and customer insights. Payment integration with Stripe is fully functional.',
    category: 'web_app',
    completionPercentage: 85,
    priceCents: 75000, // $750
    techStack: ['React', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'Stripe'],
    thumbnailImageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
    isFeatured: true,
    viewCount: 245,
    favoriteCount: 32,
    seller: {
      id: 'seller1',
      username: 'techbuilder',
      fullName: 'Sarah Chen',
      avatarUrl: 'https://i.pravatar.cc/150?img=1',
    },
  },
  {
    id: '2',
    title: 'Mobile Fitness Tracker App',
    description:
      'iOS and Android fitness tracking app with workout plans, calorie tracking, and social features. Backend API built with Django. Missing Apple Health integration and final UI polish.',
    category: 'mobile_app',
    completionPercentage: 70,
    priceCents: 125000, // $1,250
    techStack: ['React Native', 'Django', 'PostgreSQL', 'Redis'],
    thumbnailImageUrl: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=450&fit=crop',
    isFeatured: false,
    viewCount: 178,
    favoriteCount: 21,
    seller: {
      id: 'seller2',
      username: 'mobilepro',
      fullName: 'Alex Johnson',
      avatarUrl: 'https://i.pravatar.cc/150?img=2',
    },
  },
  {
    id: '3',
    title: 'CLI Tool for Git Workflow Automation',
    description:
      'Command-line tool written in Go that automates common Git workflows. Includes branch management, PR creation, and commit message templating. Needs Windows support and better error handling.',
    category: 'cli_tool',
    completionPercentage: 92,
    priceCents: 35000, // $350
    techStack: ['Go', 'Cobra', 'Git'],
    thumbnailImageUrl: null, // Test fallback
    isFeatured: false,
    viewCount: 89,
    favoriteCount: 12,
    seller: {
      id: 'seller3',
      username: 'godev',
      fullName: null,
      avatarUrl: null,
    },
  },
  {
    id: '4',
    title: 'Real-time Chat Application',
    description:
      'WebSocket-based real-time chat with channels, direct messaging, file sharing, and emoji reactions. Built with Next.js and Socket.io. Missing end-to-end encryption and notification system.',
    category: 'web_app',
    completionPercentage: 78,
    priceCents: 95000, // $950
    techStack: ['Next.js', 'Socket.io', 'MongoDB', 'TypeScript', 'Tailwind CSS', 'WebRTC'],
    thumbnailImageUrl: 'https://images.unsplash.com/photo-1611606063065-ee7946f0787a?w=800&h=450&fit=crop',
    isFeatured: true,
    viewCount: 312,
    favoriteCount: 45,
    seller: {
      id: 'seller4',
      username: 'fullstackdev',
      fullName: 'Maria Garcia',
      avatarUrl: 'https://i.pravatar.cc/150?img=4',
    },
  },
  {
    id: '5',
    title: 'Machine Learning Model Dashboard',
    description:
      'Dashboard for visualizing and managing ML model training runs. Supports TensorFlow and PyTorch. Includes experiment tracking, hyperparameter tuning, and model comparison. Needs better performance optimization.',
    category: 'dashboard',
    completionPercentage: 65,
    priceCents: 180000, // $1,800
    techStack: ['Python', 'FastAPI', 'React', 'TensorFlow', 'PyTorch', 'PostgreSQL'],
    thumbnailImageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
    isFeatured: false,
    viewCount: 156,
    favoriteCount: 28,
    seller: {
      id: 'seller5',
      username: 'mlresearcher',
      fullName: 'David Kim',
      avatarUrl: 'https://i.pravatar.cc/150?img=5',
    },
  },
  {
    id: '6',
    title: 'Indie Game Prototype',
    description:
      '2D platformer game built with Unity. Core gameplay mechanics complete, including physics, enemies, and level progression. Missing audio, final art assets, and additional levels.',
    category: 'game',
    completionPercentage: 55,
    priceCents: 220000, // $2,200
    techStack: ['Unity', 'C#', 'Blender'],
    thumbnailImageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=450&fit=crop',
    isFeatured: false,
    viewCount: 203,
    favoriteCount: 37,
    seller: {
      id: 'seller6',
      username: 'indiegamedev',
      fullName: 'Emma Wilson',
      avatarUrl: 'https://i.pravatar.cc/150?img=6',
    },
  },
];

export default function ProjectCardTestPage() {
  console.log('[ProjectCardTestPage] Page rendered');

  return (
    <div className="container mx-auto max-w-7xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">ProjectCard Component Test</h1>
          <p className="mt-2 text-muted-foreground">
            Interactive test page showing project cards in various states
          </p>
        </div>

        {/* Grid Layout - Desktop 3 columns, Tablet 2 columns, Mobile 1 column */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>

        {/* Without Seller Info */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Without Seller Info</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mockProjects.slice(0, 3).map((project) => (
              <ProjectCard key={`no-seller-${project.id}`} project={project} showSellerInfo={false} />
            ))}
          </div>
        </div>

        {/* Without Stats */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Without Stats</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mockProjects.slice(0, 3).map((project) => (
              <ProjectCard key={`no-stats-${project.id}`} project={project} showStats={false} />
            ))}
          </div>
        </div>

        {/* Completion Percentage Examples */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Completion Percentage Variations</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <ProjectCard
              project={{
                ...mockProjects[0],
                id: 'completion-50',
                completionPercentage: 50,
              }}
            />
            <ProjectCard
              project={{
                ...mockProjects[0],
                id: 'completion-65',
                completionPercentage: 65,
              }}
            />
            <ProjectCard
              project={{
                ...mockProjects[0],
                id: 'completion-80',
                completionPercentage: 80,
              }}
            />
            <ProjectCard
              project={{
                ...mockProjects[0],
                id: 'completion-95',
                completionPercentage: 95,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
