/**
 * Location Store Tests
 * Unit tests for location state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useLocationStore } from '../state/useLocationStore';
import type { Location } from '../types';

describe('useLocationStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useLocationStore.setState({
      locations: new Map(),
      selectedLocationId: null,
      activeTool: 'none',
      draftPolygon: null,
      draftRectangle: null,
    });
  });

  describe('Location Management', () => {
    it('sets locations from array', () => {
      const locations: Location[] = [
        {
          id: 'loc-1',
          planId: 'plan-1',
          name: 'Room 1',
          type: 'rectangle',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          vertices: null,
          color: '#ff0000',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      useLocationStore.getState().setLocations(locations);

      const state = useLocationStore.getState();
      expect(state.locations.size).toBe(1);
      expect(state.locations.get('loc-1')).toEqual(locations[0]);
    });

    it('adds a location', () => {
      const location: Location = {
        id: 'loc-1',
        planId: 'plan-1',
        name: 'Room 1',
        type: 'rectangle',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        vertices: null,
        color: '#ff0000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useLocationStore.getState().addLocation(location);

      const state = useLocationStore.getState();
      expect(state.locations.size).toBe(1);
      expect(state.locations.get('loc-1')).toEqual(location);
    });

    it('updates a location', () => {
      const location: Location = {
        id: 'loc-1',
        planId: 'plan-1',
        name: 'Room 1',
        type: 'rectangle',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        vertices: null,
        color: '#ff0000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useLocationStore.getState().addLocation(location);
      useLocationStore.getState().updateLocation('loc-1', { name: 'Updated Room' });

      const state = useLocationStore.getState();
      expect(state.locations.get('loc-1')?.name).toBe('Updated Room');
    });

    it('removes a location', () => {
      const location: Location = {
        id: 'loc-1',
        planId: 'plan-1',
        name: 'Room 1',
        type: 'rectangle',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        vertices: null,
        color: '#ff0000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useLocationStore.getState().addLocation(location);
      useLocationStore.getState().removeLocation('loc-1');

      const state = useLocationStore.getState();
      expect(state.locations.size).toBe(0);
    });

    it('clears all locations', () => {
      const locations: Location[] = [
        {
          id: 'loc-1',
          planId: 'plan-1',
          name: 'Room 1',
          type: 'rectangle',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          vertices: null,
          color: '#ff0000',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'loc-2',
          planId: 'plan-1',
          name: 'Room 2',
          type: 'polygon',
          bounds: null,
          vertices: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
          ],
          color: '#00ff00',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      useLocationStore.getState().setLocations(locations);
      useLocationStore.getState().clearLocations();

      const state = useLocationStore.getState();
      expect(state.locations.size).toBe(0);
    });
  });

  describe('Selection Management', () => {
    it('selects a location', () => {
      useLocationStore.getState().selectLocation('loc-1');

      const state = useLocationStore.getState();
      expect(state.selectedLocationId).toBe('loc-1');
      expect(state.activeTool).toBe('select');
    });

    it('clears selection', () => {
      useLocationStore.getState().selectLocation('loc-1');
      useLocationStore.getState().clearSelection();

      const state = useLocationStore.getState();
      expect(state.selectedLocationId).toBeNull();
    });

    it('clears selection when location is removed', () => {
      const location: Location = {
        id: 'loc-1',
        planId: 'plan-1',
        name: 'Room 1',
        type: 'rectangle',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        vertices: null,
        color: '#ff0000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      useLocationStore.getState().addLocation(location);
      useLocationStore.getState().selectLocation('loc-1');
      useLocationStore.getState().removeLocation('loc-1');

      const state = useLocationStore.getState();
      expect(state.selectedLocationId).toBeNull();
    });
  });

  describe('Drawing Tool Management', () => {
    it('sets active tool', () => {
      useLocationStore.getState().setActiveTool('rectangle');

      const state = useLocationStore.getState();
      expect(state.activeTool).toBe('rectangle');
    });

    it('clears selection when switching tools', () => {
      useLocationStore.getState().selectLocation('loc-1');
      useLocationStore.getState().setActiveTool('rectangle');

      const state = useLocationStore.getState();
      expect(state.selectedLocationId).toBeNull();
    });

    it('cancels polygon draft when switching to non-polygon tool', () => {
      useLocationStore.getState().setActiveTool('polygon');
      useLocationStore.getState().startPolygon();
      useLocationStore.getState().setActiveTool('rectangle');

      const state = useLocationStore.getState();
      expect(state.draftPolygon).toBeNull();
    });

    it('cancels rectangle draft when switching to non-rectangle tool', () => {
      useLocationStore.getState().setActiveTool('rectangle');
      useLocationStore.getState().startRectangle({ x: 0, y: 0 });
      useLocationStore.getState().setActiveTool('polygon');

      const state = useLocationStore.getState();
      expect(state.draftRectangle).toBeNull();
    });
  });

  describe('Rectangle Drawing', () => {
    it('starts a rectangle', () => {
      useLocationStore.getState().startRectangle({ x: 10, y: 20 });

      const state = useLocationStore.getState();
      expect(state.draftRectangle).toEqual({
        start: { x: 10, y: 20 },
        end: { x: 10, y: 20 },
      });
    });

    it('updates rectangle end point', () => {
      useLocationStore.getState().startRectangle({ x: 10, y: 20 });
      useLocationStore.getState().updateRectangle({ x: 100, y: 150 });

      const state = useLocationStore.getState();
      expect(state.draftRectangle?.end).toEqual({ x: 100, y: 150 });
    });

    it('completes rectangle and returns bounds', () => {
      useLocationStore.getState().startRectangle({ x: 10, y: 20 });
      useLocationStore.getState().updateRectangle({ x: 100, y: 150 });
      const result = useLocationStore.getState().completeRectangle();

      expect(result).toEqual({
        start: { x: 10, y: 20 },
        end: { x: 100, y: 150 },
      });

      const state = useLocationStore.getState();
      expect(state.draftRectangle).toBeNull();
    });

    it('cancels rectangle', () => {
      useLocationStore.getState().startRectangle({ x: 10, y: 20 });
      useLocationStore.getState().cancelRectangle();

      const state = useLocationStore.getState();
      expect(state.draftRectangle).toBeNull();
    });

    it('returns null when completing without draft', () => {
      const result = useLocationStore.getState().completeRectangle();
      expect(result).toBeNull();
    });
  });

  describe('Polygon Drawing', () => {
    it('starts a polygon', () => {
      useLocationStore.getState().startPolygon();

      const state = useLocationStore.getState();
      expect(state.draftPolygon).toEqual({
        vertices: [],
        isComplete: false,
      });
    });

    it('adds vertices to polygon', () => {
      useLocationStore.getState().startPolygon();
      useLocationStore.getState().addPolygonVertex({ x: 10, y: 20 });
      useLocationStore.getState().addPolygonVertex({ x: 30, y: 40 });

      const state = useLocationStore.getState();
      expect(state.draftPolygon?.vertices).toEqual([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
    });

    it('auto-starts polygon when adding first vertex', () => {
      useLocationStore.getState().addPolygonVertex({ x: 10, y: 20 });

      const state = useLocationStore.getState();
      expect(state.draftPolygon).toBeDefined();
      expect(state.draftPolygon?.vertices).toEqual([{ x: 10, y: 20 }]);
    });

    it('removes last vertex', () => {
      useLocationStore.getState().startPolygon();
      useLocationStore.getState().addPolygonVertex({ x: 10, y: 20 });
      useLocationStore.getState().addPolygonVertex({ x: 30, y: 40 });
      useLocationStore.getState().removeLastPolygonVertex();

      const state = useLocationStore.getState();
      expect(state.draftPolygon?.vertices).toEqual([{ x: 10, y: 20 }]);
    });

    it('updates last vertex', () => {
      useLocationStore.getState().startPolygon();
      useLocationStore.getState().addPolygonVertex({ x: 10, y: 20 });
      useLocationStore.getState().updateLastPolygonVertex({ x: 15, y: 25 });

      const state = useLocationStore.getState();
      expect(state.draftPolygon?.vertices).toEqual([{ x: 15, y: 25 }]);
    });

    it('completes polygon with 3+ vertices', () => {
      useLocationStore.getState().startPolygon();
      useLocationStore.getState().addPolygonVertex({ x: 10, y: 20 });
      useLocationStore.getState().addPolygonVertex({ x: 30, y: 40 });
      useLocationStore.getState().addPolygonVertex({ x: 50, y: 30 });

      const result = useLocationStore.getState().completePolygon();

      expect(result).toEqual([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 30 },
      ]);

      const state = useLocationStore.getState();
      expect(state.draftPolygon).toBeNull();
    });

    it('returns null when completing polygon with < 3 vertices', () => {
      useLocationStore.getState().startPolygon();
      useLocationStore.getState().addPolygonVertex({ x: 10, y: 20 });
      useLocationStore.getState().addPolygonVertex({ x: 30, y: 40 });

      const result = useLocationStore.getState().completePolygon();
      expect(result).toBeNull();
    });

    it('cancels polygon', () => {
      useLocationStore.getState().startPolygon();
      useLocationStore.getState().addPolygonVertex({ x: 10, y: 20 });
      useLocationStore.getState().cancelPolygon();

      const state = useLocationStore.getState();
      expect(state.draftPolygon).toBeNull();
    });
  });
});
