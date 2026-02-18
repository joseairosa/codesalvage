import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitHubAccessCard } from '../GitHubAccessCard';

const baseProps = {
  repoName: 'my-repo',
  buyerGithubUsername: 'buyeruser',
  isConnecting: false,
  githubError: null,
  githubSuccess: null,
  sessionGithubUsername: null,
  onConnect: vi.fn(),
};

describe('GitHubAccessCard', () => {
  describe('connect state', () => {
    it('renders sign in with GitHub button when no session username', () => {
      render(<GitHubAccessCard {...baseProps} githubAccessState="connect" />);
      expect(
        screen.getByRole('button', { name: /sign in with github/i })
      ).toBeInTheDocument();
    });

    it('renders grant repository access button when session username present', () => {
      render(
        <GitHubAccessCard
          {...baseProps}
          githubAccessState="connect"
          sessionGithubUsername="myuser"
        />
      );
      expect(
        screen.getByRole('button', { name: /grant repository access/i })
      ).toBeInTheDocument();
    });

    it('disables button and shows spinner while connecting', () => {
      render(
        <GitHubAccessCard
          {...baseProps}
          githubAccessState="connect"
          isConnecting={true}
        />
      );
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('calls onConnect when button clicked', async () => {
      const onConnect = vi.fn();
      render(
        <GitHubAccessCard
          {...baseProps}
          githubAccessState="connect"
          onConnect={onConnect}
        />
      );
      await userEvent.click(screen.getByRole('button'));
      expect(onConnect).toHaveBeenCalledOnce();
    });

    it('shows error alert when githubError is set', () => {
      render(
        <GitHubAccessCard
          {...baseProps}
          githubAccessState="connect"
          githubError="Something went wrong"
        />
      );
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('checking state', () => {
    it('renders checking message', () => {
      render(<GitHubAccessCard {...baseProps} githubAccessState="checking" />);
      expect(screen.getByText(/checking github access/i)).toBeInTheDocument();
    });

    it('does not render connect button', () => {
      render(<GitHubAccessCard {...baseProps} githubAccessState="checking" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('pending state', () => {
    it('renders awaiting acceptance message', () => {
      render(<GitHubAccessCard {...baseProps} githubAccessState="pending" />);
      expect(
        screen.getByText(/invitation sent — awaiting acceptance/i)
      ).toBeInTheDocument();
    });

    it('shows buyer github username in message', () => {
      render(<GitHubAccessCard {...baseProps} githubAccessState="pending" />);
      expect(screen.getByText(/@buyeruser/)).toBeInTheDocument();
    });

    it('does not render connect button', () => {
      render(<GitHubAccessCard {...baseProps} githubAccessState="pending" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('granted state', () => {
    it('renders collaborator access granted message', () => {
      render(<GitHubAccessCard {...baseProps} githubAccessState="granted" />);
      expect(screen.getByText(/collaborator access granted/i)).toBeInTheDocument();
    });

    it('shows buyer github username and repo name', () => {
      render(<GitHubAccessCard {...baseProps} githubAccessState="granted" />);
      expect(screen.getByText(/@buyeruser/)).toBeInTheDocument();
      expect(screen.getByText(/my-repo/)).toBeInTheDocument();
    });

    it('falls back to "the repository" when repoName is null', () => {
      render(
        <GitHubAccessCard {...baseProps} githubAccessState="granted" repoName={null} />
      );
      expect(screen.getAllByText(/the repository/i).length).toBeGreaterThan(0);
    });
  });
});
