/**
 * E2E Tests for Project Creation Flow
 * Tests the complete user journey from landing page to project creation
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('Project Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
  });

  test('should display empty state on first visit', async ({ page }) => {
    // Check for empty state
    await expect(page.getByText('No projects yet')).toBeVisible();
    await expect(page.getByText(/Create your first project/i)).toBeVisible();
    await expect(page.getByText('Create Your First Project')).toBeVisible();
  });

  test('should open create dialog via header button', async ({ page }) => {
    // Click new project button in header
    await page.getByRole('button', { name: /New Project/i }).click();

    // Dialog should be visible
    await expect(page.getByText('Create New Project')).toBeVisible();
    await expect(page.getByLabel(/project name/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
  });

  test('should open create dialog via empty state CTA', async ({ page }) => {
    // Click CTA in empty state
    await page.getByText('Create Your First Project').click();

    // Dialog should be visible
    await expect(page.getByText('Create New Project')).toBeVisible();
  });

  test('should open create dialog with Ctrl+N keyboard shortcut', async ({ page }) => {
    // Press Ctrl+N
    await page.keyboard.press('Control+n');

    // Dialog should be visible
    await expect(page.getByText('Create New Project')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: /New Project/i }).click();

    // Try to proceed without entering name
    await page.getByRole('button', { name: 'Next: Upload PDF' }).click();

    // Should show validation error
    await expect(page.getByText(/project name is required/i)).toBeVisible();
  });

  test('should progress through form steps', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: /New Project/i }).click();

    // Fill in project name
    await page.getByLabel(/project name/i).fill('Test E2E Project');
    await page.getByLabel(/description/i).fill('This is a test project');

    // Proceed to upload step
    await page.getByRole('button', { name: 'Next: Upload PDF' }).click();

    // Should be on upload step
    await expect(page.getByText('Upload PDF Plan')).toBeVisible();
    await expect(page.getByText(/Drop your PDF here/i)).toBeVisible();
  });

  test('should allow going back from upload step', async ({ page }) => {
    // Open dialog and proceed to upload step
    await page.getByRole('button', { name: /New Project/i }).click();
    await page.getByLabel(/project name/i).fill('Test Project');
    await page.getByRole('button', { name: 'Next: Upload PDF' }).click();

    // Go back
    await page.getByRole('button', { name: 'Back' }).click();

    // Should be back on details step with values preserved
    await expect(page.getByText('Create New Project')).toBeVisible();
    await expect(page.getByLabel(/project name/i)).toHaveValue('Test Project');
  });

  test('should create project without PDF', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: /New Project/i }).click();

    // Fill in details
    await page.getByLabel(/project name/i).fill('Test Project No PDF');
    await page.getByRole('button', { name: 'Next: Upload PDF' }).click();

    // Skip upload
    await page.getByRole('button', { name: 'Skip Upload' }).click();

    // Should navigate away from projects list (to project detail)
    await page.waitForURL(/\/projects\/[^/]+$/);

    // Navigate back to projects list
    await page.goto('/projects');

    // Project should be in the list
    await expect(page.getByText('Test Project No PDF')).toBeVisible();
  });

  test('should validate PDF file type', async ({ page }) => {
    // Open dialog and proceed to upload
    await page.getByRole('button', { name: /New Project/i }).click();
    await page.getByLabel(/project name/i).fill('Test Project');
    await page.getByRole('button', { name: 'Next: Upload PDF' }).click();

    // Try to upload a non-PDF file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('test content'),
    });

    // Should show error
    await expect(page.getByText(/Only PDF files are allowed/i)).toBeVisible();
  });

  test('should accept valid PDF file', async ({ page }) => {
    // Open dialog and proceed to upload
    await page.getByRole('button', { name: /New Project/i }).click();
    await page.getByLabel(/project name/i).fill('Test Project');
    await page.getByRole('button', { name: 'Next: Upload PDF' }).click();

    // Upload a valid PDF file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test'),
    });

    // Should show file name
    await expect(page.getByText('test.pdf')).toBeVisible();

    // Create button should be enabled
    const createButton = page.getByRole('button', { name: 'Create Project' });
    await expect(createButton).toBeEnabled();
  });

  test('should remove selected file', async ({ page }) => {
    // Open dialog and proceed to upload
    await page.getByRole('button', { name: /New Project/i }).click();
    await page.getByLabel(/project name/i).fill('Test Project');
    await page.getByRole('button', { name: 'Next: Upload PDF' }).click();

    // Upload a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test'),
    });

    await expect(page.getByText('test.pdf')).toBeVisible();

    // Remove file
    await page.getByText('Remove file').click();

    // File should be removed
    await expect(page.getByText('test.pdf')).not.toBeVisible();
    await expect(page.getByText(/Drop your PDF here/i)).toBeVisible();
  });

  test('should close dialog on cancel', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: /New Project/i }).click();
    await expect(page.getByText('Create New Project')).toBeVisible();

    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Dialog should be closed
    await expect(page.getByText('Create New Project')).not.toBeVisible();
  });

  test('should reset form when dialog is reopened', async ({ page }) => {
    // Open dialog and fill form
    await page.getByRole('button', { name: /New Project/i }).click();
    await page.getByLabel(/project name/i).fill('Test Project');
    await page.getByLabel(/description/i).fill('Test Description');

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Reopen dialog
    await page.getByRole('button', { name: /New Project/i }).click();

    // Form should be reset
    await expect(page.getByLabel(/project name/i)).toHaveValue('');
    await expect(page.getByLabel(/description/i)).toHaveValue('');
  });

  test('should display project cards in grid layout', async ({ page }) => {
    // Create a couple of projects first
    for (let i = 1; i <= 3; i++) {
      await page.getByRole('button', { name: /New Project/i }).click();
      await page.getByLabel(/project name/i).fill(`Project ${i}`);
      await page.getByRole('button', { name: 'Next: Upload PDF' }).click();
      await page.getByRole('button', { name: 'Skip Upload' }).click();
      await page.waitForURL(/\/projects\/[^/]+$/);
      await page.goto('/projects');
    }

    // Should display all projects
    await expect(page.getByText('Project 1')).toBeVisible();
    await expect(page.getByText('Project 2')).toBeVisible();
    await expect(page.getByText('Project 3')).toBeVisible();
  });

  test('should navigate to project detail when clicking project card', async ({ page }) => {
    // Create a project
    await page.getByRole('button', { name: /New Project/i }).click();
    await page.getByLabel(/project name/i).fill('Clickable Project');
    await page.getByRole('button', { name: 'Next: Upload PDF' }).click();
    await page.getByRole('button', { name: 'Skip Upload' }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    // Go back to list
    await page.goto('/projects');

    // Click on the project card
    await page.getByText('Clickable Project').click();

    // Should navigate to project detail
    await page.waitForURL(/\/projects\/[^/]+$/);
  });
});
