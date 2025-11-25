/**
 * E2E Test API Seeding Utilities
 * Provides helpers for seeding backend data via API calls during Playwright tests
 */

import { APIRequestContext } from '@playwright/test';
import { getSamplePlanPdf } from './files';

export interface SeededProject {
  projectId: string;
  planId: string;
  deviceIds: string[];
  stampIds: string[];
}

export interface DeviceData {
  name: string;
  description?: string;
  symbol?: string;
}

export interface StampData {
  x: number;
  y: number;
  deviceId: string;
  page?: number;
}

/**
 * Seeds a complete project with plan, devices, and stamps for e2e testing
 * @param request Playwright APIRequestContext
 * @param options Configuration options for seeding
 * @returns SeededProject with all created IDs
 */
export async function seedFullStackProject(
  request: APIRequestContext,
  options: {
    projectName?: string;
    projectDescription?: string;
    devices?: DeviceData[];
    stamps?: StampData[];
  } = {}
): Promise<SeededProject> {
  const {
    projectName = 'E2E Full-Stack Test Project',
    projectDescription = 'Project seeded for full-stack integration tests',
    devices = [
      { name: 'Outlet', description: 'Standard electrical outlet', symbol: 'O' },
      { name: 'Switch', description: 'Light switch', symbol: 'S' },
      { name: 'Light Fixture', description: 'Ceiling light', symbol: 'L' },
    ],
    stamps = [],
  } = options;

  // Step 1: Create project
  const projectResponse = await request.post('/projects', {
    data: {
      name: projectName,
      description: projectDescription,
    },
  });

  if (!projectResponse.ok()) {
    throw new Error(`Failed to create project: ${projectResponse.status()} ${await projectResponse.text()}`);
  }

  const project = await projectResponse.json();
  const projectId = project.id;

  // Step 2: Upload PDF plan
  const pdfBuffer = getSamplePlanPdf();
  const planResponse = await request.post(`/projects/${projectId}/plans`, {
    multipart: {
      file: {
        name: 'sample-plan.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      },
      name: 'Test Plan',
    },
  });

  if (!planResponse.ok()) {
    throw new Error(`Failed to upload plan: ${planResponse.status()} ${await planResponse.text()}`);
  }

  const plan = await planResponse.json();
  const planId = plan.id;

  // Step 3: Create devices
  const deviceIds: string[] = [];
  for (const device of devices) {
    const deviceResponse = await request.post(`/projects/${projectId}/devices`, {
      data: device,
    });

    if (!deviceResponse.ok()) {
      throw new Error(`Failed to create device: ${deviceResponse.status()} ${await deviceResponse.text()}`);
    }

    const createdDevice = await deviceResponse.json();
    deviceIds.push(createdDevice.id);
  }

  // Step 4: Create stamps (if provided)
  const stampIds: string[] = [];
  for (const stamp of stamps) {
    const stampResponse = await request.post(`/plans/${planId}/stamps`, {
      data: {
        ...stamp,
        planId,
      },
    });

    if (!stampResponse.ok()) {
      throw new Error(`Failed to create stamp: ${stampResponse.status()} ${await stampResponse.text()}`);
    }

    const createdStamp = await stampResponse.json();
    stampIds.push(createdStamp.id);
  }

  return {
    projectId,
    planId,
    deviceIds,
    stampIds,
  };
}

/**
 * Creates a project via API
 */
export async function seedProject(
  request: APIRequestContext,
  name: string,
  description?: string
): Promise<{ id: string; name: string; description?: string }> {
  const response = await request.post('/projects', {
    data: { name, description },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create project: ${response.status()} ${await response.text()}`);
  }

  return await response.json();
}

/**
 * Uploads a PDF plan to a project
 */
export async function seedPlan(
  request: APIRequestContext,
  projectId: string,
  planName: string = 'Test Plan'
): Promise<{ id: string; name: string; projectId: string }> {
  const pdfBuffer = getSamplePlanPdf();
  const response = await request.post(`/projects/${projectId}/plans`, {
    multipart: {
      file: {
        name: 'sample-plan.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      },
      name: planName,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to upload plan: ${response.status()} ${await response.text()}`);
  }

  return await response.json();
}

/**
 * Creates devices for a project
 */
export async function seedDevices(
  request: APIRequestContext,
  projectId: string,
  devices: DeviceData[]
): Promise<string[]> {
  const deviceIds: string[] = [];

  for (const device of devices) {
    const response = await request.post(`/projects/${projectId}/devices`, {
      data: device,
    });

    if (!response.ok()) {
      throw new Error(`Failed to create device: ${response.status()} ${await response.text()}`);
    }

    const createdDevice = await response.json();
    deviceIds.push(createdDevice.id);
  }

  return deviceIds;
}

/**
 * Creates stamps on a plan
 */
export async function seedStamps(
  request: APIRequestContext,
  planId: string,
  stamps: StampData[]
): Promise<string[]> {
  const stampIds: string[] = [];

  for (const stamp of stamps) {
    const response = await request.post(`/plans/${planId}/stamps`, {
      data: {
        ...stamp,
        planId,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create stamp: ${response.status()} ${await response.text()}`);
    }

    const createdStamp = await response.json();
    stampIds.push(createdStamp.id);
  }

  return stampIds;
}
